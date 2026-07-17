import React, { useEffect, useRef, useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import moment from "moment";
import Markdown from "react-markdown";
import Prism from "prismjs";
import TypingIndicator from "./TypingIndicator";
import InviteModal from "./InviteModal";

const RoomChat = () => {
  const { user, theme } = useAppContext();
  const { activeRoom, messages, sendRoomMessage, sendRoomTyping, typingUsers, participants } = useRoomContext();
  
  const [prompt, setPrompt] = useState("");
  const [isTypingState, setIsTypingState] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  const containerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Syntax highlighting for code blocks
  useEffect(() => {
    Prism.highlightAll();
  }, [messages]);

  if (!activeRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-primary">
        <img
          src={theme === "dark" ? assets.logo_full : assets.logo_full_dark}
          alt="Logo"
          className="w-full max-w-56 sm:max-w-68"
        />
        <p className="mt-5 text-4xl sm:text-6xl text-center text-gray-400 dark:text-white">
          No Room Selected
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select or create a collaborative room from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const val = e.target.value;
    setPrompt(val);

    if (!isTypingState) {
      setIsTypingState(true);
      sendRoomTyping(activeRoom._id, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingState(false);
      sendRoomTyping(activeRoom._id, false);
    }, 2000);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Clear typing timeout and emit false immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTypingState(false);
    sendRoomTyping(activeRoom._id, false);

    sendRoomMessage(activeRoom._id, prompt.trim());
    setPrompt("");
  };

  // Filter typing users to exclude self
  const otherTypingUsers = typingUsers.filter((u) => u.userId !== user?._id);

  return (
    <div className="flex-1 flex flex-col justify-between min-h-0 overflow-hidden m-5 md:m-10 max-md:mt-14">
      {/* Room Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-[#80609F]/30">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{activeRoom.name}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {participants.length} participants · {participants.filter(p => p.isOnline).length} online
          </p>
        </div>
        <button
          onClick={() => setIsInviteOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#A456F7] hover:opacity-90 rounded-md transition-opacity cursor-pointer"
        >
          <img src={assets.share_icon || assets.gallery_icon} className="w-3.5 invert" alt="" />
          Invite Link
        </button>
      </div>

      {/* Chat Messages */}
      <div ref={containerRef} className="flex-1 my-5 overflow-y-scroll space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-primary">
            <p className="text-xl text-center text-gray-400 dark:text-gray-500">
              Welcome to {activeRoom.name}!
            </p>
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              Send a message to start the collaborative discussion.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isSelf = message.senderId === user?._id;
            const isSystem = message.senderType === "system";

            if (isSystem) {
              return (
                <div key={message._id} className="text-center text-xs text-gray-400 my-2 italic">
                  {message.content}
                </div>
              );
            }

            return (
              <div
                key={message._id}
                className={`flex items-start gap-2.5 my-3 ${isSelf ? "justify-end" : "justify-start"}`}
              >
                {!isSelf && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3D81F6] to-[#A456F7] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-sm">
                    {message.senderName.slice(0, 2)}
                  </div>
                )}
                <div
                  className={`flex flex-col gap-1.5 p-3 px-4 rounded-lg max-w-xl shadow-sm border ${
                    isSelf
                      ? "bg-slate-50 dark:bg-[#57317C]/30 border-[#80609F]/30 text-gray-800 dark:text-white"
                      : "bg-[#A456F7]/10 dark:bg-[#57317C]/20 border-gray-300 dark:border-[#80609F]/15 text-gray-800 dark:text-white"
                  }`}
                >
                  {!isSelf && (
                    <span className="text-[10px] font-bold text-[#A456F7]">
                      {message.senderName}
                    </span>
                  )}
                  <div className="text-sm reset-tw">
                    <Markdown>{message.content}</Markdown>
                  </div>
                  <span className="text-[9px] text-gray-400 dark:text-[#B1A6C0] self-end mt-0.5">
                    {moment(message.createdAt).fromNow()}
                  </span>
                </div>
                {isSelf && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#A456F7] to-[#3D81F6] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-sm">
                    {message.senderName.slice(0, 2)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={otherTypingUsers} />

      {/* Prompt / Message box */}
      <form
        onSubmit={onSubmit}
        className="bg-primary/20 dark:bg-[#583C79]/30 border border-primary dark:border-[#80609F]/30 rounded-full w-full max-w-3xl p-3 pl-5 mx-auto flex gap-4 items-center"
      >
        <input
          onChange={handleInputChange}
          value={prompt}
          type="text"
          placeholder="Type your message here..."
          className="flex-1 w-full text-sm outline-none dark:text-white"
          required
        />
        <button type="submit" className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <img src={assets.send_icon} className="w-7 cursor-pointer" alt="Send" />
        </button>
      </form>

      {/* Invite Link Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        inviteCode={activeRoom.inviteCode}
        inviteExpiresAt={activeRoom.inviteExpiresAt}
      />
    </div>
  );
};

export default RoomChat;
