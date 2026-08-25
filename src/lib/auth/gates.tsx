import type { ReactNode } from "react";
import { useCurrentUserState } from "./use-current-user";
export const SIGN_IN_PATH = "/login";
export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}
export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}
export function RedirectToSignIn() { return null; }
