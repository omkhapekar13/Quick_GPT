import { createContext, useContext, useEffect, useRef, useReducer } from "react";
import { io } from "socket.io-client";
import { useAppContext } from "./AppContext";
import toast from "react-hot-toast";

const RoomContext = createContext();

const initialState = {
  roomList: [],
  activeRoom: null,
  messages: [],
  participants: [],
  typingUsers: [],
  isAITyping: false,
  summaries: [],
  isGeneratingSummary: false,
};

function roomReducer(state, action) {
  switch (action.type) {
    case "SET_ROOMS":
      return { ...state, roomList: action.payload };
    case "SET_ACTIVE_ROOM":
      return { ...state, activeRoom: action.payload };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "ADD_MESSAGE":
      if (state.messages.some((m) => m._id === action.payload._id)) {
        return state;
      }
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_PARTICIPANTS":
      return { ...state, participants: action.payload };
    case "UPDATE_PRESENCE": {
      const { roomId, participants } = action.payload;
      const updatedRoomList = state.roomList.map((r) =>
        r._id === roomId ? { ...r, participants } : r
      );
      return {
        ...state,
        participants: state.activeRoom?._id === roomId ? participants : state.participants,
        roomList: updatedRoomList,
      };
    }
    case "SET_TYPING": {
      const { userId, userName, isTyping } = action.payload;
      const filtered = state.typingUsers.filter((u) => u.userId !== userId);
      if (isTyping) {
        return {
          ...state,
          typingUsers: [...filtered, { userId, userName }],
        };
      } else {
        return {
          ...state,
          typingUsers: filtered,
        };
      }
    }
    case "SET_AI_TYPING":
      return { ...state, isAITyping: action.payload };
    case "SET_AI_TYPING_EVENT":
      if (state.activeRoom?._id === action.payload.roomId) {
        return { ...state, isAITyping: action.payload.isTyping };
      }
      return state;
    case "UPDATE_ROOM": {
      const updatedRoom = action.payload;
      const updatedRoomList = state.roomList.map((r) =>
        r._id === updatedRoom._id ? updatedRoom : r
      );
      return {
        ...state,
        roomList: updatedRoomList,
        activeRoom: state.activeRoom?._id === updatedRoom._id ? updatedRoom : state.activeRoom,
      };
    }
    case "SET_SUMMARIES":
      return { ...state, summaries: action.payload };
    case "ADD_SUMMARY":
      return { ...state, summaries: [action.payload, ...state.summaries] };
    case "SET_GENERATING_SUMMARY":
      return { ...state, isGeneratingSummary: action.payload };
    case "CLEAR_ROOM_STATE":
      return {
        ...state,
        activeRoom: null,
        messages: [],
        participants: [],
        typingUsers: [],
        isAITyping: false,
        summaries: [],
        isGeneratingSummary: false,
      };
    default:
      return state;
  }
}

