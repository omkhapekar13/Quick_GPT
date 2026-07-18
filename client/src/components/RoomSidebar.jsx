import React, { useEffect, useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import CreateRoomModal from "./CreateRoomModal";
import JoinRoomModal from "./JoinRoomModal";

const RoomSidebar = () => {
  const { roomList, fetchRooms, selectRoom, activeRoom, unreadCounts } = useRoomContext();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const filteredRooms = roomList.filter((room) =>
    room.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex-1 flex justify-center items-center py-2 text-white bg-gradient-to-r from-[#3D81F6] to-[#A456F7] text-sm rounded-md cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="mr-1 text-lg">+</span>Create
        </button>
        <button
          onClick={() => setIsJoinOpen(true)}
          className="flex-1 flex justify-center items-center py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#2A2633] border border-gray-300 dark:border-[#80609F]/20 text-sm rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-[#353040] transition-colors"
        >
          Join
        </button>
      </div>

      {/* Search Rooms */}
      <div className="flex items-center gap-2 p-2 mt-4 border border-gray-400 dark:border-white/20 rounded-md">
        <input
          onChange={(e) => setSearch(e.target.value)}
          value={search}
          type="text"
          placeholder="Search Rooms"
          className="text-xs placeholder:text-gray-400 outline-none w-full dark:text-white"
        />
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-scroll mt-4 text-sm space-y-3 pr-1">
        {filteredRooms.length > 0 ? (
          filteredRooms.map((room) => {
            const isActive = activeRoom?._id === room._id;
            const onlineCount = room.participants.filter((p) => p.isOnline).length;
            const unreadCount = unreadCounts?.[room._id] || 0;

            return (
              <div
                onClick={() => {
                  navigate(`/room/${room._id}`);
                }}
                key={room._id}
                className={`p-3 px-4 rounded-md cursor-pointer border transition-all flex justify-between items-center ${
                  isActive
                     ? "bg-[#A456F7]/25 border-[#A456F7]/60"
                    : "dark:bg-[#57317C]/10 border-gray-300 dark:border-[#80609F]/15 hover:border-purple-400"
                }`}
              >
                <div className="truncate flex-1">
                  <p className="font-medium truncate text-gray-800 dark:text-white">{room.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#B1A6C0] mt-0.5">
                    {onlineCount} of {room.participants.length} online
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 ml-2">
                  <span className="text-[10px] text-gray-400">
                    {moment(room.updatedAt).fromNow(true)}
                  </span>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 py-0.5 text-[9px] font-bold text-white bg-purple-600 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-gray-500 text-center mt-4">No rooms found</p>
        )}
      </div>

      <CreateRoomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <JoinRoomModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
    </div>
  );
};

export default RoomSidebar;
