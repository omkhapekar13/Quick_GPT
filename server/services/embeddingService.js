import "dotenv/config";
import {
  generateEmbeddingPython,
  generateBatchEmbeddingsPython,
} from "./pythonRagClient.js";

const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const MAX_INPUT_CHARS = 8000;

/**
 * Clean, sanitize and truncate text for embedding generation
 * @param {any} text 
 * @returns {string}
 */
export const sanitizeText = (text) => {
  if (text === null || text === undefined) return "";
  if (typeof text !== "string") {
    text = String(text);
  }
  const normalized = text.replace(/\0/g, "").replace(/\s+/g, " ").trim();
  return normalized.length > MAX_INPUT_CHARS
    ? normalized.slice(0, MAX_INPUT_CHARS)
    : normalized;
};

/**
 * Generate vector embedding for a single text string by delegating to Python RAG service.
 * @param {string} text - Input text
 * @param {string} [model] - Embedding model name
 * @returns {Promise<number[]|null>} Vector array (3072-dim floats)
 */
export const generateEmbedding = async (
  text,
  model = DEFAULT_EMBEDDING_MODEL
) => {
  const cleaned = sanitizeText(text);
  if (!cleaned) {
    return null;
  }
  return await generateEmbeddingPython(cleaned, model);
};

/**
 * Generate vector embeddings for an array of texts in batches via Python RAG service.
 * @param {string[]} texts - Array of input strings
 * @param {number} [batchSize=20] - Max texts per batch request
 * @param {string} [model] - Embedding model name
 * @returns {Promise<Array<number[]|null>>}
 */
export const generateBatchEmbeddings = async (
  texts,
  batchSize = 20,
  model = DEFAULT_EMBEDDING_MODEL
) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }
  return await generateBatchEmbeddingsPython(texts, model);
};
