import { CHAT_TIMEOUT_MILLISECONDS } from "../lib/config";
import { apiRequest } from "./client";
import type { ChatHistoryMessage, ChatResponse } from "./types";

export function askQuestion(token: string, question: string, signal?: AbortSignal): Promise<ChatResponse> {
  return apiRequest<ChatResponse>("/chat", {
    method: "POST",
    body: { question },
    token,
    signal,
    timeoutMilliseconds: CHAT_TIMEOUT_MILLISECONDS,
  });
}

/** My saved messages, oldest first. beforeId loads the page of messages before that message id. */
export function loadChatHistory(token: string, beforeId?: number, signal?: AbortSignal): Promise<ChatHistoryMessage[]> {
  const query = beforeId === undefined ? "" : `?before_id=${beforeId}`;
  return apiRequest<ChatHistoryMessage[]>(`/chat/history${query}`, { method: "GET", token, signal });
}
