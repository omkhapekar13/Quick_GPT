import React, { useEffect, useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { useNavigate } from "react-router-dom";
import CreateRoomModal from "../components/CreateRoomModal";
import JoinRoomModal from "../components/JoinRoomModal";
import moment from "moment";

const RoomList = () => {
  const { roomList, fetchRooms, unreadCounts } = useRoomContext();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <div className="p-6 pt-12 xl:px-12 2xl:px-20 w-full mx-auto h-full overflow-y-scroll">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Collaborative Rooms</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Brainstorm and work together in real-time.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsJoinOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#2A2633] border border-gray-300 dark:border-[#80609F]/20 hover:bg-gray-200 dark:hover:bg-[#353040] rounded-md transition-colors cursor-pointer"
          >
            Join Room
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#A456F7] to-[#3D81F6] hover:opacity-90 rounded-md transition-opacity cursor-pointer"
          >
            Create Room
          </button>
        </div>
      </div>

      {roomList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {roomList.map((room) => {
            const onlineCount = room.participants.filter((p) => p.isOnline).length;
            const isOwner = room.participants.find((p) => p.role === "owner");
            const unreadCount = unreadCounts?.[room._id] || 0;

            return (
              <div
                key={room._id}
                onClick={() => navigate(`/room/${room._id}`)}
                className="p-5 bg-white dark:bg-[#1E1B24]/40 border border-gray-200 dark:border-[#80609F]/15 rounded-xl shadow-sm hover:shadow-md hover:border-purple-400 transition-all cursor-pointer flex flex-col justify-between relative"
              >
                {unreadCount > 0 && (
                  <span className="absolute top-3 right-3 inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-bold leading-none text-white bg-purple-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate pr-6">
                    {room.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Created by {isOwner ? isOwner.userName : "Unknown"}
                  </p>
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-full">
                    {onlineCount} Online
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {room.participants.length} Participants
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">
            You are not in any collaborative rooms yet.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#A456F7] to-[#3D81F6] hover:opacity-90 rounded-md transition-opacity cursor-pointer"
          >
            Create Your First Room
          </button>
        </div>
      )}

      <CreateRoomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <JoinRoomModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
    </div>
  );
};

export default RoomList;
