import Room from "../models/room.js";

export const roomMember = async (req, res, next) => {
  try {
    const roomId = req.params.roomId || req.body.roomId;
    if (!roomId) {
      return res.json({ success: false, message: "Room ID is required" });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.json({ success: false, message: "Room not found" });
    }

    const isMember = room.participants.some(
      (p) => p.userId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.json({ success: false, message: "You are not a member of this room" });
    }

    req.room = room;
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
