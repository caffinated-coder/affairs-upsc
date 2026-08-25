export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";
export function getBearerToken(): string | null { return null; }
export const GROK_PROVIDERS: { providerId: string; label: string }[] = [];
export async function signOut() {}
export const authClient = {
  useSession() { return { data: null, isPending: false }; },
};
