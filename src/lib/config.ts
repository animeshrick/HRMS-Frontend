// Settings used across the app. Nothing secret belongs here (a frontend is public).

// In development the Vite proxy forwards "/api" to the FastAPI server (see vite.config.ts).
export const API_BASE_URL: string = String(import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export const REQUEST_TIMEOUT_MILLISECONDS = 15_000; // normal calls
export const CHAT_TIMEOUT_MILLISECONDS = 60_000; // the assistant can take a while to answer
export const IDLE_LOGOUT_MINUTES = 30; // log out after this much inactivity

// These limits mirror the backend rules, so mistakes are caught before a request is sent.
// The backend still checks everything again.
export const MAXIMUM_QUESTION_LENGTH = 1000;
export const MINIMUM_NEW_PASSWORD_LENGTH = 10;
export const MAXIMUM_PASSWORD_BYTES = 72;
export const MAXIMUM_EMPLOYEE_ID_LENGTH = 50;
