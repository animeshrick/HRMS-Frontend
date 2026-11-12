import { apiRequest } from "./client";

export interface Celebration {
  emp_id: string;
  full_name: string;
  dept: string | null;
  kind: "birthday" | "anniversary";
  years: number | null; // only for an anniversary
}

export const getCelebrations = (token: string) => apiRequest<Celebration[]>("/celebrations", { token });
