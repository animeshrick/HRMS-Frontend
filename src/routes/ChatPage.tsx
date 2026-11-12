import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { askQuestion, loadChatHistory } from "../api/chat";
import { attachDocument, uploadDocument } from "../api/leave";
import type { ChatHistoryMessage, ChatResponse, PendingAction } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { MAXIMUM_QUESTION_LENGTH } from "../lib/config";
import { LinkedText } from "../components/LinkedText";
import { Loading } from "../components/Loading";
import { LoaderMark } from "../components/LoaderMark";
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); // the saved messages are still coming
  const abortControllerReference = useRef<AbortController | null>(null);
  const nextMessageIdReference = useRef(1);
  const bottomReference = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomReference = useRef(true);

  useEffect(() => {
    if (shouldScrollToBottomReference.current) {
      bottomReference.current?.scrollIntoView?.({ behavior: "smooth" });
    }
    shouldScrollToBottomReference.current = true;
  }, [messages, isWaiting]);

  // Show the saved messages when the page opens. The database keeps only the newest few per employee
  // (see sql/09_chat_history.sql), so this is the whole history. If it cannot be loaded, the chat still works.
  useEffect(() => {
    if (!session) {
      return;
    }
    const abortController = new AbortController();
    setIsLoadingHistory(true);
    loadChatHistory(session.accessToken, abortController.signal)
      .then((savedMessages) => {
        setMessages((previousMessages) => [
          ...savedMessages.map((saved) => toChatMessage(saved, nextMessageIdReference.current++)),
          ...previousMessages,
        ]);
      })
      .catch(() => undefined)
      .finally(() => setIsLoadingHistory(false));
    return () => abortController.abort();
  }, [session]);

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
      <div className="flex-1 space-y-4 no-scrollbar overflow-y-auto py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="mt-10 text-center">
            <h1 className="page-title">Ask about company HR policies</h1>
            <p className="mt-1 text-sm text-ink-2">Try one of these:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {STARTER_QUESTIONS.map((starterQuestion) => (
                <button
                  key={starterQuestion}
                  type="button"
                  disabled={isWaiting}
                  onClick={() => void sendQuestion(starterQuestion, true)}
                  className="btn btn-sm btn-quiet rounded-full"
                >
                  {starterQuestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoadingHistory && <Loading fill="inline" label="Loading your chat" delayMilliseconds={300} />}

        {messages.map((message, messageIndex) => (
          <div key={message.id} className="space-y-2">
            <MessageBubble message={message} isBusy={isWaiting} onRetry={(question) => void sendQuestion(question, false)} />
            {/* The time is small, in Indian time. The mouse over it shows the full date and the seconds. */}
            {message.createdAt && message.author !== "error" && (
              <p className={`text-xs text-ink-3 ${message.author === "user" ? "text-right" : "text-left"}`}>
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
          <div className="flex items-center gap-3 text-sm text-ink-3">
            <LoaderMark size={18} />
            <span>Thinking...</span>
            <button
              type="button"
              onClick={() => abortControllerReference.current?.abort()}
              className="btn btn-sm btn-quiet"
            >
              Cancel
            </button>
          </div>
        )}
        <div ref={bottomReference} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-line py-3">
        {validationMessage && (
          <p role="alert" className="mb-1 text-sm text-bad">
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
            className="field block flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={isWaiting}
            className="btn btn-primary"
          >
            Send
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-ink-3">
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
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-ink">{message.text}</p>
      </div>
    );
  }

  if (message.author === "error") {
    return (
      <div className="flex justify-start">
        <div role="alert" className="max-w-[80%] rounded-2xl rounded-bl-md border border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad">
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
        className={`max-w-[80%] rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm shadow-card ${
          isUnanswerable ? "border-line bg-surface-2 text-ink-2" : "border-line bg-surface text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap">
          <LinkedText text={message.text} />
        </p>
        {sources.length > 0 && (
          <details className="mt-2 text-xs text-ink-3">
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
        className="btn btn-sm btn-ok"
      >
        Yes, confirm
      </button>
      <button
        type="button"
        disabled={uploadState.kind === "busy"}
        onClick={() => onAnswer("No")}
        className="btn btn-sm btn-quiet"
      >
        No, cancel
      </button>
      {action.allows_document && (
        <label className="flex items-center gap-2 text-ink-2">
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
        <span role={uploadState.kind === "error" ? "alert" : "status"} className={uploadState.kind === "error" ? "text-bad" : "text-ink-2"}>
          {uploadState.text}
        </span>
      )}
    </div>
  );
}
