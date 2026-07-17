import mongoose from "mongoose";
import { nanoid } from "nanoid";

const participantSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName:  { type: String, required: true },
  role:      { type: String, enum: ["owner", "admin", "member"], default: "member" },
  joinedAt:  { type: Date, default: Date.now },
  isOnline:  { type: Boolean, default: false },
}, { _id: false });

const roomSchema = new mongoose.Schema({
  name:           { type: String, required: true, default: "Untitled Room" },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  inviteCode:     { type: String, unique: true, required: true, default: () => nanoid(8) },
  inviteExpiresAt:{ type: Date, required: true, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days
  accessControl:  { type: String, enum: ["public", "approved"], default: "public" },
  aiEnabled:      { type: Boolean, default: true },
  aiContextDepth: { type: Number, default: 20 },
  participants:   [participantSchema],
  isActive:       { type: Boolean, default: true },
}, { timestamps: true });

roomSchema.index({ "participants.userId": 1 });

const Room = mongoose.model("Room", roomSchema);
export default Room;
