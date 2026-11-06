import type { APIRoute } from "astro";
import { getRow, insertRow, listTodos } from "../../../lib/db";
import { json, parseBody } from "../../../lib/api";
import { todoInput } from "../../../lib/schema";

export const GET: APIRoute = async () => json(await listTodos());

export const POST: APIRoute = async ({ request }) => {
  const [data, err] = await parseBody(request, todoInput);
  if (err) return err;
  const id = await insertRow("todos", data);
  return json(await getRow("todos", id), 201);
};
