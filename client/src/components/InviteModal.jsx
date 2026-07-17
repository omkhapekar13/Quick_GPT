import React, { useState } from "react";
import toast from "react-hot-toast";
import moment from "moment";

const InviteModal = ({ isOpen, onClose, inviteCode, inviteExpiresAt }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const inviteLink = `${window.location.origin}/room/join/${inviteCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white dark:bg-[#1E1B24] border border-gray-200 dark:border-[#80609F]/30 rounded-xl shadow-2xl mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Invite Participants</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Share this link with others to let them join your collaborative room.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 p-2 text-xs bg-gray-50 dark:bg-[#2A2633] border border-gray-300 dark:border-[#80609F]/20 rounded-md outline-none dark:text-white truncate"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#A456F7] hover:opacity-90 rounded-md transition-opacity shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Expires: {moment(inviteExpiresAt).format("MMMM Do YYYY, h:mm a")} ({moment(inviteExpiresAt).fromNow()})
          </p>
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2633] hover:bg-gray-200 dark:hover:bg-[#353040] rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
