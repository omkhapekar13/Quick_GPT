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
} from "../controllers/roomController.js";

const roomRouter = express.Router();

roomRouter.post("/create", protect, createRoom);
roomRouter.post("/join/:inviteCode", protect, joinRoom);
roomRouter.get("/list", protect, getRooms);
roomRouter.get("/:roomId", protect, roomMember, getRoomDetails);
roomRouter.get("/:roomId/messages", protect, roomMember, getRoomMessages);
roomRouter.patch("/:roomId", protect, roomMember, updateRoomSettings);

export default roomRouter;
