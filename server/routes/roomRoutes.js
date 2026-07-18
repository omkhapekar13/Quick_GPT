import express from "express";
import { protect } from "../middlewares/auth.js";
import { roomMember } from "../middlewares/roomMember.js";
import {
  createRoom,
  joinRoom,
  getRooms,
  getRoomDetails,
  getRoomMessages,
  updateRoomSettings,
  regenerateInvite,
  leaveRoom,
  deleteRoom,
  kickParticipant,
  updateParticipantRole,
} from "../controllers/roomController.js";
import {
  generateRoomSummary,
  getRoomSummaries,
} from "../controllers/summaryController.js";

const roomRouter = express.Router();

// Memory store for brute forcing protection on invite links (max 5 join attempts per minute per IP)
const joinAttemptsStore = {};

const joinRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();
  const oneMinute = 60 * 1000;

  if (!joinAttemptsStore[ip]) {
    joinAttemptsStore[ip] = [];
  }

  // Filter out attempts older than 1 minute
  joinAttemptsStore[ip] = joinAttemptsStore[ip].filter((time) => now - time < oneMinute);

  if (joinAttemptsStore[ip].length >= 5) {
    return res.json({
      success: false,
      message: "Too many join attempts. Please wait a minute before trying again.",
    });
  }

  joinAttemptsStore[ip].push(now);
  next();
};

roomRouter.post("/create", protect, createRoom);
roomRouter.post("/join/:inviteCode", protect, joinRateLimiter, joinRoom);
roomRouter.get("/list", protect, getRooms);
roomRouter.get("/:roomId", protect, roomMember, getRoomDetails);
roomRouter.get("/:roomId/messages", protect, roomMember, getRoomMessages);
roomRouter.patch("/:roomId", protect, roomMember, updateRoomSettings);
roomRouter.post("/:roomId/regenerate-invite", protect, roomMember, regenerateInvite);
roomRouter.post("/:roomId/leave", protect, roomMember, leaveRoom);
roomRouter.delete("/:roomId", protect, roomMember, deleteRoom);
roomRouter.post("/:roomId/kick", protect, roomMember, kickParticipant);
roomRouter.post("/:roomId/participant/role", protect, roomMember, updateParticipantRole);
roomRouter.post("/:roomId/summary", protect, roomMember, generateRoomSummary);
roomRouter.get("/:roomId/summaries", protect, roomMember, getRoomSummaries);

export default roomRouter;

