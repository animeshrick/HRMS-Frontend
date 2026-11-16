// The AI assistant, as a floating button fixed to the bottom-right corner of every page (instead
// of its own "/chat" route - see Layout.tsx, which mounts this once for the whole app). Opens a
// small chat panel (ChatPanel.tsx) over whatever page is underneath. Hides itself when the
// backend marks the "chat" page down for maintenance (app/core/downtime.py), matching what the
// old routed page did via PageDowntimeGuard.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDowntimeStatus } from "../api/system";
import { ChatPanel } from "./ChatPanel";
import { BotIcon, CloseIcon } from "./icons";

const REFRESH_MILLISECONDS = 60_000; // not urgent; once a minute is plenty, matching PageDowntimeGuard

// Other pages (e.g. HomePage's "Chat with the assistant" button) open the widget from afar by
// dispatching this event on window, since the widget's open/closed state is local to it.
export const AI_CHAT_OPEN_EVENT = "ai-chat-widget:open";

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openWidget = () => setIsOpen(true);
    window.addEventListener(AI_CHAT_OPEN_EVENT, openWidget);
    return () => window.removeEventListener(AI_CHAT_OPEN_EVENT, openWidget);
  }, []);
  // Shares its cache with PageDowntimeGuard's query, so the two agree without a second network call.
  const downtimeQuery = useQuery({ queryKey: ["system-downtime"], queryFn: getDowntimeStatus, refetchInterval: REFRESH_MILLISECONDS });
  const isDown = (downtimeQuery.data?.down_pages ?? []).includes("chat");

  if (isDown) {
    return null;
  }

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl sm:right-6">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">HR Assistant</p>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-ink-2 transition hover:bg-surface-2 hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel />
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={isOpen ? "Close chat" : "Open chat"}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-lg transition duration-150 hover:brightness-95 sm:right-6"
      >
        <BotIcon />
      </button>
    </>
  );
}
