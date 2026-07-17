import Room from "../models/room.js";
import RoomMessage from "../models/roomMessage.js";

// Create room
export const createRoom = async (req, res) => {
  try {
    const { name } = req.body;
    const room = new Room({
      name: name || "Untitled Room",
      createdBy: req.user._id,
      participants: [
        {
          userId: req.user._id,
          userName: req.user.name,
          role: "owner",
          isOnline: false,
        },
      ],
    });
    await room.save();
    res.json({ success: true, room });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Join room via invite link
export const joinRoom = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const room = await Room.findOne({ inviteCode, isActive: true });
    if (!room) {
      return res.json({ success: false, message: "Room not found or invalid invite link" });
    }

    if (new Date() > room.inviteExpiresAt) {
      return res.json({ success: false, message: "Invite link has expired" });
    }

    const isAlreadyParticipant = room.participants.some(
      (p) => p.userId.toString() === req.user._id.toString()
    );

    if (!isAlreadyParticipant) {
      room.participants.push({
        userId: req.user._id,
        userName: req.user.name,
        role: "member",
        isOnline: false,
      });
      await room.save();
    }

    res.json({ success: true, room });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// List user's rooms
export const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      "participants.userId": req.user._id,
      isActive: true,
    }).sort({ updatedAt: -1 });
    res.json({ success: true, rooms });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get room details
export const getRoomDetails = async (req, res) => {
  try {
    res.json({ success: true, room: req.room });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get room messages (paginated)
export const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const messages = await RoomMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Reverse to chronological order
    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Update room settings
export const updateRoomSettings = async (req, res) => {
  try {
    const { name, aiEnabled } = req.body;
    const room = req.room;

    // Verify user is owner or admin
    const participant = room.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );
    if (!participant || (participant.role !== "owner" && participant.role !== "admin")) {
      return res.json({ success: false, message: "Only owners or admins can update settings" });
    }

    if (name !== undefined) room.name = name;
    if (aiEnabled !== undefined) room.aiEnabled = aiEnabled;

    await room.save();
    res.json({ success: true, room });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

