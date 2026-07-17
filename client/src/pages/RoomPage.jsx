import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useRoomContext } from "../context/RoomContext";
import RoomChat from "../components/RoomChat";
import ParticipantsList from "../components/ParticipantsList";

const RoomPage = () => {
  const { roomId } = useParams();
  const { selectRoom } = useRoomContext();

  useEffect(() => {
    selectRoom(roomId);
    return () => {
      selectRoom(null);
    };
  }, [roomId]);

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-white dark:bg-[#121012]">
      <RoomChat />
      <ParticipantsList />
    </div>
  );
};

export default RoomPage;
