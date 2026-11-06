import type { z } from "astro/zod";

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const error = (status: number, message: string, details?: unknown) =>
  json({ error: message, ...(details ? { details } : {}) }, status);

export const notFound = () => error(404, "not found");

/** Parse the request body with `schema`. Returns [data] or [null, errorResponse]. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
  { partial = false } = {},
): Promise<[z.infer<T>, null] | [null, Response]> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return [null, error(400, "body must be JSON")];
  }
  const r = schema.safeParse(raw);
  if (!r.success) return [null, error(422, "validation failed", r.error.issues)];
  let data = r.data as Record<string, unknown>;
  // For PATCH, keep only the keys the client actually sent (ignore schema defaults).
  if (partial && raw && typeof raw === "object") {
    data = Object.fromEntries(Object.entries(data).filter(([k]) => k in (raw as object)));
  }
  return [data as z.infer<T>, null];
}

export const parseId = (v: string | undefined) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
