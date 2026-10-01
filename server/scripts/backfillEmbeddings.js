import "dotenv/config";
import mongoose from "mongoose";
import RoomMessage from "../models/roomMessage.js";
import Chat from "../models/chat.js";
import { indexMessage, indexUserMessage } from "../services/ragService.js";
import { checkPythonHealth } from "../services/pythonRagClient.js";

async function backfillRoomMessages() {
  console.log("--- 1. Backfilling Room Messages via Python RAG ---");
  const baseQuery = {
    isVectorIndexed: { $ne: true },
    isImage: { $ne: true },
    content: { $exists: true, $ne: "" },
  };

  const totalCount = await RoomMessage.countDocuments(baseQuery);
  console.log(`Found ${totalCount} un-indexed room messages.`);

  if (totalCount === 0) {
    console.log("✨ All room messages are already indexed!\n");
    return;
  }

  const BATCH_SIZE = 10;
  let processed = 0;
  let successful = 0;
  let lastId = null;

  while (true) {
    const pageQuery = lastId
      ? { ...baseQuery, _id: { $gt: lastId } }
      : baseQuery;

    const messages = await RoomMessage.find(pageQuery)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!messages || messages.length === 0) break;

    lastId = messages[messages.length - 1]._id;

    for (const msg of messages) {
      const ok = await indexMessage({
        messageId: msg._id,
        roomId: msg.roomId,
        senderName: msg.senderName || "User",
        senderType: msg.senderType || "user",
        content: msg.content,
        createdAt: msg.createdAt,
        isImage: msg.isImage || false,
      });

      if (ok) {
        successful++;
      }
    }

    processed += messages.length;
    console.log(`Room Progress: ${processed}/${totalCount} processed | ${successful} indexed`);
  }
  console.log(`Room messages backfill completed: ${successful}/${totalCount} indexed.\n`);
}

async function backfillUserChats() {
  console.log("--- 2. Backfilling 1-on-1 User Chats via Python RAG ---");
  const chats = await Chat.find({ "messages.isImage": false }).lean();
  let totalMessages = 0;

  for (const chat of chats) {
    if (!chat.userId || !Array.isArray(chat.messages)) continue;
    for (const msg of chat.messages) {
      if (msg.isImage || !msg.content || typeof msg.content !== "string" || !msg.content.trim()) {
        continue;
      }
      if (msg.isVectorIndexed) continue;
      totalMessages++;
    }
  }

  console.log(`Found ${totalMessages} un-indexed 1-on-1 messages across ${chats.length} chats.`);

  if (totalMessages === 0) {
    console.log("✨ All user chat messages are already indexed!\n");
    return;
  }

  let processed = 0;
  let successful = 0;

  for (const chat of chats) {
    if (!chat.userId || !Array.isArray(chat.messages)) continue;
    let modified = false;

    for (const msg of chat.messages) {
      if (msg.isImage || !msg.content || typeof msg.content !== "string" || !msg.content.trim()) {
        continue;
      }
      if (msg.isVectorIndexed) continue;

      const ok = await indexUserMessage({
        userId: chat.userId,
        chatId: chat._id,
        chatName: chat.title || "Chat",
        role: msg.role || "user",
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        isImage: false,
      });

      if (ok) {
        successful++;
        msg.isVectorIndexed = true;
        modified = true;
      }
      processed++;
    }

    if (modified) {
      await Chat.updateOne(
        { _id: chat._id },
        { $set: { messages: chat.messages } }
      ).catch(() => {});
    }

    if (processed % 10 === 0 || processed === totalMessages) {
      console.log(`User Chat Progress: ${processed}/${totalMessages} processed | ${successful} indexed`);
    }
  }

  console.log(`User chat messages backfill completed: ${successful}/${totalMessages} indexed.\n`);
}

async function runBackfill() {
  console.log("=================================================");
  console.log("    MyGPT RAG Backfill Migration (via Python)    ");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Error: MONGODB_URI is not defined in environment variables.");
    process.exit(1);
  }

  const health = await checkPythonHealth();
  if (!health.online) {
    console.error("Error: Python RAG service is not running at http://127.0.0.1:8000.");
    console.error("   Please start it with: npm run rag:python (or python -m uvicorn rag_service.main:app)");
    console.error("   Alternatively, run the native Python backfill: python rag_service/scripts/backfill_embeddings.py");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.\n");

    await backfillRoomMessages();
    await backfillUserChats();

    console.log("🎉 Complete RAG backfill finished successfully!");
  } catch (err) {
    console.error("Backfill failed with error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
}

runBackfill();
