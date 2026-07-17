import React from "react";

const TypingIndicator = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) return null;

  let text = "";
  if (typingUsers.length === 1) {
    text = `${typingUsers[0].userName} is typing`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
  } else {
    text = "Several people are typing";
  }

  return (
    <div className="flex items-center gap-3 p-2 pl-4 transition-all duration-300 animate-pulse">
      <div className="inline-flex items-center gap-1.5 p-2 px-3.5 bg-primary/20 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-xl rounded-bl-sm shadow-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-[#A456F7] dark:bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#A456F7] dark:bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#A456F7] dark:bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-[#B1A6C0] italic font-medium">{text}...</span>
    </div>
  );
};

export default TypingIndicator;
