import { socketAuthMiddleware } from "../middlewares/socketAuth.js";
import Room from "../models/room.js";
import RoomMessage from "../models/roomMessage.js";
import User from "../models/user.js";
import { indexMessage, generateRoomRAGResponse } from "../services/ragService.js";

// Global queues for AI requests per room
const aiQueues = {};

// Helper to check if a user is still online via another socket in the same room
const checkUserOnlineInRoom = (io, roomId, userId, currentSocketId) => {
  const clients = io.sockets.adapter.rooms.get(roomId);
  if (!clients) return false;
  for (const socketId of clients) {
    if (socketId === currentSocketId) continue;
    const s = io.sockets.sockets.get(socketId);
    if (s && s.user && s.user._id.toString() === userId.toString()) {
      return true;
    }
  }
  return false;
};

// Process the AI request queue for a specific room
const processAIQueue = async (roomId, io) => {
  const queue = aiQueues[roomId];
  if (!queue || queue.isProcessing || queue.requests.length === 0) {
    return;
  }

  queue.isProcessing = true;
  const currentTask = queue.requests[0];

  try {
    const { socket, content, parentMsgId } = currentTask;
    const room = await Room.findById(roomId);
    if (!room || !room.isActive) {
      queue.requests.shift();
      queue.isProcessing = false;
      processAIQueue(roomId, io);
      return;
    }

    const user = await User.findById(socket.user._id);
    if (!user || user.credits < 1) {
      socket.emit("error", { message: "You don't have enough credits to trigger AI" });
      queue.requests.shift();
      queue.isProcessing = false;
      processAIQueue(roomId, io);
      return;
    }

    // Emit ai-typing to room
    io.to(roomId).emit("ai-typing", { roomId, isTyping: true });

    // Fetch immediate recent chronological messages (buffer of 5) for conversation flow.
    // MongoDB remains owned by Node; RAG compute is delegated to Python.
    const recentHistory = await RoomMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentHistory.reverse();

    // Phase 3: End-to-end room RAG in Python (retrieve + prompt + Gemini LLM)
    const ragResult = await generateRoomRAGResponse({
      roomId,
      query: content,
      recentHistory,
      roomName: room.name,
      participants: room.participants,
      topK: 6,
      minScore: 0.35,
      model: "gemini-2.5-flash",
    });

    const aiResponseText =
      ragResult?.aiResponse ||
      "I encountered an issue processing that room query. Please try again.";

    const aiMsg = await RoomMessage.create({
      roomId,
      senderType: "ai",
      senderName: "AI Assistant",
      content: aiResponseText,
      parentMsgId: parentMsgId || null,
      mentions: [],
    });

    io.to(roomId).emit("new-message", aiMsg);

    // Asynchronously index AI response for future retrieval (Python RAG)
    indexMessage({
      messageId: aiMsg._id,
      roomId: aiMsg.roomId,
      senderName: aiMsg.senderName,
      senderType: "ai",
      content: aiMsg.content,
      createdAt: aiMsg.createdAt,
    }).catch((err) => console.error("Async AI index error:", err.message));

    await User.updateOne({ _id: socket.user._id }, { $inc: { credits: -1 } });
    const updatedUser = await User.findById(socket.user._id);
    socket.emit("credits-update", { credits: updatedUser.credits });

  } catch (error) {
    console.error("AI Queue Error:", error);
    currentTask.socket.emit("error", { message: "AI response failed: " + error.message });
  } finally {
    // Emit false typing status
    io.to(roomId).emit("ai-typing", { roomId, isTyping: false });
    // Remove completed task
    queue.requests.shift();
    queue.isProcessing = false;
    // Process next in queue
    processAIQueue(roomId, io);
  }
};

// Queue an AI request
const queueAIRequest = (roomId, io, task) => {
  if (!aiQueues[roomId]) {
    aiQueues[roomId] = {
      isProcessing: false,
      requests: [],
    };
  }

  const queue = aiQueues[roomId];

  // Limit pending requests count to 3
  if (queue.requests.length >= 3) {
    task.socket.emit("error", {
      message: "AI is busy — please wait for the current response.",
    });
    return;
  }

  queue.requests.push(task);
  processAIQueue(roomId, io);
};

