import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { askQuestion, loadChatHistory } from "../api/chat";
import { attachDocument, uploadDocument } from "../api/leave";
import type { ChatHistoryMessage, ChatResponse, PendingAction } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { MAXIMUM_QUESTION_LENGTH } from "../lib/config";
import { LinkedText } from "../components/LinkedText";
import { ApiError, describeError } from "../lib/errors";
import { formatFullTime, formatShortTime } from "../lib/time";
import { validateDocument, validateQuestion } from "../lib/validation";

interface ChatMessage {
  id: number;
  author: "user" | "assistant" | "error";
  text: string;
  response?: ChatResponse; // only for assistant messages (has the sources)
  pendingAction?: PendingAction; // the assistant is waiting for "yes" or "no"
  failedQuestion?: string; // only for error messages (used by Retry)
  createdAt?: string; // exact time (ISO text, UTC) the message was saved
  historyId?: number; // the id in the saved history (only for messages that came from it)
}

const HISTORY_PAGE_SIZE = 50; // the backend sends this many messages per page

/** A saved message from the backend, in the shape this page shows. */
function toChatMessage(saved: ChatHistoryMessage, id: number): ChatMessage {
  const base = { id, text: saved.message, createdAt: saved.created_at, historyId: saved.id };
  if (saved.sender === "user") {
    return { ...base, author: "user" };
  }
  const response: ChatResponse = {
    question: "", rewritten_question: "", answer: saved.message, answerable: true, sources: saved.sources, pending_action: null,
  };
  return { ...base, author: "assistant", response };
}

const STARTER_QUESTIONS = [
  "How many casual leaves do I get in a year?",
  "What is the notice period for resignation?",
  "What is the work from home policy?",
];

