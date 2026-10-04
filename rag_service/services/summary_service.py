import re
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from openai import OpenAI
from ..configs.settings import GEMINI_API_KEY

logger = logging.getLogger("rag_service.summary")

_summary_llm_client: Optional[OpenAI] = None
if GEMINI_API_KEY:
    _summary_llm_client = OpenAI(
        api_key=GEMINI_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )


def _get_llm_client() -> Optional[OpenAI]:
    global _summary_llm_client
    if _summary_llm_client is None and GEMINI_API_KEY:
        _summary_llm_client = OpenAI(
            api_key=GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
    return _summary_llm_client


def _format_transcript_line(msg: Dict[str, Any]) -> str:
    """Format a single message dict into a human-readable transcript line."""
    sender_name = msg.get("sender_name") or msg.get("senderName") or "User"
    sender_type = msg.get("sender_type") or msg.get("senderType") or "user"
    content = (msg.get("content") or "").strip()
    is_image = msg.get("is_image") or msg.get("isImage") or False

    if is_image:
        content = "[Shared an image]"

    speaker = "AI Assistant" if sender_type == "ai" else sender_name
    created_at = msg.get("created_at") or msg.get("createdAt")
    time_str = ""

    if created_at:
        try:
            if isinstance(created_at, (int, float)):
                # Millisecond or second epoch
                epoch = created_at / 1000.0 if created_at > 1e11 else float(created_at)
                dt = datetime.fromtimestamp(epoch)
                time_str = dt.strftime("%H:%M:%S")
            elif isinstance(created_at, str):
                time_str = created_at.split("T")[-1][:8]
        except Exception:
            time_str = ""

    prefix = f"[{time_str}] " if time_str else ""
    return f"{prefix}{speaker}: {content}"


def format_messages_to_transcript(messages: List[Dict[str, Any]]) -> str:
    """Convert an array of message objects to clean chronological transcript text."""
    lines = []
    for msg in messages:
        line = _format_transcript_line(msg)
        if line:
            lines.append(line)
    return "\n".join(lines)


def _extract_section_bullets(text: str, section_header: str) -> List[str]:
    """Helper to extract bullet points from a markdown section."""
    pattern = rf"##\s*{re.escape(section_header)}[^\n]*\n(.*?)(?=\n##|\Z)"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if not match:
        return []

    section_body = match.group(1).strip()
    bullets = []
    for line in section_body.split("\n"):
        line = line.strip()
        if line.startswith(("-", "*", "•")) or re.match(r"^\d+\.", line):
            cleaned = re.sub(r"^[-*•\d\.]+\s*", "", line).strip()
            if cleaned and not cleaned.lower().startswith("no explicit") and not cleaned.lower().startswith("no action"):
                bullets.append(cleaned)
    return bullets


def _extract_topics_and_decisions(summary_text: str) -> Dict[str, List[str]]:
    """Parse out key topics, decisions, and action items from structured markdown."""
    topics = _extract_section_bullets(summary_text, "Key Points") or _extract_section_bullets(summary_text, "Key Discussion Topics")
    decisions = _extract_section_bullets(summary_text, "Decisions Made") or _extract_section_bullets(summary_text, "Decisions")
    action_items = _extract_section_bullets(summary_text, "Action Items") or _extract_section_bullets(summary_text, "Tasks & Action Items")
    participants = _extract_section_bullets(summary_text, "Participants") or _extract_section_bullets(summary_text, "Participant Contributions")

    return {
        "topics": topics,
        "decisions": decisions,
        "action_items": action_items,
        "participants": participants,
    }


def generate_hierarchical_summary(
    messages: List[Dict[str, Any]],
    room_name: str = "Chat Room",
    chunk_size: int = 50,
    model_name: str = "gemini-2.5-flash",
) -> Dict[str, Any]:
    """
    Hierarchical summarization for large chat rooms:
    1. Splits transcript into sequential logical chunks.
    2. Summarizes each chunk independently (Map phase).
    3. Synthesizes a unified structured summary across all chunk digests (Reduce phase).
    """
    client = _get_llm_client()
    if not client:
        return {
            "success": False,
            "error": "LLM client not configured (GEMINI_API_KEY missing)",
            "summary": "Summary service unavailable: GEMINI_API_KEY not configured.",
        }

    chunks = [messages[i:i + chunk_size] for i in range(0, len(messages), chunk_size)]
    intermediate_summaries = []

    logger.info(f"Processing hierarchical summary for room '{room_name}' with {len(messages)} messages in {len(chunks)} chunks.")

    for idx, chunk in enumerate(chunks, 1):
        chunk_transcript = format_messages_to_transcript(chunk)
        chunk_prompt = (
            f"You are an assistant summarizing a portion (Part {idx} of {len(chunks)}) "
            f"of a team discussion in '{room_name}'.\n\n"
            f"TRANSCRIPT SEGMENT:\n{chunk_transcript}\n\n"
            "Provide a concise summary highlighting: (1) Main topics discussed, "
            "(2) Any decisions made, and (3) Action items or follow-ups mentioned."
        )

        try:
            resp = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": chunk_prompt}],
                max_tokens=800,
            )
            intermediate_summaries.append(resp.choices[0].message.content)
        except Exception as e:
            logger.warning(f"Failed chunk {idx} summarization: {e}")
            intermediate_summaries.append(f"Segment {idx}: Discussion occurred among participants.")

    # Synthesis stage
    combined_intermediate = "\n\n---\n\n".join(
        f"### Segment {i+1} Notes:\n{summ}" for i, summ in enumerate(intermediate_summaries)
    )

    synthesis_prompt = f"""You are an executive meeting summarizer. Below are synthesized notes from sequential parts of a chat room called "{room_name}".

COMBINED DISCUSSION NOTES:
{combined_intermediate}

Please synthesize these into an authoritative, structured meeting summary in markdown with the following exact sections:
## Overview
A 2-3 sentence high-level executive summary of the entire discussion.

## Key Discussion Topics
Bullet list of the major topics discussed across the meeting with concise context.

## Decisions Made
Bullet list of any decisions or conclusions reached. If none, write "No explicit decisions recorded."

## Action Items
Bullet list of tasks, assignments, and follow-ups with owners/assignees if identifiable. If none, write "No action items identified."

## Participant Contributions
List of notable contributors and their roles/inputs during the discussion.

Keep it strictly factual, clear, and objective."""

    try:
        final_resp = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": synthesis_prompt}],
            max_tokens=2048,
        )
        final_markdown = final_resp.choices[0].message.content or ""
        parsed = _extract_topics_and_decisions(final_markdown)

        return {
            "success": True,
            "summary": final_markdown,
            "is_hierarchical": True,
            "chunk_count": len(chunks),
            "message_count": len(messages),
            "topics": parsed["topics"],
            "decisions": parsed["decisions"],
            "action_items": parsed["action_items"],
            "participants": parsed["participants"],
        }
    except Exception as e:
        logger.error(f"Hierarchical summary synthesis failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "summary": f"Failed to generate hierarchical summary: {e}",
        }


