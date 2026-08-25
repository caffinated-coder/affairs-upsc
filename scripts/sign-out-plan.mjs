export const PREVIEW_SIGN_OUT_TIMEOUT_MS = 1500;
export const DEPLOYED_SIGN_OUT_TIMEOUT_MS = 10_000;
export function signOutTimeoutMs(livePreview) {
  return livePreview ? PREVIEW_SIGN_OUT_TIMEOUT_MS : DEPLOYED_SIGN_OUT_TIMEOUT_MS;
}
export async function settleWithin(start, timeoutMs) {
  return Promise.race([
    Promise.resolve().then(start).then(() => "ok").catch(() => "failed"),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
  ]);
}
export async function runSignOutSteps({ requestSignOut, clearToken, redirect, livePreview, hasBearer }) {
  const outcome = await settleWithin(requestSignOut, signOutTimeoutMs(livePreview));
  if (hasBearer) clearToken();
  if (outcome === "ok" || (livePreview && hasBearer)) redirect();
  return outcome;
}
