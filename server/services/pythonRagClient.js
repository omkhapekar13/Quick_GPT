import "dotenv/config";
import axios from "axios";

const PYTHON_RAG_URL = process.env.PYTHON_RAG_URL || "http://127.0.0.1:8000";
const TIMEOUT_MS = parseInt(process.env.PYTHON_RAG_TIMEOUT_MS, 10) || 15000;

const ragHttpClient = axios.create({
  baseURL: PYTHON_RAG_URL,
  timeout: TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Check if the Python RAG service is active and healthy
 * @returns {Promise<{online: boolean, details?: Object, error?: string}>}
 */
export const checkPythonHealth = async () => {
  try {
    const res = await ragHttpClient.get("/health", { timeout: 2000 });
    return {
      online: true,
      details: res.data,
    };
  } catch (err) {
    return {
      online: false,
      error: err.message,
    };
  }
};

/**
 * Request vector embedding generation from the Python RAG service
 * @param {string} text - Input text
 * @param {string} [model] - Embedding model name
 * @returns {Promise<number[]|null>}
 */
export const generateEmbeddingPython = async (text, model) => {
  try {
    const res = await ragHttpClient.post("/api/rag/embed", {
      text,
      model,
    });
    if (res.data?.success && Array.isArray(res.data?.embedding)) {
      return res.data.embedding;
    }
    return null;
  } catch (err) {
    console.error("Python RAG client generateEmbedding error:", err.message);
    return null;
  }
};

/**
 * Request batch vector embeddings from the Python RAG service
 * @param {string[]} texts - Array of input strings
 * @param {string} [model] - Embedding model name
 * @returns {Promise<Array<number[]|null>>}
 */
export const generateBatchEmbeddingsPython = async (texts, model) => {
  try {
    const res = await ragHttpClient.post("/api/rag/embed-batch", {
      texts,
      model,
    });
    if (res.data?.success && Array.isArray(res.data?.embeddings)) {
      return res.data.embeddings;
    }
    return [];
  } catch (err) {
    console.error("Python RAG client generateBatchEmbeddings error:", err.message);
    return [];
  }
};

/**
 * Fetch vector DB index status and metrics from Python RAG service
 * @returns {Promise<Object|null>}
 */
export const getVectorStatusPython = async () => {
  try {
    const res = await ragHttpClient.get("/api/rag/vector-status");
    return res.data;
  } catch (err) {
    console.error("Python RAG client getVectorStatus error:", err.message);
    return null;
  }
};

/**
 * Clean user query by stripping @ai trigger tags
 * @param {string} query
 * @returns {Promise<string>}
 */
export const cleanQueryPython = async (query) => {
  try {
    const res = await ragHttpClient.post("/api/rag/clean-query", { query });
    return res.data?.cleaned_query ?? query;
  } catch (err) {
    console.error("Python RAG cleanQuery error:", err.message);
    return query;
  }
};

/**
 * Index a room message into Pinecone via Python RAG service
 */
export const indexRoomMessagePython = async ({
  messageId,
  roomId,
  senderName,
  senderType = "user",
  content,
  createdAt,
  isImage = false,
}) => {
  try {
    const res = await ragHttpClient.post("/api/rag/index-room-message", {
      messageId: messageId ? messageId.toString() : null,
      roomId: roomId ? roomId.toString() : "",
      senderName,
      senderType,
      content,
      createdAt,
      isImage,
    });
    return Boolean(res.data?.success);
  } catch (err) {
    console.error("Python RAG indexRoomMessage error:", err.message);
    return false;
  }
};

/**
 * Retrieve semantic context for a room from Python RAG service
 */
export const retrieveRoomContextPython = async ({
  query,
  roomId,
  topK = 5,
  minScore = 0.35,
}) => {
  try {
    const res = await ragHttpClient.post("/api/rag/retrieve-room-context", {
      query,
      roomId: roomId ? roomId.toString() : "",
      topK,
      minScore,
    });
    return Array.isArray(res.data?.results) ? res.data.results : [];
  } catch (err) {
    console.error("Python RAG retrieveRoomContext error:", err.message);
    return [];
  }
};

/**
 * Assemble RAG prompt payload from Python RAG service
 */
export const buildRoomPromptPython = async ({
  query,
  retrievedDocs = [],
  recentHistory = [],
  roomName = "Chat Room",
  participants = [],
}) => {
  try {
    const res = await ragHttpClient.post("/api/rag/build-room-prompt", {
      query,
      retrievedDocs,
      recentHistory,
      roomName,
      participants,
    });
    return Array.isArray(res.data?.messages) ? res.data.messages : null;
  } catch (err) {
    console.error("Python RAG buildRoomPrompt error:", err.message);
    return null;
  }
};

/**
 * Index a 1-on-1 private chat message via Python RAG service
 */
export const indexUserMessagePython = async ({
  userId,
  chatId,
  chatName = "Chat",
  role = "user",
  content,
  timestamp,
  isImage = false,
}) => {
  try {
    const res = await ragHttpClient.post("/api/rag/index-user-message", {
      userId: userId ? userId.toString() : "",
      chatId: chatId ? chatId.toString() : null,
      chatName,
      role,
      content,
      timestamp,
      isImage,
    });
    return Boolean(res.data?.success);
  } catch (err) {
    console.error("Python RAG indexUserMessage error:", err.message);
    return false;
  }
};

/**
 * Retrieve user cross-session context from Python RAG service
 */
export const retrieveUserContextPython = async ({
  query,
  userId,
  excludeChatId = null,
  topK = 4,
  minScore = 0.35,
}) => {
  try {
    const res = await ragHttpClient.post("/api/rag/retrieve-user-context", {
      query,
      userId: userId ? userId.toString() : "",
      excludeChatId: excludeChatId ? excludeChatId.toString() : null,
      topK,
      minScore,
    });
    return Array.isArray(res.data?.results) ? res.data.results : [];
  } catch (err) {
    console.error("Python RAG retrieveUserContext error:", err.message);
    return [];
  }
};

/**
 * Build 1-on-1 user prompt from Python RAG service
 */
export const buildUserPromptPython = async ({
  query,
  userName = "User",
  retrievedDocs = [],
  recentHistory = [],
}) => {
  try {
    const res = await ragHttpClient.post("/api/rag/build-user-prompt", {
      query,
      userName,
      retrievedDocs,
      recentHistory,
    });
    return Array.isArray(res.data?.messages) ? res.data.messages : null;
  } catch (err) {
    console.error("Python RAG buildUserPrompt error:", err.message);
    return null;
  }
};

/**
 * Phase 3: End-to-end room chat RAG via Python microservice.
 * Handles retrieve → prompt assemble → Gemini LLM generation in one call.
 * Uses a longer timeout because LLM generation can take 10–40s.
 */
export const roomChatRagPython = async ({
  roomId,
  query,
  recentHistory = [],
  roomName = "Chat Room",
  participants = [],
  topK = 6,
  minScore = 0.35,
  model = "gemini-2.5-flash",
}) => {
  const llmTimeout =
    parseInt(process.env.PYTHON_RAG_LLM_TIMEOUT_MS, 10) || 45000;

  try {
    const res = await ragHttpClient.post(
      "/api/rag/room-chat-rag",
      {
        roomId: roomId ? roomId.toString() : "",
        query,
        recentHistory,
        roomName,
        participants,
        topK,
        minScore,
        model,
      },
      { timeout: llmTimeout }
    );

    if (!res.data) return null;

    return {
      success: Boolean(res.data.success),
      aiResponse: res.data.aiResponse || res.data.ai_response || "",
      retrievedDocs: res.data.retrievedDocs || res.data.retrieved_docs || [],
      isFallback: Boolean(res.data.isFallback ?? res.data.is_fallback),
      sourcesCount: res.data.sourcesCount ?? res.data.sources_count ?? 0,
      error: res.data.error || null,
    };
  } catch (err) {
    console.error("Python RAG roomChatRag error:", err.message);
    return null;
  }
};

/**
 * Phase 4: Intelligent Room Summary in Python
 * @param {Object} params
 * @param {string} params.roomId
 * @param {string} [params.roomName]
 * @param {Array<Object>} params.messages
 * @param {string} [params.model]
 */
export const generateRoomSummaryPython = async ({
  roomId,
  roomName = "Chat Room",
  messages = [],
  model = "gemini-2.5-flash",
}) => {
  const llmTimeout =
    parseInt(process.env.PYTHON_RAG_LLM_TIMEOUT_MS, 10) || 60000;

  try {
    const res = await ragHttpClient.post(
      "/api/rag/room-summary",
      {
        roomId: roomId ? roomId.toString() : "",
        roomName,
        messages,
        model,
      },
      { timeout: llmTimeout }
    );

    if (!res.data) return null;

    return {
      success: Boolean(res.data.success),
      summary: res.data.summary || "",
      topics: res.data.topics || [],
      decisions: res.data.decisions || [],
      actionItems: res.data.actionItems || res.data.action_items || [],
      participants: res.data.participants || [],
      activeSpeakers: res.data.activeSpeakers || res.data.active_speakers || [],
      messageCount: res.data.messageCount || res.data.message_count || messages.length,
      isHierarchical: Boolean(res.data.isHierarchical ?? res.data.is_hierarchical),
      error: res.data.error || null,
    };
  } catch (err) {
    console.error("Python RAG generateRoomSummary error:", err.message);
    return null;
  }
};

/**
 * Phase 5: 1-on-1 Chat RAG & Cross-Session Personal Memory in Python
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.query
 * @param {string} [params.userName]
 * @param {string} [params.chatId]
 * @param {string} [params.chatName]
 * @param {Array<Object>} [params.recentHistory]
 * @param {number} [params.topK]
 * @param {number} [params.minScore]
 * @param {boolean} [params.autoIndex]
 * @param {string} [params.model]
 */
export const userChatRagPython = async ({
  userId,
  query,
  userName = "User",
  chatId = null,
  chatName = "Chat",
  recentHistory = [],
  topK = 4,
  minScore = 0.35,
  autoIndex = true,
  model = "gemini-2.5-flash",
}) => {
  const llmTimeout =
    parseInt(process.env.PYTHON_RAG_LLM_TIMEOUT_MS, 10) || 45000;

  try {
    const res = await ragHttpClient.post(
      "/api/rag/user-chat-rag",
      {
        userId: userId ? userId.toString() : "",
        query,
        userName,
        chatId: chatId ? chatId.toString() : null,
        chatName,
        recentHistory,
        topK,
        minScore,
        autoIndex,
        model,
      },
      { timeout: llmTimeout }
    );

    if (!res.data) return null;

    return {
      success: Boolean(res.data.success),
      aiResponse: res.data.aiResponse || res.data.ai_response || "",
      retrievedDocs: res.data.retrievedDocs || res.data.retrieved_docs || [],
      sourcesCount: res.data.sourcesCount ?? res.data.sources_count ?? 0,
      indexedCount: res.data.indexedCount ?? res.data.indexed_count ?? 0,
      isFallback: Boolean(res.data.isFallback ?? res.data.is_fallback),
      error: res.data.error || null,
    };
  } catch (err) {
    console.error("Python RAG userChatRag error:", err.message);
    return null;
  }
};

export default {
  PYTHON_RAG_URL,
  checkPythonHealth,
  generateEmbeddingPython,
  generateBatchEmbeddingsPython,
  getVectorStatusPython,
  cleanQueryPython,
  indexRoomMessagePython,
  retrieveRoomContextPython,
  buildRoomPromptPython,
  indexUserMessagePython,
  retrieveUserContextPython,
  buildUserPromptPython,
  roomChatRagPython,
  generateRoomSummaryPython,
  userChatRagPython,
};


