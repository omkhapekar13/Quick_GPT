import React, { useEffect, useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { useAppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";

const RoomSettings = ({ isOpen, onClose }) => {
  const { activeRoom, patchRoomSettings, leaveRoom, deleteRoom, participants, kickParticipant, updateParticipantRole } = useRoomContext();
  const { user } = useAppContext();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeRoom) {
      setName(activeRoom.name);
      setAiEnabled(activeRoom.aiEnabled);
    }
    // Reset confirmations when modal opens/closes
    setShowLeaveConfirm(false);
    setShowDeleteConfirm(false);
  }, [activeRoom, isOpen]);

  if (!isOpen || !activeRoom) return null;

  // Check current user's role
  const currentUserPart = participants.find((p) => p.userId?.toString() === user?._id?.toString());
  const isOwner = currentUserPart?.role === "owner";
  const isOwnerOrAdmin = currentUserPart && (currentUserPart.role === "owner" || currentUserPart.role === "admin");

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

  const handleLeave = async () => {
    setActionLoading(true);
    const success = await leaveRoom(activeRoom._id);
    setActionLoading(false);
    if (success) {
      onClose();
      navigate("/rooms");
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    const success = await deleteRoom(activeRoom._id);
    setActionLoading(false);
    if (success) {
      onClose();
      navigate("/rooms");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white dark:bg-[#1E1B24] border border-gray-200 dark:border-[#80609F]/30 rounded-xl shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Room Settings</h2>

        {/* Settings Form (owner/admin only) */}
        {isOwnerOrAdmin && (
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
        )}

        {/* Manage Participants (owner/admin only) */}
        {isOwnerOrAdmin && (
          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-[#80609F]/20">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Manage Participants ({participants.length})
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {participants.map((p) => {
                const isMe = p.userId?.toString() === user?._id?.toString();
                return (
                  <div key={p.userId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-[#2A2633] text-xs">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                        {p.userName} {isMe && "(You)"}
                      </span>
                      <span className="text-[10px] text-gray-400 capitalize">
                        {p.role}
                      </span>
                    </div>

                    {!isMe && (
                      <div className="flex gap-2">
                        {/* Owner only actions: Promote/Demote */}
                        {isOwner && (
                          <>
                            {p.role === "member" && (
                              <button
                                type="button"
                                onClick={() => updateParticipantRole(activeRoom._id, p.userId, "admin")}
                                className="px-2 py-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                              >
                                Promote
                              </button>
                            )}
                            {p.role === "admin" && (
                              <button
                                type="button"
                                onClick={() => updateParticipantRole(activeRoom._id, p.userId, "member")}
                                className="px-2 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors"
                              >
                                Demote
                              </button>
                            )}
                          </>
                        )}

                        {/* Kick action (Owner can kick admin & member, Admin can only kick member) */}
                        {(isOwner || (currentUserPart?.role === "admin" && p.role === "member")) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to kick ${p.userName}?`)) {
                                kickParticipant(activeRoom._id, p.userId);
                              }
                            }}
                            className="px-2 py-1 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          >
                            Kick
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Danger Zone — Leave & Delete */}
        <div className={`${isOwnerOrAdmin ? "mt-6 pt-5 border-t border-gray-200 dark:border-[#80609F]/20" : ""}`}>
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Danger Zone
          </h3>

          <div className="space-y-3">
            {/* Leave Room */}
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-md transition-colors text-left"
              >
                🚪 Leave Room
              </button>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/30 rounded-lg space-y-2">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {isOwner
                    ? "⚠️ As the owner, leaving will transfer ownership to another participant. Are you sure?"
                    : "⚠️ You'll lose access to this room. You can rejoin later if you have the invite link."}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleLeave}
                    disabled={actionLoading}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-md transition-colors"
                  >
                    {actionLoading ? "Leaving..." : "Confirm Leave"}
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2633] hover:bg-gray-200 dark:hover:bg-[#353040] rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Delete Room (Owner only) */}
            {isOwner && (
              <>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors text-left"
                  >
                    🗑️ Delete Room
                  </button>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/30 rounded-lg space-y-2">
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      ⛔ This will permanently deactivate the room for all participants. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md transition-colors"
                      >
                        {actionLoading ? "Deleting..." : "Confirm Delete"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2633] hover:bg-gray-200 dark:hover:bg-[#353040] rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Close button for non-owner/admin users */}
        {!isOwnerOrAdmin && (
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2633] hover:bg-gray-200 dark:hover:bg-[#353040] rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomSettings;

