type App = Record<string, string | number | null> & { id: number };

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const apps: App[] = JSON.parse($("#apps-data").textContent || "[]");

function toast(msg: string) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = (await res.json()) as { error: string; details?: { path: string[]; message: string }[] };
      msg = j.error + (j.details ? `: ${j.details.map((d) => `${d.path.join(".")} ${d.message}`).join("; ")}` : "");
    } catch { /* not JSON */ }
    toast(`保存失败：${msg}`);
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}
const reload = () => location.reload();

/** Two-step delete without blocking browser dialogs. */
function confirmClick(btn: HTMLElement, action: () => Promise<unknown>) {
  if (btn.dataset.armed) return action().then(reload);
  btn.dataset.armed = "1";
  const old = btn.textContent;
  btn.textContent = "确认删除？";
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 3000);
}

/* ---------- theme ---------- */
$("#themeBtn").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("jh-theme", root.dataset.theme); } catch { /* ignore */ }
});
try {
  const saved = localStorage.getItem("jh-theme");
  if (saved) document.documentElement.dataset.theme = saved;
} catch { /* ignore */ }

/* ---------- salary tooltip ---------- */
const box = $("#salary"), tip = $("#tip");
box.querySelectorAll<SVGGElement>(".hit").forEach((el) => {
  el.addEventListener("mousemove", (e) => {
    const { name, min, max } = el.dataset;
    tip.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = name ?? "";
    tip.appendChild(b);
    tip.appendChild(document.createTextNode(`${min ? Number(min).toLocaleString() + " – " : "上限 "}${Number(max).toLocaleString()} 万円`));
    const r = box.getBoundingClientRect();
    let left = e.clientX - r.left + 12;
    if (left > r.width - 200) left = e.clientX - r.left - 212;
    tip.style.left = `${left}px`;
    tip.style.top = `${e.clientY - r.top + 12}px`;
    tip.style.opacity = "1";
  });
  el.addEventListener("mouseleave", () => (tip.style.opacity = "0"));
});

/* ---------- todos ---------- */
document.addEventListener("change", async (e) => {
  const cb = e.target as HTMLInputElement;
  if (!cb.dataset.todo) return;
  cb.closest("li")?.classList.toggle("done", cb.checked);
  try {
    await api("PATCH", `/api/todos/${cb.dataset.todo}`, { done: cb.checked });
  } catch {
    cb.checked = !cb.checked;
    cb.closest("li")?.classList.toggle("done", cb.checked);
  }
});
$<HTMLFormElement>("#todoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target as HTMLFormElement);
  await api("POST", "/api/todos", { text: f.get("text"), who: f.get("who") || "" });
  reload();
});

/* ---------- events ---------- */
const at = $<HTMLInputElement>('#eventForm input[name="at"]');
const d = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4);
at.value = d.toISOString().slice(0, 16);
$<HTMLFormElement>("#eventForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target as HTMLFormElement);
  await api("POST", "/api/events", { at: String(f.get("at")).replace("T", " "), text: f.get("text") });
  reload();
});

/* ---------- delete buttons ---------- */
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-del-todo],[data-del-event]");
  if (!btn) return;
  const path = btn.dataset.delTodo ? `/api/todos/${btn.dataset.delTodo}` : `/api/events/${btn.dataset.delEvent}`;
  confirmClick(btn, () => api("DELETE", path));
});

/* ---------- application editor ---------- */
const dlg = $<HTMLDialogElement>("#editDialog");
const form = $<HTMLFormElement>("#editForm");
const NUM = new Set(["salary_min", "salary_max"]);

function openEditor(app?: App, list = "active") {
  form.reset();
  $("#editTitle").textContent = app ? "编辑案件" : "添加案件";
  $("#editDelete").hidden = !app;
  const values: Record<string, unknown> = app ?? { list, status: list === "closed" ? "closed" : "wait" };
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (el.name && el.name in values) el.value = values[el.name] == null ? "" : String(values[el.name]);
  }
  dlg.showModal();
}

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("a")) return;
  const edit = t.closest<HTMLElement>("[data-edit]");
  if (edit) return openEditor(apps.find((a) => a.id === Number(edit.dataset.edit)));
  const add = t.closest<HTMLElement>("[data-new]");
  if (add) openEditor(undefined, add.dataset.new);
});
document.addEventListener("keydown", (e) => {
  const edit = (e.target as HTMLElement).closest?.<HTMLElement>(".job[data-edit]");
  if (edit && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openEditor(apps.find((a) => a.id === Number(edit.dataset.edit)));
  }
});
$("#editCancel").addEventListener("click", () => dlg.close());

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body: Record<string, unknown> = {};
  let id = "";
  for (const [k, v] of new FormData(form)) {
    if (k === "id") { id = String(v); continue; }
    const s = String(v).trim();
    body[k] = NUM.has(k) ? (s === "" ? null : Number(s)) : s === "" ? null : s;
  }
  body.position ??= "";
  await api(id ? "PATCH" : "POST", id ? `/api/applications/${id}` : "/api/applications", body);
  dlg.close();
  reload();
});
$("#editDelete").addEventListener("click", (e) => {
  const id = (form.elements.namedItem("id") as HTMLInputElement).value;
  if (id) confirmClick(e.currentTarget as HTMLElement, () => api("DELETE", `/api/applications/${id}`));
});
