#!/usr/bin/env node
/**
 * Ember — System Prompt & Style manager (Web GUI)
 *
 * Zero-dependency companion to cli.mjs. Serves a small local web app that
 * edits sys_prompts/prompts.json directly — the same file the app's Settings
 * view and /api/prompts read, so changes are live instantly.
 *
 * Usage:
 *   node sys_prompts/gui.mjs            → http://localhost:8619
 *   node sys_prompts/gui.mjs --port 9000
 *   PORT=9000 node sys_prompts/gui.mjs
 *
 * API:
 *   GET    /api/prompts                 → full store
 *   POST   /api/prompts                 → add      {name, type, origin, text}
 *   PATCH  /api/prompts/:id             → rename / edit text / set type / origin
 *   DELETE /api/prompts/:id             → delete
 *   POST   /api/prompts/:id/activate    {slot: "system"|"instructions"}
 *   DELETE /api/prompts/:id/activate    {slot: "system"|"instructions"}
 */

import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "prompts.json");
const MAX_TEXT = 600_000;
const MAX_PROMPTS = 500;

/* ------------------------------ store helpers ------------------------- */

function blank() {
  return { version: 1, activeSystemPromptId: null, activeInstructionsId: null, prompts: [] };
}

function load() {
  if (!existsSync(FILE)) {
    mkdirSync(__dirname, { recursive: true });
    save(blank());
    return blank();
  }
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    return {
      version: 1,
      activeSystemPromptId: typeof parsed.activeSystemPromptId === "string" ? parsed.activeSystemPromptId : null,
      activeInstructionsId: typeof parsed.activeInstructionsId === "string" ? parsed.activeInstructionsId : null,
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
    };
  } catch (err) {
    throw new Error(`prompts.json is not valid JSON: ${err.message}`);
  }
}

function save(data) {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `p-${Date.now()}`
  );
}

/* -------------------------------- helpers ------------------------------ */

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function fail(res, status, msg) {
  json(res, status, { error: msg });
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_TEXT + 65_536) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolvePromise({});
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

/* --------------------------------- server ------------------------------ */

const PORT = Number(process.env.PORT || "") || (process.argv.includes("--port") ? Number(process.argv[process.argv.indexOf("--port") + 1]) : 8619);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  console.error(`✗ Invalid port: ${process.argv[process.argv.indexOf("--port") + 1] ?? process.env.PORT}`);
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  const method = req.method || "GET";

  try {
    /* ------------------------------ UI ------------------------------- */
    if (method === "GET" && (path === "/" || path === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(PAGE);
      return;
    }

    /* ----------------------------- API ------------------------------- */
    if (path === "/api/prompts" && method === "GET") {
      json(res, 200, load());
      return;
    }

    if (path === "/api/prompts" && method === "POST") {
      const body = await readBody(req);
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const type = body.type === "style" ? "style" : "system-prompt";
      const origin = body.origin === "leaked" ? "leaked" : "user";
      const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT) : "";
      if (!name) return fail(res, 400, "Name is required.");
      if (!text.trim()) return fail(res, 400, "Text is empty.");

      const data = load();
      if (data.prompts.length >= MAX_PROMPTS) return fail(res, 400, `Store is full (${MAX_PROMPTS} prompts max).`);
      const now = Date.now();
      const doc = {
        id: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        type,
        origin,
        text,
        createdAt: now,
        updatedAt: now,
      };
      data.prompts.push(doc);
      save(data);
      json(res, 201, doc);
      return;
    }

    /* /api/prompts/:id or /api/prompts/:id/activate */
    const m = path.match(/^\/api\/prompts\/([^/]+)(\/activate)?$/);
    if (m) {
      const [, id, activate] = m;
      const data = load();
      const doc = data.prompts.find((p) => p.id === id);
      if (!doc) return fail(res, 404, `No prompt with id "${id}".`);

      if (activate && method === "POST") {
        const body = await readBody(req);
        const slot = body.slot;
        if (slot !== "system" && slot !== "instructions") return fail(res, 400, 'slot must be "system" or "instructions".');
        if (slot === "system") data.activeSystemPromptId = id;
        else data.activeInstructionsId = id;
        save(data);
        json(res, 200, doc);
        return;
      }
      if (activate && method === "DELETE") {
        const body = await readBody(req).catch(() => ({}));
        const slot = body.slot;
        if (slot !== "system" && slot !== "instructions") return fail(res, 400, 'slot must be "system" or "instructions".');
        if (slot === "system" && data.activeSystemPromptId === id) data.activeSystemPromptId = null;
        if (slot === "instructions" && data.activeInstructionsId === id) data.activeInstructionsId = null;
        save(data);
        json(res, 200, doc);
        return;
      }
      if (!activate && method === "PATCH") {
        const body = await readBody(req);
        if (typeof body.name === "string" && body.name.trim()) doc.name = body.name.trim().slice(0, 80);
        if (typeof body.text === "string") {
          if (!body.text.trim()) return fail(res, 400, "Text is empty.");
          doc.text = body.text.slice(0, MAX_TEXT);
        }
        if (body.type === "style" || body.type === "system-prompt") doc.type = body.type;
        if (body.type === "prompt") doc.type = "system-prompt";
        if (body.origin === "user" || body.origin === "leaked") doc.origin = body.origin;
        doc.updatedAt = Date.now();
        save(data);
        json(res, 200, doc);
        return;
      }
      if (!activate && method === "DELETE") {
        data.prompts = data.prompts.filter((p) => p.id !== id);
        if (data.activeSystemPromptId === id) data.activeSystemPromptId = null;
        if (data.activeInstructionsId === id) data.activeInstructionsId = null;
        save(data);
        json(res, 200, { ok: true });
        return;
      }
      return fail(res, 405, "Method not allowed.");
    }

    fail(res, 404, "Not found.");
  } catch (err) {
    fail(res, 500, err.message || "Internal error.");
  }
});

