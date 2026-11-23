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


// ---------------------------------------------------------------- government ID (Aadhaar / PAN)
export const MAXIMUM_GOVERNMENT_ID_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_GOVERNMENT_ID_IMAGE_TYPES = ["image/png", "image/jpeg", "application/pdf"];

// The same Verhoeff tables the backend uses: the last digit of an Aadhaar number is calculated
// from the first eleven, so a mistyped number can be caught here before anything is sent.
const VERHOEFF_MULTIPLICATION = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_PERMUTATION = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function hasValidAadhaarChecksum(digits: string): boolean {
  let checksum = 0;
  const reversedDigits = digits.split("").reverse();
  for (let position = 0; position < reversedDigits.length; position += 1) {
    const digit = Number(reversedDigits[position]);
    checksum = VERHOEFF_MULTIPLICATION[checksum]![VERHOEFF_PERMUTATION[position % 8]![digit]!]!;
  }
  return checksum === 0;
}

/** Removes the spaces and dashes people type, and upper-cases a PAN. Same as the backend. */
export function cleanGovernmentIdNumber(idType: "aadhaar" | "pan", rawNumber: string): string {
  const withoutGaps = rawNumber.replace(/[\s-]/g, "");
  return idType === "pan" ? withoutGaps.toUpperCase() : withoutGaps;
}

/** Same rules as the backend: 12 digits with a valid check digit, or a PAN like ABCDE1234F. */
export function validateGovernmentIdNumber(idType: "aadhaar" | "pan", rawNumber: string): string | null {
  const number = cleanGovernmentIdNumber(idType, rawNumber);
  if (number.length === 0) {
    return idType === "aadhaar" ? "Enter your Aadhaar number." : "Enter your PAN number.";
  }
  if (idType === "aadhaar") {
    if (!/^\d{12}$/.test(number)) {
      return "An Aadhaar number has 12 digits.";
    }
    if (number.startsWith("0") || number.startsWith("1")) {
      return "An Aadhaar number does not start with 0 or 1. Please check the number.";
    }
    if (!hasValidAadhaarChecksum(number)) {
      return "That Aadhaar number is not valid. Please check the digits and try again.";
    }
    return null;
  }
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(number)) {
    return "A PAN number looks like ABCDE1234F: five letters, four digits, then one letter.";
  }
  return null;
}

/** Same limits as the backend: PNG, JPG or PDF, at most 5 MB. */
export function validateGovernmentIdImage(file: File): string | null {
  if (!ALLOWED_GOVERNMENT_ID_IMAGE_TYPES.includes(file.type)) {
    return "Upload a PNG, JPG or PDF of your ID.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  if (file.size > MAXIMUM_GOVERNMENT_ID_IMAGE_BYTES) {
    return "The file is too large. The limit is 5 MB.";
  }
  return null;
}
