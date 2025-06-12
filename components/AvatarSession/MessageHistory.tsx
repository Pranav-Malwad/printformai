import React, { useEffect, useRef } from "react";

import { useMessageHistory, MessageSender } from "../logic";

export const MessageHistory: React.FC = () => {
  const { messages } = useMessageHistory();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || messages.length === 0) return;

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-y-auto flex flex-col gap-3 px-3 py-3 text-white self-center max-h-[250px] bg-zinc-800/50 rounded-lg"
    >
      <h3 className="text-center text-sm font-medium text-zinc-400 border-b border-zinc-700 pb-2 mb-1">Conversation History</h3>
      {messages.length === 0 ? (
        <p className="text-center text-xs text-zinc-500 italic">No messages yet. Start a conversation!</p>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col gap-1 max-w-[450px] p-2 rounded-lg ${
              message.sender === MessageSender.CLIENT
                ? "self-end items-end bg-blue-900/30"
                : "self-start items-start bg-zinc-700/30"
            }`}
          >
            <p className="text-xs font-medium text-zinc-400">
              {message.sender === MessageSender.AVATAR ? "AI Assistant (Avatar)" : "You"}
            </p>
            <p className="text-sm">{message.content}</p>
          </div>
        ))
      )}
    </div>
  );
};