def generate_room_summary(
    messages: List[Dict[str, Any]],
    room_name: str = "Chat Room",
    model_name: str = "gemini-2.5-flash",
) -> Dict[str, Any]:
    """
    Generate an intelligent structured summary for a room discussion in Python:
    - Automatically switches to hierarchical summarization if message history is large (> 70 messages).
    - Extracts key discussion topics, decisions, action items, and participant roles.
    - Returns structured markdown and parsed entities.
    """
    if not messages or len(messages) < 3:
        return {
            "success": False,
            "error": "Not enough conversation history to generate a summary. Minimum 3 messages required.",
            "summary": "",
            "message_count": len(messages) if messages else 0,
        }

    # For larger room transcripts, use hierarchical map-reduce summarization
    if len(messages) > 70:
        return generate_hierarchical_summary(
            messages=messages,
            room_name=room_name,
            chunk_size=50,
            model_name=model_name,
        )

    client = _get_llm_client()
    if not client:
        return {
            "success": False,
            "error": "LLM client not configured (GEMINI_API_KEY missing)",
            "summary": "Summary service unavailable: GEMINI_API_KEY not configured.",
        }

    transcript = format_messages_to_transcript(messages)

    prompt = f"""You are an expert meeting summarizer. Below is a transcript from a group chat room called "{room_name}".

TRANSCRIPT:
{transcript}

Please generate a structured summary in markdown with the following exact sections:
## Overview
A 2-3 sentence high-level summary of the discussion.

## Key Discussion Topics
Bullet list of the main topics discussed.

## Decisions Made
Bullet list of any decisions or conclusions reached. If none, write "No explicit decisions recorded."

## Action Items
Bullet list of any tasks or follow-ups mentioned, with the responsible person if identifiable. If none, write "No action items identified."

## Participant Contributions
List of people who participated and a one-line note on their contributions.

Keep it concise, factual, and strictly grounded in the transcript. Do not invent information."""

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2048,
        )
        summary_text = response.choices[0].message.content or ""
        parsed = _extract_topics_and_decisions(summary_text)

        # Extract unique participant names from messages
        active_participants = list({
            (m.get("sender_name") or m.get("senderName") or "User")
            for m in messages
            if (m.get("sender_type") or m.get("senderType")) != "ai"
        })

        return {
            "success": True,
            "summary": summary_text,
            "is_hierarchical": False,
            "message_count": len(messages),
            "topics": parsed["topics"],
            "decisions": parsed["decisions"],
            "action_items": parsed["action_items"],
            "participants": parsed["participants"] or active_participants,
            "active_speakers": active_participants,
        }
    except Exception as error:
        logger.error(f"Error generating room summary in Python: {error}")
        return {
            "success": False,
            "error": str(error),
            "summary": f"Failed to generate summary: {error}",
            "message_count": len(messages),
        }
