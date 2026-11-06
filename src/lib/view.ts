import type { Application } from "./db";
import type { Settings } from "./schema";

export const STATUS: Record<Application["status"], [string, string]> = {
  wait: ["s-wait", "等对方"],
  good: ["s-good", "顺利"],
  risk: ["s-risk", "有风险"],
  todo: ["s-todo", "轮到我"],
  closed: ["s-closed", "已结束"],
};

export const fmt = (n: number) => n.toLocaleString("en-US");
export const shortName = (a: Application) => a.label || a.company;

/** Today in Japan time unless settings.today overrides it (YYYY-MM-DD). */
export const today = (s: Settings) =>
  s.today ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

export const daysUntil = (date: string, from: string) =>
  Math.round((Date.parse(date) - Date.parse(from)) / 864e5);

/** "2026-11-06 13:45" -> "11/06 13:45" */
export const shortDate = (d: string | null) => (d ? d.slice(5).replace("-", "/") : "");

export type SalaryRow = { name: string; min: number | null; max: number };

export function salaryChart(apps: Application[], s: Settings) {
  const rows: SalaryRow[] = apps
    .filter((a) => a.list !== "closed" && a.salary_max)
    .map((a) => ({ name: shortName(a), min: a.salary_min, max: a.salary_max! }));

  const W = 640, rowH = 34, padL = 150, padR = 24, padT = 8, padB = 28;
  const H = padT + Math.max(rows.length, 1) * rowH + padB;
  const values = [s.current, s.targetMin, ...rows.flatMap((r) => [r.min ?? r.max, r.max])].filter((v) => v > 0);
  const step = 400;
  const x0 = Math.floor((Math.min(...values, 600) - 100) / 200) * 200;
  const x1 = Math.ceil((Math.max(...values, 1000) + 100) / 200) * 200;
  const sx = (v: number) => padL + ((v - x0) / (x1 - x0)) * (W - padL - padR);
  const ticks: number[] = [];
  for (let t = Math.ceil(x0 / step) * step; t <= x1; t += step) ticks.push(t);
  return { rows, W, H, rowH, padL, padR, padT, padB, sx, ticks };
}

export function kpis(apps: Application[], openTodos: number) {
  const by = (l: Application["list"]) => apps.filter((a) => a.list === l);
  const names = (xs: Application[]) => [...new Set(xs.map(shortName))].join(" · ") || "—";
  const active = by("active"), pending = by("pending"), closed = by("closed");
  const mine = apps.filter((a) => a.list !== "closed" && a.status === "todo");
  return [
    { label: "进行中", value: active.length, note: names(active) },
    { label: "待回复推荐", value: pending.length, note: names(pending) },
    { label: "已结束", value: closed.length, note: closed.length ? `最近：${shortName(closed[closed.length - 1])}` : "—" },
    { label: "未完成待办", value: openTodos, note: mine.length ? `轮到我：${names(mine)}` : "没有等我行动的案件" },
  ];
}
