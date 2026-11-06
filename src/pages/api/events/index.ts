import type { APIRoute } from "astro";
import { getRow, insertRow, listEvents } from "../../../lib/db";
import { json, parseBody } from "../../../lib/api";
import { eventInput } from "../../../lib/schema";

export const GET: APIRoute = async ({ url }) => json(await listEvents(Math.min(Number(url.searchParams.get("limit")) || 200, 1000)));

export const POST: APIRoute = async ({ request }) => {
  const [data, err] = await parseBody(request, eventInput);
  if (err) return err;
  const id = await insertRow("events", data);
  return json(await getRow("events", id), 201);
};
