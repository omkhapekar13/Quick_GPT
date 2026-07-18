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
import SummaryPanel from "./SummaryPanel";

const RoomChat = () => {
  const { user, theme } = useAppContext();
  const { activeRoom, messages, sendRoomMessage, sendRoomTyping, typingUsers, participants, isAITyping } = useRoomContext();

  const [prompt, setPrompt] = useState("");
  const [isTypingState, setIsTypingState] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [replyToMessage, setReplyToMessage] = useState(null);

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
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto h-full">
        <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-tr from-[#A456F7]/20 to-[#3D81F6]/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">No Room Selected</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Select or create a collaborative room from the sidebar to start brainstorming and working together in real-time.
        </p>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const val = e.target.value;
    const selectionStart = e.target.selectionStart;
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

    // Mention detection
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === " ")) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!query.includes(" ")) {
        setShowMentionList(true);
        setMentionQuery(query);
        setMentionStartIndex(lastAtIndex);
        return;
      }
    }
    setShowMentionList(false);
  };

  const handleMentionClick = (userName) => {
    const prefix = prompt.slice(0, mentionStartIndex);
    const suffix = prompt.slice(mentionStartIndex + mentionQuery.length + 1);
    const newPrompt = prefix + "@" + userName + " " + suffix;
    setPrompt(newPrompt);
    setShowMentionList(false);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTypingState(false);
    sendRoomTyping(activeRoom._id, false);

    sendRoomMessage(activeRoom._id, prompt.trim(), replyToMessage?._id);
    setPrompt("");
    setReplyToMessage(null);
    setShowMentionList(false);
  };

  // Filter typing users to exclude self
  const otherTypingUsers = typingUsers.filter((u) => u.userId !== user?._id);

  // Filter participants for mention dropdown
  const filteredMentions = participants.filter((p) =>
    p.userName.toLowerCase().includes(mentionQuery.toLowerCase())
  );

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
            onClick={() => setIsSummaryOpen(!isSummaryOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#2A2633] border border-gray-300 dark:border-[#80609F]/20 hover:opacity-90 rounded-md transition-opacity cursor-pointer animate-fade-in"
            title="Conversation Summaries"
          >
            Summaries
          </button>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#A456F7] hover:opacity-90 rounded-md transition-opacity cursor-pointer animate-fade-in"
          >
            Invite Link
          </button>
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
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={containerRef} className="flex-1 my-5 overflow-y-scroll space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-20 h-20 mb-5 rounded-full bg-gradient-to-tr from-[#A456F7]/10 to-[#3D81F6]/10 flex items-center justify-center text-purple-500/80">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 18.97a5.969 5.969 0 0 1-.754-.038 9.273 9.273 0 0 1-1.407-.83 6.75 6.75 0 0 0 3.29-1.398c-.13-.365-.2-.756-.2-1.154 0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">
              Welcome to {activeRoom.name}!
            </h4>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Send a message to start the collaborative discussion. Type <span className="font-semibold text-purple-500">@ai</span> to query the AI assistant.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isSelf = message.senderId === user?._id;
            const isSystem = message.senderType === "system";
            const parentMessage = message.parentMsgId ? messages.find((m) => m._id === message.parentMsgId) : null;

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
                className={`flex items-start gap-2.5 my-3 group relative ${isSelf ? "justify-end" : "justify-start"}`}
              >
                {!isSelf && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3D81F6] to-[#A456F7] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-sm">
                    {message.senderName.slice(0, 2)}
                  </div>
                )}
                <div
                  className={`flex flex-col gap-1.5 p-3 px-4 rounded-lg max-w-xl shadow-sm border relative ${isSelf
                    ? "bg-slate-50 dark:bg-[#57317C]/30 border-[#80609F]/30 text-gray-800 dark:text-white"
                    : "bg-[#A456F7]/10 dark:bg-[#57317C]/20 border-gray-300 dark:border-[#80609F]/15 text-gray-800 dark:text-white"
                    }`}
                >
                  {!isSelf && (
                    <span className="text-[10px] font-bold text-[#A456F7]">
                      {message.senderName}
                    </span>
                  )}
                  {parentMessage && (
                    <div className="mb-1.5 p-1.5 px-2 bg-black/5 dark:bg-white/5 border-l-2 border-purple-500 rounded text-[11px] text-gray-500 dark:text-gray-400 max-w-sm truncate">
                      <span className="font-semibold text-purple-600 dark:text-purple-400 block text-[10px]">
                        {parentMessage.senderName}
                      </span>
                      {parentMessage.content}
                    </div>
                  )}
                  <div className="text-sm reset-tw">
                    <Markdown>{message.content}</Markdown>
                  </div>
                  <span
                    title={moment(message.createdAt).format("LLLL")}
                    className="text-[9px] text-gray-400 dark:text-[#B1A6C0] self-end mt-0.5 cursor-help"
                  >
                    {moment(message.createdAt).fromNow()}
                  </span>
                </div>
                {isSelf && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#A456F7] to-[#3D81F6] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-sm">
                    {message.senderName.slice(0, 2)}
                  </div>
                )}

                {/* Hover Reply Trigger Action Bar */}
                <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-[#2A2633] border border-gray-200 dark:border-[#80609F]/20 rounded-md shadow-sm p-1.5 z-10 ${isSelf ? "right-12" : "left-12"}`}>
                  <button
                    onClick={() => setReplyToMessage(message)}
                    className="p-1 px-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded text-[10px] font-bold text-purple-600 dark:text-purple-400 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Reply to this message"
                  >
                    💬 Reply
                  </button>
                </div>
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

      {/* Input container wrapper */}
      <div className="relative w-full max-w-3xl mx-auto flex flex-col">
        {/* Mention autocomplete dropdown */}
        {showMentionList && filteredMentions.length > 0 && (
          <div className="absolute bottom-full mb-2 left-4 w-56 bg-white dark:bg-[#1E1B24] border border-gray-200 dark:border-[#80609F]/30 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
            {filteredMentions.map((p) => (
              <div
                key={p.userId}
                onClick={() => handleMentionClick(p.userName)}
                className="p-2 px-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-xs font-semibold text-gray-800 dark:text-white cursor-pointer flex items-center gap-2 transition-colors border-b border-gray-100 dark:border-[#80609F]/10 last:border-b-0"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#3D81F6] to-[#A456F7] flex items-center justify-center text-white text-[9px] uppercase">
                  {p.userName.slice(0, 2)}
                </div>
                <span className="truncate">{p.userName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reply-to Preview Box */}
        {replyToMessage && (
          <div className="mb-2 p-2 px-4 bg-gray-50 dark:bg-[#1E1B24]/60 border border-gray-200 dark:border-[#80609F]/30 rounded-lg flex items-center justify-between text-xs animate-fade-in backdrop-blur-md">
            <div className="flex flex-col min-w-0 border-l-2 border-purple-500 pl-2">
              <span className="font-semibold text-purple-600 dark:text-purple-400 text-[10px]">
                Replying to {replyToMessage.senderName}
              </span>
              <span className="text-gray-500 dark:text-gray-400 truncate">
                {replyToMessage.content}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyToMessage(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors ml-4 text-[10px] cursor-pointer"
            >
              ❌
            </button>
          </div>
        )}

        {/* Prompt / Message box */}
        <form
          onSubmit={onSubmit}
          className="bg-primary/20 dark:bg-[#583C79]/30 border border-primary dark:border-[#80609F]/30 rounded-full w-full p-3 pl-4 flex gap-4 items-center shadow-md animate-fade-in"
        >
          <AITriggerButton onClick={() => setPrompt((prev) => prev.trim().startsWith("@ai") ? prev : "@ai " + prev)} />
          <input
            onChange={handleInputChange}
            value={prompt}
            type="text"
            placeholder="Type your message here..."
            className="flex-1 w-full text-sm outline-none dark:text-white bg-transparent"
            autoComplete="off"
            required
          />
          <button type="submit" className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <img src={assets.send_icon} className="w-7 cursor-pointer" alt="Send" />
          </button>
        </form>
      </div>

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

      {/* Summary Drawer Panel */}
      <SummaryPanel
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />
    </div>
  );
};

export default RoomChat;
