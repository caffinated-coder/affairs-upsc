import { authEnabled } from "./client";
export type AppUser = { id: string; displayName: string | null; primaryEmail: string | null; profileImageUrl: string | null; isDevFallback: boolean };
export const DEV_USER: AppUser = { id: "dev-user", displayName: "Dev User", primaryEmail: "dev@example.com", profileImageUrl: null, isDevFallback: true };
export function useCurrentUserState() {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  return { user: DEV_USER, isPending: false };
}
export function useCurrentUser() { return useCurrentUserState().user; }
