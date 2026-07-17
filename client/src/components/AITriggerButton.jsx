import React from "react";

const AITriggerButton = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center p-2 rounded-full bg-gradient-to-r from-[#A456F7] to-[#3D81F6] hover:opacity-90 transition-opacity text-white shadow-sm shrink-0 cursor-pointer"
      title="Ask AI"
    >
      {/* Sparkles SVG icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.071 4.929l-.353 1.768-1.768.353 1.768.353.353 1.768.353-1.768 1.768-.353-1.768-.353-.353-1.768z"
        />
      </svg>
    </button>
  );
};

export default AITriggerButton;
