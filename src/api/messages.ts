import { apiRequest } from "./client";
import type { Conversation, DirectMessage, MessageAttachmentUpload, MessagePerson, MessageThread, SignedDownload } from "./types";

// Everyone I may start a conversation with (open: any employee, including HR/CEO/the super admin).
export const getPeopleDirectory = (token: string) => apiRequest<MessagePerson[]>("/messages/people", { token });

// My conversations from the last 24 hours, newest first, each with an unread count.
export const getConversations = (token: string) => apiRequest<Conversation[]>("/messages/conversations", { token });

// My messages with one person from the last 24 hours. Opening this marks the conversation read.
export const getThread = (token: string, otherEmpId: string) =>
  apiRequest<MessageThread>(`/messages/thread/${encodeURIComponent(otherEmpId)}`, { token });

export const sendMessage = (token: string, toEmpId: string, body: string | null, attachment?: MessageAttachmentUpload) =>
  apiRequest<DirectMessage>("/messages/send", {
    method: "POST",
    token,
    body: {
      to_emp_id: toEmpId,
      body,
      attachment_path: attachment?.attachment_path ?? null,
      attachment_filename: attachment?.attachment_filename ?? null,
      attachment_content_type: attachment?.attachment_content_type ?? null,
    },
  });

/** Sends the file itself as the request body. Pass the result straight to sendMessage. */
export async function uploadMessageAttachment(token: string, file: File): Promise<MessageAttachmentUpload> {
  return apiRequest<MessageAttachmentUpload>(`/messages/attachments?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    token,
    rawBody: file,
    contentType: file.type,
    timeoutMilliseconds: 60_000,
  });
}

export const getMessageAttachmentDownloadUrl = (token: string, messageId: number) =>
  apiRequest<SignedDownload>(`/messages/attachments/${messageId}/download-url`, { token });
