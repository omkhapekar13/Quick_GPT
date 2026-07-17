import React, { useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { useNavigate } from "react-router-dom";

const CreateRoomModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { createRoom } = useRoomContext();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const roomId = await createRoom(name);
    setLoading(false);
    if (roomId) {
      onClose();
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white dark:bg-[#1E1B24] border border-gray-200 dark:border-[#80609F]/30 rounded-xl shadow-2xl mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Create Collab Room</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Room Name
            </label>
            <input
              type="text"
              placeholder="e.g. Project brainstorm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-[#2A2633] border border-gray-300 dark:border-[#80609F]/20 rounded-md outline-none focus:ring-2 focus:ring-[#A456F7] dark:text-white"
              required
              disabled={loading}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2633] hover:bg-gray-200 dark:hover:bg-[#353040] rounded-md transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#A456F7] to-[#3D81F6] hover:opacity-90 rounded-md transition-opacity"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
