import { z } from "astro/zod";

export const LISTS = ["active", "pending", "closed"] as const;
export const STATUSES = ["wait", "good", "risk", "todo", "closed"] as const;

const text = (max = 500) => z.string().trim().max(max);
const optText = (max = 500) => text(max).nullish().transform((v) => (v ? v : null));
const salary = z.number().int().min(0).max(100000).nullish().transform((v) => v ?? null);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/, "use YYYY-MM-DD or YYYY-MM-DD HH:MM");

export const applicationInput = z.object({
  list: z.enum(LISTS),
  company: text(200).min(1),
  position: text(300).default(""),
  label: optText(60),
  ref: optText(60),
  stage: optText(40),
  status: z.enum(STATUSES).default("wait"),
  agent: optText(120),
  salary_min: salary,
  salary_max: salary,
  salary_text: optText(60),
  fit: optText(120),
  next_action: optText(),
  since: optText(200),
  received: optText(20),
  deadline: date.nullish().or(z.literal("")).transform((v) => (v ? v.slice(0, 10) : null)),
  note: optText(),
  result: optText(),
  link: z.url({ protocol: /^https?$/ }).max(500).nullish().or(z.literal("")).transform((v) => (v ? v : null)),
  sort: z.number().int().default(0),
});
export const applicationPatch = applicationInput.partial();
export type ApplicationInput = z.infer<typeof applicationInput>;

export const eventInput = z.object({ at: date, text: text(500).min(1) });
export const eventPatch = eventInput.partial();

export const todoInput = z.object({
  text: text(500).min(1),
  who: text(60).default(""),
  done: z.boolean().default(false),
  sort: z.number().int().default(0),
});
export const todoPatch = todoInput.partial();

export const settingsInput = z.object({
  today: date.optional(),
  current: z.number().int().min(0).max(100000).optional(),
  targetMin: z.number().int().min(0).max(100000).optional(),
  target: z.number().int().min(0).max(100000).optional(),
  earliestStart: text(40).optional(),
  stages: z.array(text(40).min(1)).min(1).max(10).optional(),
});
export type Settings = {
  today?: string;
  current: number;
  targetMin: number;
  target: number;
  earliestStart: string;
  stages: string[];
};
export const DEFAULT_SETTINGS: Settings = {
  current: 0,
  targetMin: 0,
  target: 0,
  earliestStart: "",
  stages: ["Interested", "Preparing", "Screening", "Interview", "Offer"],
};

/** Full import/export document (seed files use this shape). */
export const dataFile = z.object({
  settings: settingsInput,
  applications: z.array(applicationInput),
  events: z.array(eventInput),
  todos: z.array(todoInput),
});
export type DataFile = z.infer<typeof dataFile>;
