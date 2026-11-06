import type { APIRoute } from "astro";
import { getDashboard } from "../../lib/db";
import { json } from "../../lib/api";

/** GET /api/dashboard — everything the page needs (also usable as a JSON export). */
export const GET: APIRoute = async () => json(await getDashboard());
