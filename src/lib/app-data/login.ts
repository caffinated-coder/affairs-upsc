import type { CallToolResult } from "./types.ts";
export function isLoginRequired(result: CallToolResult): boolean {
  return result.ok === false && result.loginRequired === true;
}
export function redirectToLoginIfRequired(result: CallToolResult): boolean {
  if (!isLoginRequired(result)) return false;
  if (!result.loginUrl || typeof window === "undefined") return false;
  window.location.assign(result.loginUrl);
  return true;
}
