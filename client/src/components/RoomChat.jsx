import React, { useEffect, useRef, useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import moment from "moment";
import Markdown from "react-markdown";
import Prism from "prismjs";
import TypingIndicator from "./TypingIndicator";
import InviteModal from "./InviteModal";
import AITriggerButton from "./AITriggerButton";
import RoomSettings from "./RoomSettings";

const RoomChat = () => {
  const { user, theme } = useAppContext();
  const { activeRoom, messages, sendRoomMessage, sendRoomTyping, typingUsers, participants, isAITyping } = useRoomContext();
  
  const [prompt, setPrompt] = useState("");
  const [isTypingState, setIsTypingState] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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

  // Check if current user is owner or admin to see settings button
  const currentUserPart = participants.find((p) => p.userId.toString() === user?._id.toString());
  const isOwnerOrAdmin = currentUserPart && (currentUserPart.role === "owner" || currentUserPart.role === "admin");

  return (
    <div className="flex-1 flex flex-col justify-between min-h-0 overflow-hidden m-5 md:m-10 max-md:mt-14">
      {/* Room Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-[#80609F]/30">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{activeRoom.name}</h2>
            {activeRoom.aiEnabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/30 rounded-full">
                ✨ AI Assisted
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/30 rounded-full">
                AI Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {participants.length} participants · {participants.filter(p => p.isOnline).length} online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#A456F7] hover:opacity-90 rounded-md transition-opacity cursor-pointer animate-fade-in"
          >
            Invite Link
          </button>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400 cursor-pointer"
              title="Room Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.831a1.125 1.125 0 0 1 .26 1.43l-1.297 2.247a1.125 1.125 0 0 1-1.37.491l-1.216-.456c-.356-.133-.751-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.83c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.831a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.869l.213-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          )}
        </div>
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
        
        {/* AI Typing Indicator Bubble */}
        {isAITyping && (
          <div className="flex items-start gap-2.5 my-3 justify-start animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3D81F6] to-[#A456F7] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-sm">
              AI
            </div>
            <div className="flex flex-col gap-1.5 p-3 px-5 bg-primary/20 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-xl rounded-bl-sm shadow-sm my-1">
              <span className="text-[10px] font-bold text-[#A456F7]">AI Assistant</span>
              <div className="flex gap-1.5 items-center pt-2 pb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#A456F7] dark:bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#A456F7] dark:bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#A456F7] dark:bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={otherTypingUsers} />

      {/* Prompt / Message box */}
      <form
        onSubmit={onSubmit}
        className="bg-primary/20 dark:bg-[#583C79]/30 border border-primary dark:border-[#80609F]/30 rounded-full w-full max-w-3xl p-3 pl-4 mx-auto flex gap-4 items-center shadow-md"
      >
        <AITriggerButton onClick={() => setPrompt((prev) => prev.trim().startsWith("@ai") ? prev : "@ai " + prev)} />
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

      {/* Room Settings Modal */}
      <RoomSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default RoomChat;
