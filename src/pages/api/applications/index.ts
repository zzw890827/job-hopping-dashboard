import type { APIRoute } from "astro";
import { getRow, insertRow, listApplications } from "../../../lib/db";
import { json, parseBody } from "../../../lib/api";
import { applicationInput } from "../../../lib/schema";

export const GET: APIRoute = async ({ url }) => json(await listApplications(url.searchParams.get("list") ?? undefined));

export const POST: APIRoute = async ({ request }) => {
  const [data, err] = await parseBody(request, applicationInput);
  if (err) return err;
  const id = await insertRow("applications", data);
  return json(await getRow("applications", id), 201);
};
