import React, { useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { useNavigate } from "react-router-dom";

const JoinRoomModal = ({ isOpen, onClose }) => {
  const { joinRoomViaLink } = useRoomContext();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const extractCode = (input) => {
    // Support both raw invite codes and full URLs like .../room/join/AbC12xyz
    const match = input.trim().match(/\/room\/join\/([A-Za-z0-9_-]+)\/?$/);
    return match ? match[1] : input.trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const inviteCode = extractCode(code);
    if (!inviteCode) return;

    setLoading(true);
    const roomId = await joinRoomViaLink(inviteCode);
    setLoading(false);

    if (roomId) {
      setCode("");
      onClose();
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white dark:bg-[#1E1B24] border border-gray-200 dark:border-[#80609F]/30 rounded-xl shadow-2xl mx-4">
        <h2 className="text-xl font-semibold mb-1 text-gray-800 dark:text-white">Join a Room</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Paste an invite link or code to join a collaborative room.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. AbC12xyz or https://…/room/join/AbC12xyz"
            className="w-full p-2.5 bg-gray-50 dark:bg-[#2A2633] border border-gray-300 dark:border-[#80609F]/20 rounded-md outline-none focus:ring-2 focus:ring-[#A456F7] dark:text-white text-sm"
            required
            disabled={loading}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setCode(""); onClose(); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2633] hover:bg-gray-200 dark:hover:bg-[#353040] rounded-md transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3D81F6] to-[#A456F7] hover:opacity-90 rounded-md transition-opacity"
              disabled={loading || !code.trim()}
            >
              {loading ? "Joining..." : "Join Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinRoomModal;
