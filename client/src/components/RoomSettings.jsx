import React, { useEffect, useState } from "react";
import { useRoomContext } from "../context/RoomContext";

const RoomSettings = ({ isOpen, onClose }) => {
  const { activeRoom, patchRoomSettings } = useRoomContext();
  const [name, setName] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeRoom) {
      setName(activeRoom.name);
      setAiEnabled(activeRoom.aiEnabled);
    }
  }, [activeRoom, isOpen]);

  if (!isOpen || !activeRoom) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const updated = await patchRoomSettings(activeRoom._id, { name: name.trim(), aiEnabled });
    setLoading(false);
    if (updated) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white dark:bg-[#1E1B24] border border-gray-200 dark:border-[#80609F]/30 rounded-xl shadow-2xl mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Room Settings</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-[#2A2633] border border-gray-300 dark:border-[#80609F]/20 rounded-md outline-none focus:ring-2 focus:ring-[#A456F7] dark:text-white"
              required
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2A2633] rounded-lg border border-gray-100 dark:border-[#80609F]/10">
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-white">
                Enable AI Assistant
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Allows triggering AI using @ai tag.
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="sr-only peer"
                disabled={loading}
              />
              <div className="w-9 h-5 bg-gray-400 rounded-full peer-checked:bg-purple-600 transition-all"></div>
              <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
            </label>
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
              {loading ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoomSettings;
