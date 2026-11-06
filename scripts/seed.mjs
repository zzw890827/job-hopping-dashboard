#!/usr/bin/env node
// Convert a data JSON file (see data/sample.json) into SQL that REPLACES all
// rows in the D1 database, then optionally apply it with wrangler.
//
//   node scripts/seed.mjs data/sample.json            # print SQL
//   node scripts/seed.mjs data/sample.json --local    # apply to local dev DB
//   node scripts/seed.mjs ~/private.json --remote     # apply to production (refuses if not empty;
//                                                      add --force to wipe and replace)
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { dataFile } from "../src/lib/schema.ts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const [file, target] = args.filter((a) => a !== "--force");
if (!file) {
  console.error("usage: node scripts/seed.mjs <data.json> [--local|--remote]");
  process.exit(1);
}

const parsed = dataFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error("invalid data file:");
  for (const i of parsed.error.issues) console.error(`  ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
const data = parsed.data;

const lit = (v) =>
  v == null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "1" : "0") : `'${String(v).replaceAll("'", "''")}'`;
const insert = (table, row) => {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => lit(row[c])).join(", ")});`;
};

const sql = [
  "DELETE FROM settings;",
  "DELETE FROM applications;",
  "DELETE FROM events;",
  "DELETE FROM todos;",
  "DELETE FROM sqlite_sequence WHERE name IN ('applications', 'events', 'todos');",
  ...Object.entries(data.settings).map(([k, v]) => insert("settings", { key: k, value: JSON.stringify(v) })),
  ...data.applications.map((a, i) => insert("applications", { ...a, sort: a.sort || i })),
  ...data.events.map((e) => insert("events", e)),
  ...data.todos.map((t, i) => insert("todos", { ...t, sort: t.sort || i })),
].join("\n");

if (!target) {
  process.stdout.write(sql + "\n");
} else {
  if (!["--local", "--remote"].includes(target)) throw new Error(`unknown option ${target}`);
  if (target === "--remote" && !force) {
    const res = JSON.parse(
      execFileSync("npx", ["wrangler", "d1", "execute", "DB", "--remote", "--json", "--command",
        "SELECT (SELECT count(*) FROM applications) + (SELECT count(*) FROM events) + (SELECT count(*) FROM todos) AS n"],
        { encoding: "utf8" }),
    );
    const n = res[0]?.results?.[0]?.n ?? 0;
    if (n > 0) {
      console.error(`remote database already has ${n} rows; seeding would DELETE them. Re-run with --force to overwrite.`);
      process.exit(1);
    }
  }
  const out = join(mkdtempSync(join(tmpdir(), "seed-")), "seed.sql");
  writeFileSync(out, sql);
  execFileSync("npx", ["wrangler", "d1", "execute", "DB", target, "--file", out, "--yes"], { stdio: "inherit" });
  console.log(
    `seeded ${data.applications.length} applications, ${data.events.length} events, ${data.todos.length} todos (${target.slice(2)})`,
  );
}
