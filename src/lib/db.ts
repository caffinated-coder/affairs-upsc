export type DbSource = "neon" | "pglite";
export const dbSource: DbSource = process.env.DATABASE_URL?.trim() ? "neon" : "pglite";
export async function ensureDbReady(): Promise<void> {}
export async function getSql(): Promise<{ query: (text: string, params?: unknown[]) => Promise<unknown[]> }> {
  return { query: async () => [] };
}
