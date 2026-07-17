import React, { useEffect, useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import Markdown from "react-markdown";
import toast from "react-hot-toast";
import moment from "moment";

const SummaryPanel = ({ isOpen, onClose }) => {
  const {
    activeRoom,
    summaries,
    isGeneratingSummary,
    fetchSummaries,
    generateSummary,
  } = useRoomContext();

  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (isOpen && activeRoom) {
      fetchSummaries(activeRoom._id);
    }
  }, [isOpen, activeRoom]);

  // Reset selected version when activeRoom or summaries change
  useEffect(() => {
    setSelectedIdx(0);
  }, [summaries, activeRoom]);

  if (!activeRoom) return null;

  const currentSummary = summaries[selectedIdx];

  const handleGenerate = async () => {
    const fresh = await generateSummary(activeRoom._id);
    if (fresh) {
      setSelectedIdx(0); // View the newest one
    }
  };

  const handleCopy = () => {
    if (!currentSummary) return;
    navigator.clipboard.writeText(currentSummary.content);
    toast.success("Summary copied to clipboard!");
  };

  const handleDownload = () => {
    if (!currentSummary) return;
    const blob = new Blob([currentSummary.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeRoom.name.replace(/\s+/g, "_")}_summary_v${currentSummary.version}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Summary downloaded successfully!");
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white dark:bg-[#1E1B24] border-l border-gray-200 dark:border-[#80609F]/30 shadow-2xl z-40 flex flex-col transition-transform duration-300 transform ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-gray-200 dark:border-[#80609F]/30 flex items-center justify-between bg-gray-50 dark:bg-[#2A2633]/50">
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white">Room Summaries</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            AI-generated discussion snapshots
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Version Selector Dropdown */}
        {summaries.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-[#2A2633] border border-gray-150 dark:border-[#80609F]/10 rounded-lg">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Version History
            </span>
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="bg-white dark:bg-[#1E1B24] border border-gray-300 dark:border-[#80609F]/20 text-xs rounded-md p-1.5 outline-none text-gray-700 dark:text-white focus:ring-1 focus:ring-[#A456F7] max-w-[200px]"
            >
              {summaries.map((s, idx) => (
                <option key={s._id} value={idx}>
                  v{s.version} (v{s.version} - {moment(s.createdAt).format("MMM D, H:mm")})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Selected Summary */}
        {currentSummary ? (
          <div className="space-y-4">
            {/* Metadata bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#80609F]/10 pb-2">
              <span>By {currentSummary.generatedBy?.name || "Unknown"}</span>
              <span>
                Summarized {currentSummary.messageCount} messages (
                {moment(currentSummary.messageRange.from).format("MMM D, H:mm")} to{" "}
                {moment(currentSummary.messageRange.to).format("MMM D, H:mm")})
              </span>
            </div>

            {/* Markdown rendered body */}
            <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 reset-tw select-text">
              <Markdown>{currentSummary.content}</Markdown>
            </div>

            {/* Export Toolbar */}
            <div className="flex gap-2.5 pt-3 border-t border-gray-100 dark:border-[#80609F]/10">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 p-2 text-xs font-semibold rounded-md border border-gray-300 dark:border-[#80609F]/25 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2A2633] transition-colors cursor-pointer"
              >
                Copy Content
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-1.5 p-2 text-xs font-semibold rounded-md border border-gray-300 dark:border-[#80609F]/25 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2A2633] transition-colors cursor-pointer"
              >
                Download .md
              </button>
            </div>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-center text-gray-400 dark:text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-8 h-8 opacity-60"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p className="text-sm font-medium">No Summaries Yet</p>
            <p className="text-xs">
              Generate a structured meeting report summarizing the discussion.
            </p>
          </div>
        )}
      </div>

      {/* Panel Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-[#80609F]/30 bg-gray-50 dark:bg-[#2A2633]/50">
        <button
          onClick={handleGenerate}
          disabled={isGeneratingSummary}
          className="w-full py-2.5 px-4 text-sm font-bold text-white bg-gradient-to-r from-[#A456F7] to-[#3D81F6] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          {isGeneratingSummary ? (
            <>
              {/* Spinner */}
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Generating Summary...
            </>
          ) : (
            <>Generate Summary (Costs 2 Credits)</>
          )}
        </button>
      </div>
    </div>
  );
};

export default SummaryPanel;
