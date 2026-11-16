// Quick checks done in the browser before anything is sent. Each function returns an error message, or null when the value is fine.
import {
  MAXIMUM_EMPLOYEE_ID_LENGTH,
  MAXIMUM_PASSWORD_BYTES,
  MAXIMUM_QUESTION_LENGTH,
  MINIMUM_NEW_PASSWORD_LENGTH,
} from "./config";

export function validateEmployeeId(employeeId: string): string | null {
  const trimmedId = employeeId.trim();
  if (trimmedId.length === 0) {
    return "Enter the employee ID.";
  }
  if (trimmedId.length > MAXIMUM_EMPLOYEE_ID_LENGTH) {
    return `The employee ID can have at most ${MAXIMUM_EMPLOYEE_ID_LENGTH} characters.`;
  }
  return null;
}

export function validateRequired(value: string, fieldLabel: string): string | null {
  return value.length === 0 ? `Enter ${fieldLabel}.` : null;
}

/** Same rules as the backend: at least 10 characters, at most 72 bytes, different from the current password. */
export function validateNewPassword(newPassword: string, currentPassword: string): string | null {
  // Array.from counts real characters (an emoji is one), like Python does on the backend.
  if (Array.from(newPassword).length < MINIMUM_NEW_PASSWORD_LENGTH) {
    return `The new password must have at least ${MINIMUM_NEW_PASSWORD_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(newPassword).length > MAXIMUM_PASSWORD_BYTES) {
    return `The new password is too long (at most ${MAXIMUM_PASSWORD_BYTES} bytes).`;
  }
  if (newPassword === currentPassword) {
    return "The new password must be different from the current one.";
  }
  return null;
}

export function validateQuestion(question: string): string | null {
  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length === 0) {
    return "Type a question first.";
  }
  if (trimmedQuestion.length > MAXIMUM_QUESTION_LENGTH) {
    return `A question can have at most ${MAXIMUM_QUESTION_LENGTH} characters.`;
  }
  return null;
}

export const MAXIMUM_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** Same limits as the backend: PDF, PNG or JPG, at most 5 MB. */
export function validateDocument(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return "Only PDF, PNG or JPG files can be uploaded.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  if (file.size > MAXIMUM_DOCUMENT_BYTES) {
    return "The file is too large. The limit is 5 MB.";
  }
  return null;
}

export const MAXIMUM_MESSAGE_BODY_LENGTH = 2000;
export const MAXIMUM_MESSAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MESSAGE_ATTACHMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** A message needs text, an attachment, or both - never neither. Same limit as the backend. */
export function validateMessageBody(body: string, hasAttachment: boolean): string | null {
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0 && !hasAttachment) {
    return "Write a message or attach a file.";
  }
  if (trimmedBody.length > MAXIMUM_MESSAGE_BODY_LENGTH) {
    return `A message can have at most ${MAXIMUM_MESSAGE_BODY_LENGTH} characters.`;
  }
  return null;
}

/** Same limits as the backend: PDF, PNG or JPG, at most 5 MB. */
export function validateMessageAttachment(file: File): string | null {
  if (!ALLOWED_MESSAGE_ATTACHMENT_TYPES.includes(file.type)) {
    return "Only PDF, PNG or JPG files can be attached.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  if (file.size > MAXIMUM_MESSAGE_ATTACHMENT_BYTES) {
    return "The file is too large. The limit is 5 MB.";
  }
  return null;
}

export const MAXIMUM_SHARED_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_SHARED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/** Same limits as the backend: PDF, Word, Excel, PowerPoint, PNG or JPG, at most 20 MB. */
export function validateSharedDocument(file: File): string | null {
  if (!ALLOWED_SHARED_DOCUMENT_TYPES.includes(file.type)) {
    return "That file type is not allowed. Use PDF, Word, Excel, PowerPoint, PNG or JPG.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  if (file.size > MAXIMUM_SHARED_DOCUMENT_BYTES) {
    return "The file is too large. The limit is 20 MB.";
  }
  return null;
}