export const RoomContextProvider = ({ children }) => {
  const { token, axios, setUser } = useAppContext();
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      dispatch({ type: "CLEAR_ROOM_STATE" });
      return;
    }

    const socketUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    const socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    socket.on("new-message", (msg) => {
      dispatch({ type: "ADD_MESSAGE", payload: msg });
    });

    socket.on("user-typing", (data) => {
      dispatch({ type: "SET_TYPING", payload: data });
    });

    socket.on("presence-update", (data) => {
      dispatch({ type: "UPDATE_PRESENCE", payload: data });
    });

    socket.on("credits-update", (data) => {
      setUser((prev) => (prev ? { ...prev, credits: data.credits } : prev));
    });

    socket.on("ai-typing", (data) => {
      dispatch({ type: "SET_AI_TYPING_EVENT", payload: data });
    });

    socket.on("error", (data) => {
      toast.error(data.message || "Socket error occurred");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const fetchRooms = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get("/api/room/list", {
        headers: { Authorization: token },
      });
      if (data.success) {
        dispatch({ type: "SET_ROOMS", payload: data.rooms });
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const fetchMessages = async (roomId) => {
    if (!token) return;
    try {
      const { data } = await axios.get(`/api/room/${roomId}/messages`, {
        headers: { Authorization: token },
      });
      if (data.success) {
        dispatch({ type: "SET_MESSAGES", payload: data.messages });
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const selectRoom = async (roomId) => {
    if (!token) return;
    if (state.activeRoom?._id === roomId) return;

    if (state.activeRoom && socketRef.current) {
      socketRef.current.emit("leave-room", { roomId: state.activeRoom._id });
    }

    if (!roomId) {
      dispatch({ type: "CLEAR_ROOM_STATE" });
      return;
    }

    try {
      const { data } = await axios.get(`/api/room/${roomId}`, {
        headers: { Authorization: token },
      });
      if (data.success) {
        dispatch({ type: "SET_ACTIVE_ROOM", payload: data.room });
        dispatch({ type: "SET_PARTICIPANTS", payload: data.room.participants });
        await fetchMessages(roomId);

        if (socketRef.current) {
          socketRef.current.emit("join-room", { roomId });
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sendRoomMessage = (roomId, content) => {
    if (socketRef.current) {
      socketRef.current.emit("send-message", { roomId, content });
    }
  };

  const sendRoomTyping = (roomId, isTyping) => {
    if (socketRef.current) {
      socketRef.current.emit("typing", { roomId, isTyping });
    }
  };

  const joinRoomViaLink = async (inviteCode) => {
    if (!token) return null;
    try {
      const { data } = await axios.post(`/api/room/join/${inviteCode}`, {}, {
        headers: { Authorization: token },
      });
      if (data.success) {
        toast.success("Successfully joined the room!");
        await fetchRooms();
        return data.room._id;
      } else {
        toast.error(data.message);
        return null;
      }
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const createRoom = async (name) => {
    if (!token) return null;
    try {
      const { data } = await axios.post("/api/room/create", { name }, {
        headers: { Authorization: token },
      });
      if (data.success) {
        toast.success("Room created successfully!");
        await fetchRooms();
        return data.room._id;
      } else {
        toast.error(data.message);
        return null;
      }
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const patchRoomSettings = async (roomId, settings) => {
    if (!token) return null;
    try {
      const { data } = await axios.patch(`/api/room/${roomId}`, settings, {
        headers: { Authorization: token },
      });
      if (data.success) {
        toast.success("Room settings updated successfully!");
        dispatch({ type: "UPDATE_ROOM", payload: data.room });
        return data.room;
      } else {
        toast.error(data.message);
        return null;
      }
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const fetchSummaries = async (roomId) => {
    if (!token) return;
    try {
      const { data } = await axios.get(`/api/room/${roomId}/summaries`, {
        headers: { Authorization: token },
      });
      if (data.success) {
        dispatch({ type: "SET_SUMMARIES", payload: data.summaries });
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const generateSummary = async (roomId) => {
    if (!token) return null;
    dispatch({ type: "SET_GENERATING_SUMMARY", payload: true });
    try {
      const { data } = await axios.post(`/api/room/${roomId}/summary`, {}, {
        headers: { Authorization: token },
      });
      if (data.success) {
        toast.success("Summary generated successfully!");
        dispatch({ type: "ADD_SUMMARY", payload: data.summary });
        setUser((prev) => (prev ? { ...prev, credits: data.credits } : prev));
        return data.summary;
      } else {
        toast.error(data.message);
        return null;
      }
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      dispatch({ type: "SET_GENERATING_SUMMARY", payload: false });
    }
  };

  return (
    <RoomContext.Provider
      value={{
        ...state,
        fetchRooms,
        selectRoom,
        sendRoomMessage,
        sendRoomTyping,
        joinRoomViaLink,
        createRoom,
        patchRoomSettings,
        fetchSummaries,
        generateSummary,
        socket: socketRef.current,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoomContext = () => useContext(RoomContext);
