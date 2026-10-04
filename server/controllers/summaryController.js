import Summary from "../models/summary.js";
import RoomMessage from "../models/roomMessage.js";
import User from "../models/user.js";
import openai from "../configs/openai.js";
import { generateRoomSummaryPython } from "../services/pythonRagClient.js";

// Generate a summary for a room
export const generateRoomSummary = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    // Check user credits (requires 2 credits)
    if (req.user.credits < 2) {
      return res.json({
        success: false,
        message: "You don't have enough credits to generate a summary (requires 2 credits).",
      });
    }

    // Enforce 60-second cooldown per room
    const lastSummary = await Summary.findOne({ roomId }).sort({ createdAt: -1 });
    if (lastSummary) {
      const timeDiff = Date.now() - new Date(lastSummary.createdAt).getTime();
      if (timeDiff < 60 * 1000) {
        const secondsLeft = Math.ceil((60 * 1000 - timeDiff) / 1000);
        return res.json({
          success: false,
          message: `Cooldown active. Please wait ${secondsLeft} second(s) before generating another summary.`,
        });
      }
    }

    // Fetch the last 200 messages for this room
    const messages = await RoomMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    if (!messages || messages.length < 3) {
      return res.json({
        success: false,
        message: "Not enough conversation history to generate a summary. Please type more first!",
      });
    }

    // Reverse to chronological order
    messages.reverse();

    // Phase 4: Generate intelligent room summary via Python RAG microservice
    let summaryText = "";
    try {
      const pySummaryResult = await generateRoomSummaryPython({
        roomId,
        roomName: req.room.name,
        messages: messages.map((m) => ({
          sender_name: m.senderName,
          sender_type: m.senderType,
          content: m.content,
          created_at: m.createdAt,
          is_image: m.isImage,
        })),
      });

      if (pySummaryResult && pySummaryResult.success && pySummaryResult.summary) {
        summaryText = pySummaryResult.summary;
      }
    } catch (pyErr) {
      console.warn("Python RAG summary error, falling back to local LLM:", pyErr.message);
    }

    // Local Node.js Fallback if Python service unavailable
    if (!summaryText) {
      // Format transcript
      const transcript = messages
        .map((m) => {
          const speaker = m.senderType === "ai" ? "AI Assistant" : m.senderName;
          const time = new Date(m.createdAt).toLocaleTimeString();
          return `[${time}] ${speaker}: ${m.content}`;
        })
        .join("\n");

      const prompt = `You are a meeting summarizer. Below is a transcript from a group chat room called "${req.room.name}".

TRANSCRIPT:
${transcript}

Please generate a structured summary in markdown with the following sections:
## Overview
A 2-3 sentence high-level summary of the discussion.

## Key Points
Bullet list of the main topics discussed.

## Decisions Made
Bullet list of any decisions or conclusions reached. If none, write "No explicit decisions recorded."

## Action Items
Bullet list of any tasks or follow-ups mentioned, with the responsible person if identifiable. If none, write "No action items identified."

## Participants
List of people who participated and a one-line note on their contributions.

Keep it concise and factual. Do not invent information not present in the transcript.`;

      // Query Gemini
      const response = await openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
      });

      summaryText = response.choices[0].message.content;
    }

    // Calculate version
    const count = await Summary.countDocuments({ roomId });
    const version = count + 1;

    // Create Summary document
    const newSummary = await Summary.create({
      roomId,
      generatedBy: userId,
      content: summaryText,
      messageRange: {
        from: messages[0].createdAt,
        to: messages[messages.length - 1].createdAt,
      },
      messageCount: messages.length,
      version,
    });

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });
    const updatedUser = await User.findById(userId);

    // Return response
    res.json({
      success: true,
      summary: {
        ...newSummary.toObject(),
        generatedBy: { _id: req.user._id, name: req.user.name, email: req.user.email },
      },
      credits: updatedUser.credits,
    });
  } catch (error) {
    console.error("Error in generateRoomSummary:", error);
    res.json({ success: false, message: error.message });
  }
};

// Get summaries history for a room
export const getRoomSummaries = async (req, res) => {
  try {
    const { roomId } = req.params;
    const summaries = await Summary.find({ roomId })
      .sort({ version: -1 })
      .populate("generatedBy", "name email")
      .lean();

    res.json({ success: true, summaries });
  } catch (error) {
    console.error("Error in getRoomSummaries:", error);
    res.json({ success: false, message: error.message });
  }
};
