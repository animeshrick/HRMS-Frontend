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

/** My saved messages, oldest first. The server keeps only the newest few, so this is the whole history. */
export function loadChatHistory(token: string, signal?: AbortSignal): Promise<ChatHistoryMessage[]> {
  return apiRequest<ChatHistoryMessage[]>("/chat/history", { method: "GET", token, signal });
}
