import React from "react";
import { useRoomContext } from "../context/RoomContext";

const ParticipantsList = () => {
  const { participants } = useRoomContext();

  return (
    <div className="w-64 h-full border-l border-gray-200 dark:border-[#80609F]/30 bg-white/50 dark:bg-[#1E1B24]/30 backdrop-blur-md p-4 hidden lg:flex flex-col">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        Participants ({participants.length})
      </h3>
      <div className="flex-1 overflow-y-auto space-y-3">
        {participants.map((p, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="relative">
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#A456F7] to-[#3D81F6] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-sm">
                {p.userName.slice(0, 2)}
              </div>
              {/* Online indicator dot */}
              <span
                className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#1E1B24] ${
                  p.isOnline ? "bg-green-500" : "bg-gray-400 dark:bg-gray-600"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {p.userName}
              </p>
              <p className="text-[10px] text-gray-400 capitalize">
                {p.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantsList;
