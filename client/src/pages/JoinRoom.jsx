import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoomContext } from "../context/RoomContext";
import Loading from "./Loading";

const JoinRoom = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { joinRoomViaLink } = useRoomContext();
  const [error, setError] = useState(null);

  useEffect(() => {
    const runJoin = async () => {
      try {
        const roomId = await joinRoomViaLink(inviteCode);
        if (roomId) {
          navigate(`/room/${roomId}`);
        } else {
          setError("Failed to join room. Link may be invalid or expired.");
        }
      } catch (err) {
        setError(err.message || "An error occurred while joining.");
      }
    };
    
    if (inviteCode) {
      runJoin();
    }
  }, [inviteCode]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg text-red-500 font-semibold mb-4">{error}</p>
        <button
          onClick={() => navigate("/rooms")}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#A456F7] hover:opacity-90 rounded-md transition-opacity cursor-pointer"
        >
          Go to Rooms List
        </button>
      </div>
    );
  }

  return <Loading />;
};

export default JoinRoom;
