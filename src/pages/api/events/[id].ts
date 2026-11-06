import type { APIRoute } from "astro";
import { deleteRow, getRow, updateRow } from "../../../lib/db";
import { error, json, notFound, parseBody, parseId } from "../../../lib/api";
import { eventPatch } from "../../../lib/schema";

export const GET: APIRoute = async ({ params }) => {
  const id = parseId(params.id);
  const row = id && (await getRow("events", id));
  return row ? json(row) : notFound();
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseId(params.id);
  if (!id) return error(400, "invalid id");
  const [data, err] = await parseBody(request, eventPatch, { partial: true });
  if (err) return err;
  const row = await updateRow("events", id, data);
  return row ? json(row) : notFound();
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = parseId(params.id);
  if (!id) return error(400, "invalid id");
  return (await deleteRow("events", id)) ? new Response(null, { status: 204 }) : notFound();
};