server.listen(PORT, () => {
  console.log(`✓ Ember GUI → http://localhost:${PORT}`);
  console.log(`  editing ${FILE}`);
});

/* ------------------------------ front end ------------------------------ */

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ember — Prompt &amp; Style Manager</title>
<style>
  :root {
    --bg: #0d0f14; --panel: #151823; --panel2: #1b1f2e; --border: #262c3f;
    --text: #e2e6f0; --dim: #8b93a8; --accent: #ff6d3a; --accent2: #ffb26b;
    --ok: #4ade80; --err: #f87171; --chip: #232939;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  header {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, #171b28, #12151f);
  }
  header h1 { font-size: 16px; margin: 0; letter-spacing: .3px; }
  header h1 .flame { color: var(--accent); }
  header .file { color: var(--dim); font-size: 12px; margin-left: auto; }
  main { max-width: 1100px; margin: 0 auto; padding: 20px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
  input[type="search"], select, textarea, input[type="text"] {
    background: var(--panel2); color: var(--text); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 10px; font: inherit;
  }
  input[type="search"] { flex: 1; min-width: 200px; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
  button {
    background: var(--panel2); color: var(--text); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 12px; font: inherit; cursor: pointer;
  }
  button:hover { border-color: var(--accent); }
  button.primary { background: var(--accent); border-color: var(--accent); color: #14100c; font-weight: 600; }
  button.primary:hover { background: var(--accent2); }
  button.danger:hover { border-color: var(--err); color: var(--err); }
  button.small { padding: 3px 9px; font-size: 12px; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .8px;
    color: var(--dim); padding: 8px 10px; border-bottom: 1px solid var(--border);
  }
  td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:hover td { background: rgba(255, 109, 58, .04); }
  .chip {
    display: inline-block; background: var(--chip); border: 1px solid var(--border);
    border-radius: 999px; padding: 1px 9px; font-size: 11.5px; color: var(--dim); margin: 1px 2px 1px 0;
  }
  .chip.active { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
  .chip.type-style { color: var(--accent2); }
  .empty { color: var(--dim); text-align: center; padding: 48px 0; }
  dialog {
    background: var(--panel); color: var(--text); border: 1px solid var(--border);
    border-radius: 12px; padding: 0; width: min(720px, 92vw);
  }
  dialog::backdrop { background: rgba(5, 7, 12, .7); }
  dialog .head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid var(--border); font-weight: 600;
  }
  dialog .body { padding: 16px 18px; display: grid; gap: 12px; }
  dialog label { display: grid; gap: 4px; font-size: 12px; color: var(--dim); }
  dialog textarea { min-height: 260px; resize: vertical; font: 12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .row > label { flex: 1; min-width: 140px; }
  dialog .foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 18px; border-top: 1px solid var(--border); }
  .toast {
    position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
    background: var(--panel2); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 14px; font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none;
  }
  .toast.show { opacity: 1; }
  .toast.err { color: var(--err); border-color: color-mix(in srgb, var(--err) 40%, transparent); }
  .toast.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 40%, transparent); }
  .actions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
</style>
</head>
<body>
<header>
  <h1><span class="flame">▲</span> Ember <span style="color:var(--dim);font-weight:400">· prompt &amp; style manager</span></h1>
  <span class="file">sys_prompts/prompts.json · changes are live instantly</span>
</header>
<main>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Filter by name, type, origin, active slot…">
    <select id="typeFilter">
      <option value="">All types</option>
      <option value="system-prompt">Prompts</option>
      <option value="style">Styles</option>
    </select>
    <button class="primary" id="btnAdd">＋ Add</button>
    <button id="btnRefresh" title="Reload from disk">↻ Refresh</button>
  </div>
  <div class="panel">
    <table>
      <thead><tr><th style="width:28%">Name</th><th style="width:10%">Type</th><th style="width:9%">From</th><th style="width:7%">Chars</th><th style="width:26%">Active</th><th style="width:20%">Actions</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <div id="empty" class="empty" hidden>No prompts or styles yet — click <b>Add</b> to create the first one.</div>
  </div>
</main>

<dialog id="dlg">
  <div class="head"><span id="dlgTitle">Add prompt</span><button class="small" id="dlgClose">✕</button></div>
  <div class="body">
    <label>Name <input id="fName" type="text" maxlength="80" placeholder="My prompt"></label>
    <div class="row">
      <label>Type
        <select id="fType"><option value="system-prompt">prompt</option><option value="style">style</option></select>
      </label>
      <label>From
        <select id="fOrigin"><option value="user">user</option><option value="leaked">leaked</option></select>
      </label>
    </div>
    <label>Text (markdown / plain)
      <textarea id="fText" spellcheck="false" placeholder="Paste prompt text here… (max 600,000 chars)"></textarea>
    </label>
    <div id="dlgError" style="color:var(--err);font-size:13px"></div>
  </div>
  <div class="foot">
    <button id="dlgCancel">Cancel</button>
    <button class="primary" id="dlgSave">Save</button>
  </div>
</dialog>

<dialog id="viewDlg">
  <div class="head"><span id="viewTitle">View</span><button class="small" id="viewClose">✕</button></div>
  <div class="body"><pre id="viewMeta" style="margin:0;color:var(--dim);font-size:12px"></pre><pre id="viewText" style="margin:0;white-space:pre-wrap;font:12.5px/1.55 ui-monospace,Menlo,monospace;max-height:60vh;overflow:auto"></pre></div>
  <div class="foot"><button id="viewDone">Close</button></div>
</dialog>

<div id="toast" class="toast"></div>

<script>
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { data: null, filter: "", typeFilter: "" };
  let toastTimer = null;

  const toast = (msg, kind = "ok") => {
    const el = $("toast");
    el.textContent = msg;
    el.className = "toast show " + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = "toast"), 2600);
  };

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, opts) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...opts,
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }

  async function refresh() {
    state.data = await api("/api/prompts");
    render();
  }

  function render() {
    const d = state.data;
    const q = state.filter.toLowerCase();
    const tf = state.typeFilter;
    const list = d.prompts.filter((p) =>
      (!tf || p.type === tf) &&
      (!q || [p.name, p.type, p.origin, p.id,
        d.activeSystemPromptId === p.id ? "system" : "",
        d.activeInstructionsId === p.id ? "instructions" : ""].join(" ").toLowerCase().includes(q)));

    $("empty").hidden = list.length > 0;
    $("rows").innerHTML = list.map((p) => {
      const sys = d.activeSystemPromptId === p.id;
      const instr = d.activeInstructionsId === p.id;
      const chips = [
        sys ? '<span class="chip active">★ system</span>' : "",
        instr ? '<span class="chip active">★ instructions</span>' : "",
        (!sys && !instr) ? '<span class="chip">—</span>' : "",
      ].join("");
      return \`<tr data-id="\${p.id}">
        <td><b>\${esc(p.name)}</b><div style="color:var(--dim);font-size:11px">\${esc(p.id)}</div></td>
        <td><span class="chip \${p.type === "style" ? "type-style" : ""}">\${esc(p.type === "style" ? "style" : "prompt")}</span></td>
        <td><span class="chip">\${esc(p.origin)}</span></td>
        <td>\${p.text.length.toLocaleString()}</td>
        <td>\${chips}</td>
        <td><div class="actions">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="small" data-act="view">View</button>
            <button class="small" data-act="edit">Edit</button>
            <button class="small danger" data-act="delete">Delete</button>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="small" data-act="use-system">\${sys ? "Unuse system" : "Use as system"}</button>
            <button class="small" data-act="use-instr">\${instr ? "Unuse instructions" : "Use as instructions"}</button>
          </div>
        </div></td>
      </tr>\`;
    }).join("");
  }

  let editing = null; // null = add mode

  function openAdd() {
    editing = null;
    $("dlgTitle").textContent = "Add prompt";
    $("fName").value = ""; $("fType").value = "system-prompt"; $("fOrigin").value = "user"; $("fText").value = "";
    $("dlgError").textContent = "";
    $("dlg").showModal();
    $("fName").focus();
  }

  function openEdit(p) {
    editing = p;
    $("dlgTitle").textContent = "Edit — " + p.name;
    $("fName").value = p.name; $("fType").value = p.type; $("fOrigin").value = p.origin; $("fText").value = p.text;
    $("dlgError").textContent = "";
    $("dlg").showModal();
  }

  async function saveDialog() {
    const name = $("fName").value.trim();
    const text = $("fText").value;
    if (!name) { $("dlgError").textContent = "Name is required."; return; }
    if (!text.trim()) { $("dlgError").textContent = "Text is empty."; return; }
    const payload = { name, text, type: $("fType").value, origin: $("fOrigin").value };
    try {
      if (editing) await api("/api/prompts/" + encodeURIComponent(editing.id), { method: "PATCH", body: payload });
      else await api("/api/prompts", { method: "POST", body: payload });
      $("dlg").close();
      toast(editing ? "Updated ✓" : "Added ✓");
      await refresh();
    } catch (e) { $("dlgError").textContent = e.message; }
  }

  function openView(p) {
    $("viewTitle").textContent = p.name;
    $("viewMeta").textContent = \`id: \${p.id} · type: \${p.type} · from: \${p.origin} · chars: \${p.text.length.toLocaleString()} · updated: \${new Date(p.updatedAt).toISOString()}\`;
    $("viewText").textContent = p.text;
    $("viewDlg").showModal();
  }

  async function activate(id, slot, on) {
    await api(\`/api/prompts/\${encodeURIComponent(id)}/activate\`, { method: on ? "POST" : "DELETE", body: { slot } });
    toast(on ? ("Now active in " + slot + " slot ✓") : (slot + " slot cleared ✓"));
    await refresh();
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const p = state.data.prompts.find((x) => x.id === id);
    if (!p) return;
    try {
      switch (btn.dataset.act) {
        case "view": openView(p); break;
        case "edit": openEdit(p); break;
        case "delete":
          if (!confirm("Delete \\"" + p.name + "\\"? Active slots will be cleared.")) return;
          await api("/api/prompts/" + encodeURIComponent(id), { method: "DELETE" });
          toast("Deleted ✓");
          await refresh();
          break;
        case "use-system": await activate(id, "system", state.data.activeSystemPromptId !== id); break;
        case "use-instr": await activate(id, "instructions", state.data.activeInstructionsId !== id); break;
      }
    } catch (err) { toast(err.message, "err"); }
  });

  $("btnAdd").onclick = openAdd;
  $("dlgSave").onclick = saveDialog;
  $("dlgCancel").onclick = () => $("dlg").close();
  $("dlgClose").onclick = () => $("dlg").close();
  $("viewDone").onclick = () => $("viewDlg").close();
  $("viewClose").onclick = () => $("viewDlg").close();
  $("btnRefresh").onclick = () => refresh().then(() => toast("Reloaded ✓")).catch((e) => toast(e.message, "err"));
  $("q").oninput = (e) => { state.filter = e.target.value; render(); };
  $("typeFilter").onchange = (e) => { state.typeFilter = e.target.value; render(); };

  refresh().catch((e) => toast(e.message, "err"));
})();
</script>
</body>
</html>`;
