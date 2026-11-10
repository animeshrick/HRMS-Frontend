import { apiRequest } from "./client";
import type { MyProfile } from "./types";

export function loadMyProfile(token: string): Promise<MyProfile> {
  return apiRequest<MyProfile>("/me/profile", { method: "GET", token });
}
