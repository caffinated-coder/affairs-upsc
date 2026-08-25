import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  visitorId: z.string().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/),
  leave: z.boolean().optional(),
});

export const heartbeatFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<{ online: number }> => {
    const { heartbeat } = await import("./store.server");
    return { online: heartbeat(data.visitorId, data.leave === true) };
  });