export function ChatPage() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const abortControllerReference = useRef<AbortController | null>(null);
  const nextMessageIdReference = useRef(1);
  const bottomReference = useRef<HTMLDivElement | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const shouldScrollToBottomReference = useRef(true); // false while older messages are added at the top

  useEffect(() => {
    if (shouldScrollToBottomReference.current) {
      bottomReference.current?.scrollIntoView?.({ behavior: "smooth" });
    }
    shouldScrollToBottomReference.current = true;
  }, [messages, isWaiting]);

  // Show the saved messages of the last 30 days when the page opens. If they cannot be loaded, the chat still works.
  useEffect(() => {
    if (!session) {
      return;
    }
    const abortController = new AbortController();
    loadChatHistory(session.accessToken, undefined, abortController.signal)
      .then((savedMessages) => {
        setMessages((previousMessages) => [
          ...savedMessages.map((saved) => toChatMessage(saved, nextMessageIdReference.current++)),
          ...previousMessages,
        ]);
        setHasOlderMessages(savedMessages.length >= HISTORY_PAGE_SIZE);
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [session]);

  async function showOlderMessages() {
    const oldestId = messages.find((message) => message.historyId !== undefined)?.historyId;
    if (!session || oldestId === undefined || isLoadingOlder) {
      return;
    }
    setIsLoadingOlder(true);
    try {
      const savedMessages = await loadChatHistory(session.accessToken, oldestId);
      shouldScrollToBottomReference.current = false;
      setMessages((previousMessages) => [
        ...savedMessages.map((saved) => toChatMessage(saved, nextMessageIdReference.current++)),
        ...previousMessages,
      ]);
      setHasOlderMessages(savedMessages.length >= HISTORY_PAGE_SIZE);
    } catch (error) {
      addMessage({ author: "error", text: describeError(error) });
    } finally {
      setIsLoadingOlder(false);
    }
  }

  // Stop an unfinished request if the user leaves this page.
  useEffect(() => () => abortControllerReference.current?.abort(), []);

  /** Adds a message at the bottom and returns its id. */
  function addMessage(message: Omit<ChatMessage, "id">): number {
    const newMessage = { ...message, id: nextMessageIdReference.current++ };
    setMessages((previousMessages) => [...previousMessages, newMessage]);
    return newMessage.id;
  }

  async function sendQuestion(question: string, shouldAddUserMessage: boolean) {
    if (!session) {
      return;
    }
    // Until the server answers, the question shows this computer's time. The server's exact time replaces it below.
    const userMessageId = shouldAddUserMessage ? addMessage({ author: "user", text: question, createdAt: new Date().toISOString() }) : null;
    setIsWaiting(true);
    const abortController = new AbortController();
    abortControllerReference.current = abortController;

    try {
      const chatResponse = await askQuestion(session.accessToken, question, abortController.signal);
      if (userMessageId !== null && chatResponse.asked_at) {
        setMessages((previousMessages) =>
          previousMessages.map((message) => (message.id === userMessageId ? { ...message, createdAt: chatResponse.asked_at! } : message)),
        );
      }
      addMessage({
        author: "assistant",
        text: chatResponse.answer,
        response: chatResponse,
        pendingAction: chatResponse.pending_action ?? undefined,
        createdAt: chatResponse.answered_at ?? new Date().toISOString(),
      });
    } catch (error) {
      // A cancelled request is not an error to show; the Cancel button already explains itself.
      if (error instanceof ApiError && error.kind === "aborted") {
        addMessage({ author: "error", text: "Cancelled.", failedQuestion: question });
      } else {
        addMessage({ author: "error", text: describeError(error), failedQuestion: question });
      }
    } finally {
      setIsWaiting(false);
      abortControllerReference.current = null;
    }
  }

  function submitDraft() {
    const problem = validateQuestion(draftQuestion);
    setValidationMessage(problem);
    if (problem || isWaiting) {
      return;
    }
    const question = draftQuestion.trim();
    setDraftQuestion("");
    void sendQuestion(question, true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitDraft();
  }

  // Enter sends, Shift+Enter makes a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitDraft();
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4">
      <div className="flex-1 space-y-4 overflow-y-auto py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="mt-10 text-center">
            <h1 className="text-lg font-semibold">Ask about company HR policies</h1>
            <p className="mt-1 text-sm text-slate-600">Try one of these:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {STARTER_QUESTIONS.map((starterQuestion) => (
                <button
                  key={starterQuestion}
                  type="button"
                  disabled={isWaiting}
                  onClick={() => void sendQuestion(starterQuestion, true)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-60"
                >
                  {starterQuestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasOlderMessages && (
          <div className="text-center">
            <button
              type="button"
              disabled={isLoadingOlder}
              onClick={() => void showOlderMessages()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {isLoadingOlder ? "Loading..." : "Load older messages"}
            </button>
          </div>
        )}

        {messages.map((message, messageIndex) => (
          <div key={message.id} className="space-y-2">
            <MessageBubble message={message} isBusy={isWaiting} onRetry={(question) => void sendQuestion(question, false)} />
            {/* The time is small, in Indian time. The mouse over it shows the full date and the seconds. */}
            {message.createdAt && message.author !== "error" && (
              <p className={`text-xs text-slate-400 ${message.author === "user" ? "text-right" : "text-left"}`}>
                <time dateTime={message.createdAt} title={formatFullTime(message.createdAt)}>
                  {formatShortTime(message.createdAt)}
                </time>
              </p>
            )}
            {/* Only the newest message can still be confirmed. */}
            {message.pendingAction && messageIndex === messages.length - 1 && !isWaiting && session && (
              <PendingActionBar
                token={session.accessToken}
                action={message.pendingAction}
                onAnswer={(answerText) => void sendQuestion(answerText, true)}
              />
            )}
          </div>
        ))}

        {isWaiting && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>Thinking...</span>
            <button
              type="button"
              onClick={() => abortControllerReference.current?.abort()}
              className="rounded-md border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        )}
        <div ref={bottomReference} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 py-3">
        {validationMessage && (
          <p role="alert" className="mb-1 text-sm text-red-600">
            {validationMessage}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Your question"
            value={draftQuestion}
            onChange={(event) => setDraftQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type your question and press Enter"
            className="block flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isWaiting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            Send
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-slate-400">
          {draftQuestion.length}/{MAXIMUM_QUESTION_LENGTH}
        </p>
      </form>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isBusy: boolean;
  onRetry: (question: string) => void;
}

function MessageBubble({ message, isBusy, onRetry }: MessageBubbleProps) {
  if (message.author === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{message.text}</p>
      </div>
    );
  }

  if (message.author === "error") {
    return (
      <div className="flex justify-start">
        <div role="alert" className="max-w-[80%] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{message.text}</p>
          {message.failedQuestion && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onRetry(message.failedQuestion!)}
              className="mt-1 font-medium underline disabled:opacity-60"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const isUnanswerable = message.response?.answerable === false;
  const sources = message.response?.sources ?? [];
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm ${
          isUnanswerable ? "border-slate-200 bg-slate-100 text-slate-600" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <p className="whitespace-pre-wrap">
          <LinkedText text={message.text} />
        </p>
        {sources.length > 0 && (
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer">Sources ({sources.length})</summary>
            <ul className="mt-1 space-y-1">
              {sources.map((source) => (
                <li key={source.chunk_id}>
                  [{source.number}] {source.title ?? source.doc_id}
                  {source.section ? `, ${source.section}` : ""}
                  {source.version ? ` (v${source.version})` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

interface PendingActionBarProps {
  token: string;
  action: PendingAction;
  onAnswer: (answerText: string) => void;
}

/** Yes / No buttons for a leave that waits for confirmation, plus the optional document upload. */
function PendingActionBar({ token, action, onAnswer }: PendingActionBarProps) {
  const [uploadState, setUploadState] = useState<{ kind: "idle" | "busy" | "done" | "error"; text: string }>({ kind: "idle", text: "" });

  async function handleFileChosen(file: File | undefined) {
    if (!file) {
      return;
    }
    const problem = validateDocument(file);
    if (problem) {
      setUploadState({ kind: "error", text: problem });
      return;
    }
    setUploadState({ kind: "busy", text: "Uploading..." });
    try {
      const documentPath = await uploadDocument(token, file);
      await attachDocument(token, action.id, documentPath);
      setUploadState({ kind: "done", text: `Document added: ${file.name}` });
    } catch (error) {
      setUploadState({ kind: "error", text: describeError(error) });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        disabled={uploadState.kind === "busy"}
        onClick={() => onAnswer("Yes")}
        className="rounded-md bg-green-600 px-3 py-1 font-medium text-white hover:bg-green-500 disabled:opacity-60"
      >
        Yes, confirm
      </button>
      <button
        type="button"
        disabled={uploadState.kind === "busy"}
        onClick={() => onAnswer("No")}
        className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100 disabled:opacity-60"
      >
        No, cancel
      </button>
      {action.allows_document && (
        <label className="flex items-center gap-2 text-slate-600">
          <span>Related document (optional)</span>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(event) => void handleFileChosen(event.target.files?.[0])}
            className="max-w-48 text-xs"
          />
        </label>
      )}
      {uploadState.text && (
        <span role={uploadState.kind === "error" ? "alert" : "status"} className={uploadState.kind === "error" ? "text-red-600" : "text-slate-600"}>
          {uploadState.text}
        </span>
      )}
    </div>
  );
}
