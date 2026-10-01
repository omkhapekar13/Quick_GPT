import "dotenv/config";
import RoomMessage from "../models/roomMessage.js";
import openai from "../configs/openai.js";
import {
  indexRoomMessagePython,
  retrieveRoomContextPython,
  buildRoomPromptPython,
  roomChatRagPython,
  indexUserMessagePython,
  retrieveUserContextPython,
  buildUserPromptPython,
  cleanQueryPython,
} from "./pythonRagClient.js";

/**
 * Clean user query by stripping @ai trigger tags and extra whitespace.
 * @param {string} query 
 * @returns {string}
 */
export const cleanUserQuery = (query) => {
  if (!query || typeof query !== "string") return "";
  return query
    .replace(/(?:^|\s)@ai\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Helper to normalize room namespace.
 * @param {string|any} roomId 
 * @returns {string}
 */
export const getRoomNamespace = (roomId) => {
  return roomId ? String(roomId).trim() : "";
};

/**
 * Helper to normalize user namespace for 1-on-1 private memories.
 * @param {string|any} userId 
 * @returns {string}
 */
export const getUserNamespace = (userId) => {
  return userId ? `user_${String(userId).trim()}` : "";
};

/**
 * Check if Vector DB / RAG pipeline is configured (delegates to Python).
 * @returns {boolean}
 */
export const isVectorDbConfigured = () => {
  return Boolean(process.env.PINECONE_API_KEY);
};

/**
 * Index a single room message via Python RAG microservice and update MongoDB flag.
 * @param {Object} params
 * @param {string|any} params.messageId
 * @param {string|any} params.roomId
 * @param {string} params.senderName
 * @param {string} [params.senderType='user']
 * @param {string} params.content
 * @param {Date|number|string} [params.createdAt]
 * @param {boolean} [params.isImage=false]
 * @returns {Promise<boolean>}
 */
export const indexMessage = async ({
  messageId,
  roomId,
  senderName,
  senderType = "user",
  content,
  createdAt = new Date(),
  isImage = false,
}) => {
  if (isImage || !content || typeof content !== "string" || !content.trim() || !roomId) {
    return false;
  }

  try {
    const success = await indexRoomMessagePython({
      messageId,
      roomId,
      senderName,
      senderType,
      content,
      createdAt,
      isImage,
    });

    if (success && messageId) {
      await RoomMessage.updateOne(
        { _id: messageId },
        { $set: { isVectorIndexed: true } }
      ).catch(() => {});
    }

    return Boolean(success);
  } catch (error) {
    console.error(`RAG indexing error for message ${messageId}:`, error.message);
    return false;
  }
};

/**
 * Retrieve semantically relevant room messages via Python RAG service.
 * @param {Object} params
 * @param {string} params.query
 * @param {string|any} params.roomId
 * @param {number} [params.topK=5]
 * @param {number} [params.minScore=0.35]
 * @returns {Promise<Array<Object>>}
 */
export const retrieveContext = async ({
  query,
  roomId,
  topK = 5,
  minScore = 0.35,
}) => {
  if (!query || !roomId) {
    return [];
  }

  try {
    const results = await retrieveRoomContextPython({
      query,
      roomId,
      topK,
      minScore,
    });
    return Array.isArray(results) ? results : [];
  } catch (error) {
    console.error("RAG context retrieval error:", error.message);
    return [];
  }
};

/**
 * Assemble an optimized RAG prompt combining retrieved semantic context and recent chat memory.
 * Delegates deduplication & system instructions to Python RAG service.
 * @param {Object} params
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export const buildRAGPrompt = async ({
  query,
  retrievedDocs = [],
  recentHistory = [],
  roomName = "Chat Room",
  participants = [],
}) => {
  try {
    const pythonMessages = await buildRoomPromptPython({
      query,
      retrievedDocs,
      recentHistory,
      roomName,
      participants,
    });

    if (Array.isArray(pythonMessages) && pythonMessages.length > 0) {
      return pythonMessages;
    }
  } catch (error) {
    console.error("Python buildRoomPrompt error:", error.message);
  }

  // Graceful fallback prompt assembly
  const participantList = Array.isArray(participants)
    ? participants.map((p) => (typeof p === "object" && p ? p.userName || p.name : String(p))).filter(Boolean).join(", ")
    : "Multiple Participants";

  const messages = [
    {
      role: "system",
      content: `You are an AI assistant in a collaborative group chat room called "${roomName}". Active participants: ${participantList}.`,
    },
  ];

  for (const m of recentHistory) {
    const role = (m.senderType || m.role) === "ai" ? "assistant" : "user";
    messages.push({
      role,
      content: `[${m.senderName || "User"}]: ${m.content || ""}`,
    });
  }

  messages.push({ role: "user", content: query });
  return messages;
};

/**
 * Real-time Room Chat RAG pipeline:
 * Delegates semantic retrieval, context merging, and LLM inference directly to Python.
 * Provides fallback to local Node Gemini if Python RAG is temporarily offline.
 * @param {Object} params
 * @returns {Promise<{aiResponse: string, retrievedDocs: Array, isFallback: boolean, sourcesCount: number}>}
 */
export const generateRoomRAGResponse = async ({
  roomId,
  query,
  recentHistory = [],
  roomName = "Chat Room",
  participants = [],
  topK = 6,
  minScore = 0.35,
  model = "gemini-2.5-flash",
}) => {
  // 1. Primary: End-to-end Python Room RAG pipeline
  try {
    const result = await roomChatRagPython({
      roomId,
      query,
      recentHistory,
      roomName,
      participants,
      topK,
      minScore,
      model,
    });

    if (result && result.success && result.aiResponse) {
      return {
        aiResponse: result.aiResponse,
        retrievedDocs: result.retrievedDocs || [],
        isFallback: result.isFallback || false,
        sourcesCount: result.sourcesCount || 0,
      };
    }
  } catch (pythonErr) {
    console.warn(`Python Room RAG unavailable (${pythonErr.message}), falling back to direct LLM.`);
  }

  // 2. Resilient Fallback: Generate response using recent chat buffer directly if Python is down
  try {
    const fallbackMessages = await buildRAGPrompt({
      query,
      retrievedDocs: [],
      recentHistory,
      roomName,
      participants,
    });

    const completion = await openai.chat.completions.create({
      model: model || "gemini-2.5-flash",
      messages: fallbackMessages,
    });

    const aiText = completion?.choices?.[0]?.message?.content?.trim();
    return {
      aiResponse: aiText || "I am here to help.",
      retrievedDocs: [],
      isFallback: true,
      sourcesCount: 0,
    };
  } catch (llmErr) {
    console.error("Local fallback LLM error:", llmErr.message);
    return {
      aiResponse: "I encountered an issue processing that room query. Please try again.",
      retrievedDocs: [],
      isFallback: true,
      sourcesCount: 0,
    };
  }
};

/**
 * Index a 1-on-1 private chat message into user's personal memory via Python RAG.
 * @param {Object} params
 * @returns {Promise<boolean>}
 */
export const indexUserMessage = async ({
  userId,
  chatId,
  chatName = "Chat",
  role = "user",
  content,
  timestamp,
  isImage = false,
}) => {
  if (isImage || !content || typeof content !== "string" || !content.trim() || !userId) {
    return false;
  }

  try {
    return await indexUserMessagePython({
      userId,
      chatId,
      chatName,
      role,
      content,
      timestamp,
      isImage,
    });
  } catch (error) {
    console.error("User RAG indexing error:", error.message);
    return false;
  }
};

/**
 * Retrieve cross-session long-term user memories via Python RAG service.
 * @param {Object} params
 * @returns {Promise<Array<Object>>}
 */
export const retrieveUserContext = async ({
  query,
  userId,
  excludeChatId,
  topK = 4,
  minScore = 0.35,
}) => {
  if (!query || !userId) {
    return [];
  }

  try {
    const results = await retrieveUserContextPython({
      query,
      userId,
      excludeChatId,
      topK,
      minScore,
    });
    return Array.isArray(results) ? results : [];
  } catch (error) {
    console.error("User context retrieval error:", error.message);
    return [];
  }
};

/**
 * Assemble 1-on-1 personalized prompt with cross-session memories via Python RAG service.
 * @param {Object} params
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export const buildUserRAGPrompt = async ({
  query,
  userName = "User",
  retrievedDocs = [],
  recentHistory = [],
}) => {
  try {
    const messages = await buildUserPromptPython({
      query,
      userName,
      retrievedDocs,
      recentHistory,
    });
    if (Array.isArray(messages) && messages.length > 0) {
      return messages;
    }
  } catch (error) {
    console.error("User RAG prompt building error:", error.message);
  }

  // Fallback
  return [
    { role: "system", content: `You are a helpful AI assistant talking with ${userName}.` },
    ...recentHistory.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content || "",
    })),
    { role: "user", content: query },
  ];
};