export const initSocket = (io) => {
  // Apply JWT authentication middleware to incoming socket connections
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    // Join Room
    socket.on("join-room", async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          return socket.emit("error", { message: "Room not found" });
        }

        const isMember = room.participants.some(
          (p) => p.userId.toString() === socket.user._id.toString()
        );
        if (!isMember) {
          return socket.emit("error", { message: "Not authorized to join this room" });
        }

        socket.join(roomId);

        // Mark user as online
        await Room.updateOne(
          { _id: roomId, "participants.userId": socket.user._id },
          { $set: { "participants.$.isOnline": true } }
        );

        const updatedRoom = await Room.findById(roomId);
        io.to(roomId).emit("presence-update", {
          roomId,
          participants: updatedRoom.participants,
        });
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // Leave Room
    socket.on("leave-room", async ({ roomId }) => {
      try {
        socket.leave(roomId);

        // Deduplicate presence - check if user is still online via another tab/socket
        const isStillOnline = checkUserOnlineInRoom(io, roomId, socket.user._id, socket.id);
        if (!isStillOnline) {
          await Room.updateOne(
            { _id: roomId, "participants.userId": socket.user._id },
            { $set: { "participants.$.isOnline": false } }
          );

          const updatedRoom = await Room.findById(roomId);
          if (updatedRoom) {
            io.to(roomId).emit("presence-update", {
              roomId,
              participants: updatedRoom.participants,
            });
          }
        }
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // Send Message
    socket.on("send-message", async ({ roomId, content, parentMsgId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          return socket.emit("error", { message: "Room not found" });
        }

        // Validate content length limit (Max 4000 chars)
        if (content && content.length > 4000) {
          return socket.emit("error", { message: "Message is too long. Maximum limit is 4000 characters." });
        }

        // Save message to DB
        const messageData = {
          roomId,
          senderType: "user",
          senderId: socket.user._id,
          senderName: socket.user.name,
          content,
          parentMsgId: parentMsgId || null,
        };

        const newMessage = await RoomMessage.create(messageData);

        // Broadcast to all sockets in the room (including sender)
        io.to(roomId).emit("new-message", newMessage);

        // Asynchronously index message into Vector DB (non-blocking)
        indexMessage({
          messageId: newMessage._id,
          roomId: newMessage.roomId,
          senderName: newMessage.senderName,
          senderType: "user",
          content: newMessage.content,
          createdAt: newMessage.createdAt,
        }).catch((err) => console.error("Async msg index error:", err.message));

        // Check if message mentions @ai and room has AI enabled
        const mentionsAI = /(?:^|[^a-zA-Z0-9_])@ai(?![a-zA-Z0-9_])/i.test(content);
        if (mentionsAI && room.aiEnabled) {
          queueAIRequest(roomId, io, { socket, content, parentMsgId });
        }
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // Typing Indicators
    socket.on("typing", ({ roomId, isTyping }) => {
      socket.to(roomId).emit("user-typing", {
        userId: socket.user._id,
        userName: socket.user.name,
        isTyping,
      });
    });

    // Handle Disconnect (mark offline in all joined rooms)
    socket.on("disconnecting", async () => {
      try {
        const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
        for (const roomId of rooms) {
          const isStillOnline = checkUserOnlineInRoom(io, roomId, socket.user._id, socket.id);
          if (!isStillOnline) {
            await Room.updateOne(
              { _id: roomId, "participants.userId": socket.user._id },
              { $set: { "participants.$.isOnline": false } }
            );

            const updatedRoom = await Room.findById(roomId);
            if (updatedRoom) {
              io.to(roomId).emit("presence-update", {
                roomId,
                participants: updatedRoom.participants,
              });
            }
          }
        }
      } catch (error) {
        console.error("Disconnect presence error:", error);
      }
    });
  });
};
