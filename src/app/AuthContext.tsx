// Keeps "who is logged in" for the whole app. The session lives in sessionStorage,
// so a refresh keeps you logged in but closing the tab logs you out.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "../api/client";
import type { LoginResponse, Role } from "../api/types";
import { useQueryClient } from "@tanstack/react-query";
import { IDLE_LOGOUT_MINUTES } from "../lib/config";

export interface Session {
  accessToken: string;
  role: Role;
  fullName: string;
  employeeId: string;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  session: Session | null;
  signIn: (loginResponse: LoginResponse) => void;
  signOut: (notice?: string) => void;
  // A message to show on the login page (for example "Your session expired").
  loginNotice: string | null;
  clearLoginNotice: () => void;
}

const STORAGE_KEY = "hr-assistant-session";

function readStoredSession(): Session | null {
  try {
    const rawText = sessionStorage.getItem(STORAGE_KEY);
    return rawText ? (JSON.parse(rawText) as Session) : null;
  } catch {
    return null; // storage blocked or damaged: act as logged out
  }
}

function writeStoredSession(session: Session | null): void {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore: the app still works for this page load.
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const signIn = useCallback((loginResponse: LoginResponse) => {
    const newSession: Session = {
      accessToken: loginResponse.access_token,
      role: loginResponse.role,
      fullName: loginResponse.full_name,
      employeeId: loginResponse.emp_id,
      mustChangePassword: loginResponse.must_change_password,
    };
    writeStoredSession(newSession);
    setLoginNotice(null);
    setSession(newSession);
  }, []);

  const signOut = useCallback((notice?: string) => {
    writeStoredSession(null);
    queryClient.clear(); // forget leave data of the person who just logged out
    setLoginNotice(notice ?? null);
    setSession(null);
  }, [queryClient]);

  const clearLoginNotice = useCallback(() => setLoginNotice(null), []);

  // If any call gets a 401 (token expired or password changed elsewhere), log out with a message.
  useEffect(() => {
    setUnauthorizedHandler(() => signOut("Your session has ended. Please log in again."));
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Log out after a period without any mouse, keyboard or touch activity.
  const idleTimerReference = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoggedIn = session !== null;
  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    const restartIdleTimer = () => {
      if (idleTimerReference.current) {
        clearTimeout(idleTimerReference.current);
      }
      idleTimerReference.current = setTimeout(
        () => signOut("You were logged out because of inactivity."),
        IDLE_LOGOUT_MINUTES * 60_000,
      );
    };
    const activityEvents = ["mousemove", "keydown", "click", "touchstart"] as const;
    activityEvents.forEach((eventName) => window.addEventListener(eventName, restartIdleTimer));
    restartIdleTimer();
    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, restartIdleTimer));
      if (idleTimerReference.current) {
        clearTimeout(idleTimerReference.current);
      }
    };
  }, [isLoggedIn, signOut]);

  const value = useMemo(
    () => ({ session, signIn, signOut, loginNotice, clearLoginNotice }),
    [session, signIn, signOut, loginNotice, clearLoginNotice],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contextValue = useContext(AuthContext);
  if (!contextValue) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return contextValue;
}
