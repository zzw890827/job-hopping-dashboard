import type { APIRoute } from "astro";
import { deleteRow, getRow, updateRow } from "../../../lib/db";
import { error, json, notFound, parseBody, parseId } from "../../../lib/api";
import { applicationPatch } from "../../../lib/schema";

export const GET: APIRoute = async ({ params }) => {
  const id = parseId(params.id);
  const row = id && (await getRow("applications", id));
  return row ? json(row) : notFound();
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseId(params.id);
  if (!id) return error(400, "invalid id");
  const [data, err] = await parseBody(request, applicationPatch, { partial: true });
  if (err) return err;
  const row = await updateRow("applications", id, data);
  return row ? json(row) : notFound();
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = parseId(params.id);
  if (!id) return error(400, "invalid id");
  return (await deleteRow("applications", id)) ? new Response(null, { status: 204 }) : notFound();
};
