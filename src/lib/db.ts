import { env } from "cloudflare:workers";
import { DEFAULT_SETTINGS, type Settings } from "./schema";

export type Application = {
  id: number;
  list: "active" | "pending" | "closed";
  company: string;
  position: string;
  label: string | null;
  ref: string | null;
  stage: string | null;
  status: "wait" | "good" | "risk" | "todo" | "closed";
  agent: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_text: string | null;
  fit: string | null;
  next_action: string | null;
  since: string | null;
  received: string | null;
  deadline: string | null;
  note: string | null;
  result: string | null;
  link: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
};
export type Event = { id: number; at: string; text: string; created_at: string };
export type Todo = { id: number; text: string; who: string; done: boolean; sort: number };

export const db = () => env.DB;

/** Columns that callers may write, per table (whitelist for dynamic SQL). */
export const COLUMNS = {
  applications: [
    "list", "company", "position", "label", "ref", "stage", "status", "agent",
    "salary_min", "salary_max", "salary_text", "fit", "next_action", "since",
    "received", "deadline", "note", "result", "link", "sort",
  ],
  events: ["at", "text"],
  todos: ["text", "who", "done", "sort"],
} as const;
export type Table = keyof typeof COLUMNS;

const toSql = (v: unknown) => (typeof v === "boolean" ? (v ? 1 : 0) : v ?? null);
const touches = (t: Table) => t !== "events";

export async function insertRow(table: Table, data: Record<string, unknown>) {
  const cols = COLUMNS[table].filter((c) => c in data);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING id`;
  const row = await db().prepare(sql).bind(...cols.map((c) => toSql(data[c]))).first<{ id: number }>();
  return row!.id;
}

export async function updateRow(table: Table, id: number, data: Record<string, unknown>) {
  const cols = COLUMNS[table].filter((c) => c in data);
  if (!cols.length) return getRow(table, id);
  const sets = cols.map((c) => `${c} = ?`);
  if (touches(table)) sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`);
  const res = await db()
    .prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...cols.map((c) => toSql(data[c])), id)
    .run();
  return res.meta.changes ? getRow(table, id) : null;
}

export async function deleteRow(table: Table, id: number) {
  const res = await db().prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return res.meta.changes > 0;
}

export async function getRow(table: Table, id: number) {
  const row = await db().prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  return row && table === "todos" ? normalizeTodo(row as never) : row;
}

const normalizeTodo = (t: Todo & { done: number | boolean }): Todo => ({ ...t, done: !!t.done });

export async function listApplications(list?: string) {
  const q = list
    ? db().prepare("SELECT * FROM applications WHERE list = ? ORDER BY sort, id").bind(list)
    : db().prepare("SELECT * FROM applications ORDER BY sort, id");
  return (await q.all<Application>()).results;
}

export async function listEvents(limit = 200) {
  return (
    await db().prepare("SELECT * FROM events ORDER BY at DESC, id DESC LIMIT ?").bind(limit).all<Event>()
  ).results;
}

export async function listTodos() {
  const { results } = await db()
    .prepare("SELECT id, text, who, done, sort FROM todos ORDER BY done, sort, id")
    .all<Todo & { done: number }>();
  return results.map(normalizeTodo);
}

export async function getSettings(): Promise<Settings> {
  const { results } = await db().prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of results) {
    try {
      s[r.key] = JSON.parse(r.value);
    } catch {
      /* ignore malformed value */
    }
  }
  return s as Settings;
}

export async function putSettings(values: Record<string, unknown>) {
  const stmts = Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) =>
      db()
        .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(k, JSON.stringify(v)),
    );
  if (stmts.length) await db().batch(stmts);
  return getSettings();
}

export async function getDashboard() {
  const [settings, applications, events, todos] = await Promise.all([
    getSettings(),
    listApplications(),
    listEvents(),
    listTodos(),
  ]);
  return { settings, applications, events, todos };
}
