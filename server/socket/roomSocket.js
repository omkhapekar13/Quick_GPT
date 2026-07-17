import { socketAuthMiddleware } from "../middlewares/socketAuth.js";
import Room from "../models/room.js";
import RoomMessage from "../models/roomMessage.js";
import User from "../models/user.js";
import openai from "../configs/openai.js";

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

        socket.to(roomId).emit("user-joined", {
          userId: socket.user._id,
          userName: socket.user.name,
        });
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // Leave Room
    socket.on("leave-room", async ({ roomId }) => {
      try {
        socket.leave(roomId);

        // Mark user as offline
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

        socket.to(roomId).emit("user-left", {
          userId: socket.user._id,
          userName: socket.user.name,
        });
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

        // Check if message mentions @ai and room has AI enabled
        const mentionsAI = /(?:^|[^a-zA-Z0-9_])@ai(?![a-zA-Z0-9_])/i.test(content);
        if (mentionsAI && room.aiEnabled) {
          const user = await User.findById(socket.user._id);
          if (!user || user.credits < 1) {
            return socket.emit("error", { message: "You don't have enough credits to trigger AI" });
          }

          // Emit ai-typing to room
          io.to(roomId).emit("ai-typing", { roomId, isTyping: true });

          try {
            const depth = room.aiContextDepth || 20;
            const history = await RoomMessage.find({ roomId })
              .sort({ createdAt: -1 })
              .limit(depth)
              .lean();

            history.reverse();

            const participantNames = room.participants.map((p) => p.userName).join(", ");
            const systemPrompt = `You are an AI assistant in a group chat room called "${room.name}". 
Multiple users are chatting. Respond helpfully and concisely. Address the user who mentioned you.
The participants are: ${participantNames}.`;

            const messagesPayload = [
              { role: "system", content: systemPrompt },
              ...history.map((m) => ({
                role: m.senderType === "ai" ? "assistant" : "user",
                content: `[${m.senderName}]: ${m.content}`,
              })),
            ];

            const response = await openai.chat.completions.create({
              model: "gemini-2.5-flash",
              messages: messagesPayload,
            });

            const aiResponseText = response.choices[0].message.content;

            const aiMsg = await RoomMessage.create({
              roomId,
              senderType: "ai",
              senderName: "AI Assistant",
              content: aiResponseText,
              mentions: [],
            });

            io.to(roomId).emit("new-message", aiMsg);

            await User.updateOne({ _id: socket.user._id }, { $inc: { credits: -1 } });
            const updatedUser = await User.findById(socket.user._id);
            socket.emit("credits-update", { credits: updatedUser.credits });

          } catch (aiError) {
            console.error("AI Error:", aiError);
            socket.emit("error", { message: "Failed to get AI response: " + aiError.message });
          } finally {
            io.to(roomId).emit("ai-typing", { roomId, isTyping: false });
          }
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
            socket.to(roomId).emit("user-left", {
              userId: socket.user._id,
              userName: socket.user.name,
            });
          }
        }
      } catch (error) {
        console.error("Disconnect presence error:", error);
      }
    });
  });
};
