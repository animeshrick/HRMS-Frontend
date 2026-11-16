// 1-to-1 messaging: open (anyone may message anyone, including HR/CEO/the super admin), text and
// file/image attachments, no edit or delete, and only the last rolling 24 hours of a conversation
// is ever shown. The list and the open thread poll in the background for a "live enough" feel.
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConversations,
  getMessageAttachmentDownloadUrl,
  getPeopleDirectory,
  getThread,
  sendMessage,
  uploadMessageAttachment,
} from "../api/messages";
import type { Conversation, DirectMessage, MessagePerson } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { CloseIcon, UserIcon } from "../components/icons";
import { Loading } from "../components/Loading";
import { Card, PageHeader } from "../components/ui";
import { describeError } from "../lib/errors";
import { formatFullTime, formatShortTime } from "../lib/time";
import { MAXIMUM_MESSAGE_BODY_LENGTH, validateMessageAttachment, validateMessageBody } from "../lib/validation";

const CONVERSATIONS_REFRESH_MILLISECONDS = 15_000;
const THREAD_REFRESH_MILLISECONDS = 4_000;

function initialsOf(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

// The avatar circle used everywhere a person shows up in Messages (conversation list, the "new
// message" picker). A small green dot in the corner means they have used the app in the last
// couple of minutes (see MessagePerson.is_online / app/core/presence.py) - best-effort, not a
// guarantee they are looking at the screen right now.
function PersonAvatar({ fullName, isOnline, size = "h-9 w-9" }: { fullName: string; isOnline: boolean; size?: string }) {
  return (
    <span aria-hidden="true" className={`relative flex ${size} shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2`}>
      {fullName ? initialsOf(fullName) : <UserIcon />}
      {isOnline && (
        <span
          title="Online"
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ok"
        />
      )}
    </span>
  );
}

export function MessagesPage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(token),
    refetchInterval: CONVERSATIONS_REFRESH_MILLISECONDS,
  });
  const peopleQuery = useQuery({
    queryKey: ["message-people"],
    queryFn: () => getPeopleDirectory(token),
    enabled: isPickerOpen,
  });

  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = conversations.find((conversation) => conversation.person.emp_id === selectedEmpId);
  const selectedName = selectedConversation?.person.full_name ?? pickerNameFor(peopleQuery.data, selectedEmpId);

  function openThread(empId: string) {
    setSelectedEmpId(empId);
    setIsPickerOpen(false);
    setPickerFilter("");
  }

  const filteredPeople = (peopleQuery.data ?? []).filter((person) => {
    const text = `${person.full_name} ${person.emp_id ?? ""} ${person.dept ?? ""}`.toLowerCase();
    return text.includes(pickerFilter.trim().toLowerCase());
  });

  return (
    <div className="page flex min-h-0 flex-1 flex-col">
      <PageHeader title="Messages" subtitle="1-to-1 only. Messages older than 24 hours are no longer shown." />
      <div className="mt-4 flex min-h-0 flex-1 gap-4">
        <div className={`${selectedEmpId ? "hidden sm:flex" : "flex"} w-full flex-col sm:w-72 sm:shrink-0`}>
          <Card className="flex min-h-0 flex-1 flex-col !p-0">
            <div className="flex items-center justify-between gap-2 border-b border-line p-3">
              <h2 className="section-title">Conversations</h2>
              <button type="button" onClick={() => setIsPickerOpen(true)} className="btn btn-sm btn-quiet">
                New message
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversationsQuery.isLoading && <Loading fill="inline" label="Loading your conversations" delayMilliseconds={300} />}
              {!conversationsQuery.isLoading && conversations.length === 0 && (
                <p className="p-4 text-sm text-ink-2">No conversations in the last 24 hours. Start one with "New message".</p>
              )}
              <ul className="divide-y divide-line">
                {conversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.person.emp_id ?? conversation.last_message_at}
                    conversation={conversation}
                    isActive={conversation.person.emp_id === selectedEmpId}
                    onOpen={() => conversation.person.emp_id && openThread(conversation.person.emp_id)}
                  />
                ))}
              </ul>
            </div>
          </Card>
        </div>

        <div className={`${selectedEmpId ? "flex" : "hidden sm:flex"} min-h-0 flex-1 flex-col`}>
          {selectedEmpId ? (
            <Thread
              token={token}
              otherEmpId={selectedEmpId}
              otherName={selectedName ?? selectedEmpId}
              onBack={() => setSelectedEmpId(null)}
            />
          ) : (
            <Card className="flex flex-1 items-center justify-center text-sm text-ink-2">Pick a conversation, or start a new one.</Card>
          )}
        </div>
      </div>

      {isPickerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <Card className="flex max-h-[70vh] w-full max-w-sm flex-col !p-0">
            <div className="flex items-center justify-between gap-2 border-b border-line p-3">
              <h2 className="section-title">New message</h2>
              <button type="button" aria-label="Close" onClick={() => setIsPickerOpen(false)} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                <CloseIcon />
              </button>
            </div>
            <div className="border-b border-line p-3">
              <input
                autoFocus
                type="text"
                value={pickerFilter}
                onChange={(event) => setPickerFilter(event.target.value)}
                placeholder="Search by name or department"
                aria-label="Search people"
                className="field block w-full"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {peopleQuery.isLoading && <Loading fill="inline" label="Loading people" delayMilliseconds={300} />}
              <ul className="divide-y divide-line">
                {filteredPeople.map((person) => (
                  <li key={person.emp_id}>
                    <button
                      type="button"
                      onClick={() => person.emp_id && openThread(person.emp_id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-2"
                    >
                      <PersonAvatar fullName={person.full_name} isOnline={person.is_online} size="h-8 w-8" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{person.full_name}</span>
                        <span className="block truncate text-xs text-ink-3">{person.dept ?? "No department"}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {!peopleQuery.isLoading && filteredPeople.length === 0 && <p className="p-4 text-sm text-ink-2">No one matches that search.</p>}
              </ul>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  function pickerNameFor(people: MessagePerson[] | undefined, empId: string | null): string | null {
    return people?.find((person) => person.emp_id === empId)?.full_name ?? null;
  }
}

function ConversationRow({ conversation, isActive, onOpen }: { conversation: Conversation; isActive: boolean; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${isActive ? "bg-surface-2" : "hover:bg-surface-2"}`}
      >
        <PersonAvatar fullName={conversation.person.full_name} isOnline={conversation.person.is_online} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-ink">{conversation.person.full_name}</span>
            <time className="shrink-0 text-xs text-ink-3" dateTime={conversation.last_message_at} title={formatFullTime(conversation.last_message_at)}>
              {formatShortTime(conversation.last_message_at)}
            </time>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-ink-2">{conversation.last_message}</span>
            {conversation.unread_count > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-brand-ink">
                {conversation.unread_count}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function Thread({ token, otherEmpId, otherName, onBack }: { token: string; otherEmpId: string; otherName: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [draftBody, setDraftBody] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const bottomReference = useRef<HTMLDivElement | null>(null);

  const threadQuery = useQuery({
    queryKey: ["message-thread", otherEmpId],
    queryFn: () => getThread(token, otherEmpId),
    refetchInterval: THREAD_REFRESH_MILLISECONDS,
  });
  const messages = useMemo(() => threadQuery.data?.messages ?? [], [threadQuery.data]);

  useEffect(() => {
    bottomReference.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages.length]);

  async function submitDraft() {
    const problem = validateMessageBody(draftBody, draftFile !== null);
    if (problem) {
      setValidationMessage(problem);
      return;
    }
    if (draftFile) {
      const fileProblem = validateMessageAttachment(draftFile);
      if (fileProblem) {
        setValidationMessage(fileProblem);
        return;
      }
    }
    setValidationMessage(null);
    setSendError(null);
    setIsSending(true);
    try {
      const attachment = draftFile ? await uploadMessageAttachment(token, draftFile) : undefined;
      await sendMessage(token, otherEmpId, draftBody.trim() || null, attachment);
      setDraftBody("");
      setDraftFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["message-thread", otherEmpId] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
    } catch (error) {
      setSendError(describeError(error));
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitDraft();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitDraft();
    }
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col !p-0">
      <div className="flex items-center gap-2 border-b border-line p-3">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:hidden">
          <CloseIcon />
        </button>
        <h2 className="section-title truncate">{otherName}</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {threadQuery.isLoading && <Loading fill="inline" label="Loading the conversation" delayMilliseconds={300} />}
        {threadQuery.isError && <p role="alert" className="text-sm text-bad">{describeError(threadQuery.error)}</p>}
        {!threadQuery.isLoading && messages.length === 0 && (
          <p className="text-sm text-ink-2">Nothing in the last 24 hours. Say hello.</p>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} token={token} />
        ))}
        <div ref={bottomReference} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-line p-3">
        {validationMessage && <p role="alert" className="mb-1 text-sm text-bad">{validationMessage}</p>}
        {sendError && <p role="alert" className="mb-1 text-sm text-bad">{sendError}</p>}
        {draftFile && (
          <p className="mb-1 flex items-center gap-2 text-xs text-ink-2">
            Attached: {draftFile.name}
            <button type="button" onClick={() => setDraftFile(null)} className="text-bad underline">
              Remove
            </button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Your message"
            value={draftBody}
            onChange={(event) => setDraftBody(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type your message and press Enter"
            className="field block flex-1 resize-none text-sm"
          />
          <label className="btn btn-sm btn-quiet cursor-pointer">
            Attach
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(event) => setDraftFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <button type="submit" disabled={isSending} className="btn btn-primary">
            Send
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-ink-3">
          {draftBody.length}/{MAXIMUM_MESSAGE_BODY_LENGTH}
        </p>
      </form>
    </Card>
  );
}

function MessageBubble({ message, token }: { message: DirectMessage; token: string }) {
  const [isOpeningAttachment, setIsOpeningAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  async function openAttachment() {
    setAttachmentError(null);
    setIsOpeningAttachment(true);
    try {
      const result = await getMessageAttachmentDownloadUrl(token, message.id);
      window.open(result.url, "_blank", "noopener");
    } catch (error) {
      setAttachmentError(describeError(error));
    } finally {
      setIsOpeningAttachment(false);
    }
  }

  return (
    <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%] space-y-1">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm shadow-card ${
            message.mine ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md border border-line bg-surface text-ink"
          }`}
        >
          {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
          {message.attachment_filename && (
            <button
              type="button"
              disabled={isOpeningAttachment}
              onClick={() => void openAttachment()}
              className={`mt-1 flex items-center gap-1 underline disabled:opacity-60 ${message.mine ? "text-brand-ink" : "text-brand-text"}`}
            >
              {message.attachment_filename}
            </button>
          )}
          {attachmentError && <p role="alert" className="mt-1 text-xs text-bad">{attachmentError}</p>}
        </div>
        <p className={`text-xs text-ink-3 ${message.mine ? "text-right" : "text-left"}`}>
          <time dateTime={message.created_at} title={formatFullTime(message.created_at)}>
            {formatShortTime(message.created_at)}
          </time>
        </p>
      </div>
    </div>
  );
}
