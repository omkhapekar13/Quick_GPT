import mongoose from "mongoose";

const roomMessageSchema = new mongoose.Schema({
  roomId:     { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  senderType: { type: String, enum: ["user", "ai", "system"], required: true },
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },    // null for AI/system
  senderName: { type: String, required: true },                          // "AI Assistant" for ai
  content:    { type: String, required: true },
  mentions:   [{ type: String }],                                        // ["ai", "userId1", ...]
  isImage:    { type: Boolean, default: false },
  parentMsgId:{ type: mongoose.Schema.Types.ObjectId, ref: "RoomMessage" }, // optional reply-to
  isVectorIndexed: { type: Boolean, default: false },
}, { timestamps: true });

roomMessageSchema.index({ roomId: 1, createdAt: 1 });
roomMessageSchema.index({ roomId: 1, isVectorIndexed: 1 });

const RoomMessage = mongoose.model("RoomMessage", roomMessageSchema);
export default RoomMessage;
