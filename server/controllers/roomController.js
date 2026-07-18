import Room from "../models/room.js";
import RoomMessage from "../models/roomMessage.js";
import { nanoid } from "nanoid";

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

      // Create system message for invite join
      const joinMsg = await RoomMessage.create({
        roomId: room._id,
        senderType: "system",
        senderName: "System",
        content: `${req.user.name} joined the room`,
      });

      if (req.io) {
        req.io.to(room._id.toString()).emit("new-message", joinMsg);
        req.io.to(room._id.toString()).emit("presence-update", {
          roomId: room._id.toString(),
          participants: room.participants,
        });
        req.io.to(room._id.toString()).emit("user-joined", {
          userId: req.user._id,
          userName: req.user.name,
        });
      }
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

// Get room messages (paginated or sync-since)
export const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { since } = req.query;

    if (since) {
      const messages = await RoomMessage.find({
        roomId,
        createdAt: { $gt: new Date(since) },
      })
        .sort({ createdAt: 1 })
        .lean();
      return res.json({ success: true, messages });
    }

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

// Regenerate invite code (owner/admin only)
export const regenerateInvite = async (req, res) => {
  try {
    const room = req.room;

    // Verify user is owner or admin
    const participant = room.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );
    if (!participant || (participant.role !== "owner" && participant.role !== "admin")) {
      return res.json({ success: false, message: "Only owners or admins can regenerate the invite link" });
    }

    room.inviteCode = nanoid(8);
    room.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await room.save();

    res.json({ success: true, room });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Leave a room
export const leaveRoom = async (req, res) => {
  try {
    const room = req.room;
    const userId = req.user._id.toString();

    const participantIdx = room.participants.findIndex(
      (p) => p.userId.toString() === userId
    );
    if (participantIdx === -1) {
      return res.json({ success: false, message: "You are not a participant of this room" });
    }

    const leavingParticipant = room.participants[participantIdx];

    // Remove the participant
    room.participants.splice(participantIdx, 1);

    // If room is now empty, deactivate it
    if (room.participants.length === 0) {
      room.isActive = false;
      await room.save();
      return res.json({ success: true, message: "You left the room. Room has been deactivated (no participants remaining)." });
    }

    // If the leaving user was the owner, transfer ownership
    if (leavingParticipant.role === "owner") {
      // Prefer earliest admin, otherwise earliest member
      const newOwner =
        room.participants.find((p) => p.role === "admin") ||
        room.participants.reduce((earliest, p) =>
          new Date(p.joinedAt) < new Date(earliest.joinedAt) ? p : earliest
        );
      if (newOwner) {
        newOwner.role = "owner";
      }
    }

    await room.save();

    // Create system message for leave room button
    const leaveMsg = await RoomMessage.create({
      roomId: room._id,
      senderType: "system",
      senderName: "System",
      content: `${req.user.name} left the room`,
    });

    if (req.io) {
      req.io.to(room._id.toString()).emit("new-message", leaveMsg);
      req.io.to(room._id.toString()).emit("presence-update", {
        roomId: room._id.toString(),
        participants: room.participants,
      });
      req.io.to(room._id.toString()).emit("user-left", {
        userId: req.user._id,
        userName: req.user.name,
      });
    }

    res.json({ success: true, message: "You have left the room." });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Delete room (owner only)
export const deleteRoom = async (req, res) => {
  try {
    const room = req.room;

    // Verify user is owner
    const participant = room.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );
    if (!participant || participant.role !== "owner") {
      return res.json({ success: false, message: "Only the room owner can delete the room" });
    }

    room.isActive = false;
    await room.save();

    res.json({ success: true, message: "Room has been deleted." });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Kick participant from room (owner/admin only)
export const kickParticipant = async (req, res) => {
  try {
    const room = req.room;
    const { userId } = req.body;
    const requesterId = req.user._id.toString();

    if (!userId) {
      return res.json({ success: false, message: "Participant user ID is required" });
    }

    // Verify requester role
    const requester = room.participants.find(
      (p) => p.userId.toString() === requesterId
    );
    if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
      return res.json({ success: false, message: "Only owners or admins can kick members" });
    }

    // Find target
    const targetIdx = room.participants.findIndex(
      (p) => p.userId.toString() === userId.toString()
    );
    if (targetIdx === -1) {
      return res.json({ success: false, message: "User is not a participant of this room" });
    }

    const target = room.participants[targetIdx];

    // Admin cannot kick owner or other admins
    if (requester.role === "admin" && (target.role === "owner" || target.role === "admin")) {
      return res.json({ success: false, message: "Admins can only kick members" });
    }

    // Owner cannot kick themselves
    if (target.userId.toString() === requesterId) {
      return res.json({ success: false, message: "You cannot kick yourself" });
    }

    // Remove participant
    room.participants.splice(targetIdx, 1);
    await room.save();

    // Create system message for kick
    const kickMsg = await RoomMessage.create({
      roomId: room._id,
      senderType: "system",
      senderName: "System",
      content: `${target.userName} was kicked from the room`,
    });

    if (req.io) {
      req.io.to(room._id.toString()).emit("new-message", kickMsg);
      req.io.to(room._id.toString()).emit("presence-update", {
        roomId: room._id.toString(),
        participants: room.participants,
      });
      req.io.to(room._id.toString()).emit("user-kicked", {
        roomId: room._id.toString(),
        userId: target.userId.toString(),
        userName: target.userName,
      });
    }

    res.json({ success: true, room });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Update participant role (owner only)
export const updateParticipantRole = async (req, res) => {
  try {
    const room = req.room;
    const { userId, role } = req.body;
    const requesterId = req.user._id.toString();

    if (!userId || !role) {
      return res.json({ success: false, message: "User ID and role are required" });
    }

    if (role !== "admin" && role !== "member") {
      return res.json({ success: false, message: "Invalid role value. Must be 'admin' or 'member'" });
    }

    // Verify requester is owner
    const requester = room.participants.find(
      (p) => p.userId.toString() === requesterId
    );
    if (!requester || requester.role !== "owner") {
      return res.json({ success: false, message: "Only the room owner can update roles" });
    }

    // Find target
    const target = room.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );
    if (!target) {
      return res.json({ success: false, message: "User is not a participant of this room" });
    }

    if (target.userId.toString() === requesterId) {
      return res.json({ success: false, message: "You cannot change your own role" });
    }

    const oldRole = target.role;
    target.role = role;
    await room.save();

    // Create system message
    const actionWord = role === "admin" ? "promoted to admin" : "demoted to member";
    const roleMsg = await RoomMessage.create({
      roomId: room._id,
      senderType: "system",
      senderName: "System",
      content: `${target.userName} was ${actionWord}`,
    });

    if (req.io) {
      req.io.to(room._id.toString()).emit("new-message", roleMsg);
      req.io.to(room._id.toString()).emit("presence-update", {
        roomId: room._id.toString(),
        participants: room.participants,
      });
    }

    res.json({ success: true, room });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
