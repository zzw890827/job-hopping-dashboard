import type { APIRoute } from "astro";
import { getSettings, putSettings } from "../../lib/db";
import { json, parseBody } from "../../lib/api";
import { settingsInput } from "../../lib/schema";

export const GET: APIRoute = async () => json(await getSettings());

/** PUT /api/settings — merge the given keys. */
export const PUT: APIRoute = async ({ request }) => {
  const [data, err] = await parseBody(request, settingsInput);
  if (err) return err;
  return json(await putSettings(data));
};
