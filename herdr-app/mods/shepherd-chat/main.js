// Chat mode: an agent's conversation (Claude Code, Codex, Copilot, Antigravity, OpenCode) as a
// readable page instead of its terminal.
// The Shepherd layout's `conversation` stack holds the tab (`main`) and this page
// (`chat-page`); the tabs bar's Chat button (shepherd-tabs) chooses between them for each
// tab and keeps shared("shepherd.chat")[tab] = the terminal this page shows. The tab's panes
// never change, so other Herdr clients see nothing of it.
//
// What it shows comes from the agent's transcript, read on the agent's machine (reader.js):
// Claude Code keeps ~/.claude/sessions/<pid>.json for each process, naming its session, and
// the transcript is that session's file under ~/.claude/projects. Messages typed here go in
// with `hc send` (files first with `hc put` when the agent is on another machine); while the
// agent is blocked on a question, the question and its choices are read off its screen and
// answered with `hc keys`. The composer picks the permission mode (shift+tab until its
// footer shows it), the model (/model) and the effort (/effort), and completes / commands,
// skills and @ files. Each terminal keeps its own draft, attachments and conversation.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, TextView, TextareaState, Textarea, ScrollHandle, Popover } from "gpui-base";
import { agents, terminals, panes, spaces, layout, hc, exec, theme, shared, settings, window, home, appHome, nextCommand, notify, checking } from "herdr";
import * as fs from "fs/promises";
import { Buffer } from "buffer";
import { READER, PROGRAMS, OPENCODE, LOCATE, CATALOG, SKILL_HOMES, FILES, modeOnScreen, kindOf, KIND_NAMES } from "./reader.js";
import { BUILTIN, MODELS, EFFORTS, MODES } from "./commands.js";

const FIRST_BYTES = 4000000; // the first read starts this far from the transcript's end
const KEEP = 600; // items kept per conversation
const SHOWN = 120; // items drawn; "Show earlier" draws more
const SESSIONS = 8; // conversations kept in memory
const RELOCATE_MS = 15000; // how often to look again for the session (after /clear or /resume)
const CHATS = "shepherd.chat";
const CACHE = "data/shepherd-chat";
const WIDTH = 860; // the conversation's column
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

const machineOf = (address) => (address?.includes("/") ? address.slice(0, address.indexOf("/")) : null);
const sleep = (s) => exec("sleep", [String(s)]).catch(() => {});
const norm = (s) => String(s ?? "").replace(/<\/?pasted_content[^>]*>/g, "").replace(/\s+/g, " ").trim();
const quote = (p) => (/^[\w@%+=:,./-]+$/.test(p) ? p : `'${p.replace(/'/g, "'\\''")}'`);

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// An image's pixel size from its header (PNG, GIF, WebP, JPEG), or null.
function imageSize(b) {
  try {
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const k = b.toString("ascii", 12, 16);
      if (k === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (k === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
      if (k === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch {}
  return null;
}

// Opens a link or a file with this computer's default app.
function openThing(target) {
  const platform = window()?.platform;
  const [command, args] = platform === "macos" ? ["open", [target]] : platform === "windows" ? ["explorer.exe", [target]] : ["xdg-open", [target]];
  exec(command, args).catch(() => {});
}

// The system's file picker (macOS): chosen paths, or [] when cancelled.
async function pickFiles() {
  const r = await exec("osascript", ["-e", 'set fs to choose file with prompt "Attach to your message" with multiple selections allowed',
    "-e", 'set out to ""', "-e", "repeat with f in fs", "-e", "set out to out & POSIX path of f & linefeed", "-e", "end repeat", "-e", "return out"]).catch(() => null);
  return r?.code === 0 ? r.stdout.split("\n").map((l) => l.trim()).filter(Boolean) : [];
}

// What a paste without text holds (macOS): a picture saved as a PNG at `path`, else the files
// copied in Finder. Their paths, or [].
async function pasteFiles(path) {
  const img = await exec("osascript", ["-e", `set f to open for access (POSIX file "${path}") with write permission`,
    "-e", "write (the clipboard as «class PNGf») to f", "-e", "close access f"]).catch(() => null);
  if (img?.code === 0) return [path];
  const files = await exec("osascript", ["-e", "set out to \"\"", "-e", "try",
    "-e", "repeat with f in (the clipboard as list)", "-e", "try",
    "-e", "set out to out & POSIX path of (f as «class furl») & linefeed", "-e", "end try", "-e", "end repeat",
    "-e", "end try", "-e", "if out is \"\" then set out to POSIX path of (the clipboard as «class furl»)", "-e", "return out"]).catch(() => null);
  return files?.code === 0 ? files.stdout.split("\n").map((l) => l.trim()).filter(Boolean) : [];
}

// A git folder's branch, how far it is from its upstream, and how many files changed:
//   <git folder>  prints "<branch>\t<ahead>\t<behind>\t<changed>", or nothing outside git.
const GIT = String.raw`
cd "$1" 2>/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
b=$(git branch --show-current 2>/dev/null); [ -n "$b" ] || b=$(git rev-parse --short HEAD 2>/dev/null)
ab=$(git rev-list --left-right --count '@{upstream}...HEAD' 2>/dev/null)
n=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
printf '%s\t%s\t%s\t%s\n' "$b" "$(echo "$ab" | awk '{print $2}')" "$(echo "$ab" | awk '{print $1}')" "$n"
`;

let keysBound = false;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function shortPath(path, cwd) {
  if (typeof path !== "string") return "";
  if (cwd && path.startsWith(cwd + "/")) return path.slice(cwd.length + 1);
  const h = home();
  return path.replace(/^\/(home|Users)\/[^/]+(?=\/)/, "~").replace(h, "~");
}

const firstLine = (s) => (typeof s === "string" ? s.split("\n").find((l) => l.trim()) ?? "" : "");

// A code block that survives backticks in its content.
function fence(text, lang = "") {
  const ticks = Math.max(3, ...[...(text.matchAll(/`{3,}/g))].map((m) => m[0].length + 1));
  return `${"`".repeat(ticks)}${lang}\n${text}\n${"`".repeat(ticks)}`;
}

// Agents name the same tools differently: each call as Claude Code's tool and its inputs.
const TOOL_NAMES = {
  bash: "Bash", shell: "Bash", run_command: "Bash", exec_command: "Bash", run_shell_command: "Bash", powershell: "Bash",
  view: "Read", read: "Read", read_file: "Read", view_file: "Read",
  edit: "Edit", str_replace: "Edit", str_replace_editor: "Edit", replace_file_content: "Edit", replace: "Edit",
  create: "Write", write: "Write", write_file: "Write", write_to_file: "Write",
  grep: "Grep", grep_search: "Grep", rg: "Grep", glob: "Glob", find_by_name: "Glob",
  web_fetch: "WebFetch", webfetch: "WebFetch", read_url_content: "WebFetch", fetch: "WebFetch",
  web_search: "WebSearch", websearch: "WebSearch", search_web: "WebSearch",
  task: "Task", todowrite: "TodoWrite", update_todo: "TodoWrite",
};
function normTool(it) {
  const i = it.input ?? {};
  const name = TOOL_NAMES[String(it.name ?? "").toLowerCase()] ?? it.name ?? "Tool";
  return {
    ...it, name,
    input: {
      ...i,
      command: i.command ?? i.CommandLine ?? i.cmd,
      description: i.description ?? i.toolSummary ?? i.intention,
      file_path: i.file_path ?? i.path ?? i.filePath ?? i.AbsolutePath ?? i.TargetFile ?? i.filename,
      old_string: i.old_string ?? i.old_str ?? i.oldString ?? i.TargetContent,
      new_string: i.new_string ?? i.new_str ?? i.newString ?? i.ReplacementContent,
      content: i.content ?? i.file_text ?? i.CodeContent,
      pattern: i.pattern ?? i.query ?? i.Query,
      url: i.url ?? i.Url,
    },
  };
}

// A tool call in one line: its name as people say it, and what it worked on.
function toolTitle(raw, cwd) {
  const it = normTool(raw);
  const i = it.input ?? {};
  const mcp = /^mcp__(.+?)__(.+)$/.exec(it.name ?? "");
  const name = mcp ? `${mcp[1]} · ${mcp[2].replace(/_/g, " ")}` : it.name ?? "Tool";
  const str = Object.values(i).find((v) => typeof v === "string") ?? "";
  const summary =
    it.name === "Bash" ? i.description || firstLine(i.command)
    : it.name === "Patch" ? `${shortPath(i.file_path, cwd)}${i.files > 1 ? ` and ${i.files - 1} more` : ""}`
    : ["Read", "Write", "Edit", "MultiEdit", "NotebookEdit"].includes(it.name) ? shortPath(i.file_path ?? i.notebook_path, cwd)
    : it.name === "Grep" ? `${i.pattern ?? ""}${i.path ? ` in ${shortPath(i.path, cwd)}` : ""}`
    : it.name === "Glob" ? i.pattern
    : it.name === "WebFetch" ? i.url
    : it.name === "WebSearch" ? i.query ?? i.pattern
    : it.name === "Task" || it.name === "Agent" ? i.description
    : it.name === "TodoWrite" ? "Update the task list"
    : firstLine(str);
  return { name, summary: (summary ?? "").slice(0, 200) };
}

// Edit's old and new text as removed and added lines.
function diffLines(t, input, mono) {
  const rows = [];
  const add = (sign, text, color) => {
    for (const line of String(text ?? "").split("\n").slice(0, 80)) {
      rows.push(h_flex().w_full().min_w(0).px(8).bg(color + "1c").text_size(11.5).font_family(mono)
        .child(div().w(14).flex_none().text_color(color).child(sign))
        .child(div().flex_1().min_w(0).text_color(t.foreground).child(line || " ")));
    }
  };
  add("-", input.old_string, t.blocked);
  add("+", input.new_string, t.done);
  return v_flex().w_full().rounded(6).overflow_hidden().border(1).border_color(t.border).py(4).children(rows);
}

// The question an agent is blocked on, from its screen: the lines above its choices (back to
// a rule or a gap), the question itself, and the choices. Choices are numbered ("1. Yes",
// answered with their number) or a ❯ menu (answered by moving there and pressing Enter).
// Null when there are none.
function parsePrompt(screen) {
  // Boxes around a prompt (Copilot draws one) are not part of its lines.
  const lines = screen.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "").replace(/^(\s*)[│┃]\s?/, "$1").replace(/\s*[│┃]$/, ""));
  const numbered = /^\s*(?:[❯›>▶]\s*)?(\d{1,2})[.)]\s+(.+)$/;
  const cursor = /^(\s*)[❯›▶>]\s+(\S.*)$/;
  let first = -1, last = -1, options = [];
  for (let i = lines.length - 1; i >= 0; i--) if (numbered.test(lines[i])) { last = i; break; }
  if (last >= 0) {
    // A long choice wraps onto lines indented past its number.
    const wraps = (l) => l != null && !numbered.test(l) && /^\s{4,}\S/.test(l);
    while (wraps(lines[last + 1])) last++;
    first = last;
    while (first > 0 && (numbered.test(lines[first - 1]) || (wraps(lines[first - 1]) && lines.slice(0, first - 1).some((l) => numbered.test(l))))) first--;
    while (!numbered.test(lines[first])) first++;
    for (let i = first; i <= last; i++) {
      const m = numbered.exec(lines[i]);
      if (m) options.push({ n: m[1], label: m[2].trim(), selected: /^\s*[❯›>▶]/.test(lines[i]), keys: [m[1]] });
      else options.at(-1).label += ` ${lines[i].trim()}`;
    }
    // Some agents (Codex) only move to a number: where one is marked, move there and press Enter.
    const at = options.findIndex((o) => o.selected);
    if (at >= 0) options.forEach((o, i) => { const d = i - at; o.keys = [...Array(Math.abs(d)).fill(d > 0 ? "down" : "up"), "enter"]; });
  } else {
    const at = lines.findLastIndex((l) => cursor.test(l));
    if (at < 0) return null;
    const col = lines[at].search(/\S/) + 2;
    const sibling = (l) => l != null && !cursor.test(l) && l.length > col && /^\s+$/.test(l.slice(0, col)) && l[col] !== " " && l.search(/\S/) === col;
    first = at; last = at;
    while (sibling(lines[first - 1])) first--;
    while (sibling(lines[last + 1])) last++;
    const sel = at - first;
    for (let i = first; i <= last; i++) {
      const d = i - first - sel;
      options.push({ n: String(i - first + 1), label: lines[i].trim().replace(/^[❯›▶>]\s+/, ""), selected: i === at,
        keys: [...Array(Math.abs(d)).fill(d > 0 ? "down" : "up"), "enter"] });
    }
  }
  let q = first - 1;
  while (q >= 0 && !lines[q].trim()) q--;
  const question = q >= 0 && /[?？:：]\s*$/.test(lines[q]) ? lines[q].trim().replace(/^[│|]\s*/, "") : null;
  const top = question ? q - 1 : q;
  // Back to the box's edge (a solid rule); dashed rules inside it are left out.
  const dashed = (l) => /^[\s╌┄┈┅┉-]+$/.test(l) && /[╌┄┈┅┉]|-{6,}/.test(l);
  let from = top;
  while (from > 0 && !/^[\s│|]*[─━—]{6,}/.test(lines[from - 1]) && top - from < 14) from--;
  const context = lines.slice(Math.max(0, from), top + 1).filter((l) => !dashed(l))
    .map((l) => l.replace(/^[\s│|╭╰]+|[│|╮╯]+$/g, "").trimEnd())
    .filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim()));
  while (context.length && !context.at(-1).trim()) context.pop();
  return { question, options, context: context.slice(-14) };
}


const newSession = (address) => ({
  address, path: null, items: [], results: new Map(), offset: 0, located: 0, searched: false, error: null,
  mode: null, pending: [], open: new Set(), shown: SHOWN, draft: "", attach: [], catalog: null, files: null, chosen: null,
  follow: true, used: Date.now(),
});

export default class Chat extends View {
  init(_props, cx) {
    this.sessions = new Map(); // address -> its conversation, draft and attachments
    this.s = null;
    this.images = new Map(); // ref -> {rel, abs, w, h} | "pending" | "failed"
    this.prompt = null;
    this.answered = 0;
    this.menu = null; // the / or @ completion: {type, items, sel, start}
    this.picker = null; // "mode" | "model" | "effort"
    this.scroll = ScrollHandle.new();
    this.input = TextareaState.new({ placeholder: "Message the agent…   / for commands and skills, @ for files", rows: 1 });
    this.input.set_auto_grow(1, 10);
    this.input.on("submit", (e, cx) => {
      if (e?.shift) return;
      if (this.menu?.items?.length) return this.accept(this.menu.items[this.menu.sel], cx);
      this.send(cx);
    });
    this.input.on("change", (_e, cx) => this.complete(cx));
    this.input.on("paste_other", (_e, cx) => this.pasted(cx));
    if (checking()) return;
    if (!keysBound) {
      keysBound = true;
      try {
        cx.bind_keys([
          { keystroke: "up", action: "shep_chat_up", context: "ShepChatMenu > Input" },
          { keystroke: "down", action: "shep_chat_down", context: "ShepChatMenu > Input" },
          { keystroke: "tab", action: "shep_chat_accept", context: "ShepChatMenu > Input" },
          { keystroke: "escape", action: "shep_chat_close", context: "ShepChatMenu > Input" },
        ]);
      } catch {}
    }
    fs.mkdir(`${appHome()}/${CACHE}/files`, { recursive: true }).catch(() => {});
    exec("find", [`${appHome()}/${CACHE}`, "-type", "f", "-mtime", "+7", "-delete"]).catch(() => {});
    cx.timer.every(1000, (cx) => this.tick(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        if ((await nextCommand()) === "focus") this.input.focus();
        cx.notify();
      }
    });
  }

  // ---- where, and which conversation ----

  // The shown tab, and the terminal its chat shows (none while the tab shows its terminals).
  where() {
    const space = spaces().find((s) => s.active);
    const tab = space?.tabs?.find((c) => c.active)?.id ?? null;
    const address = tab ? shared(CHATS)?.[tab] ?? null : null;
    const pane = address ? panes().find((p) => p.terminal === address) ?? null : null;
    return { address, pane, tab };
  }

  visible() {
    return find(layout(), "conversation")?.active === "chat-page";
  }

  // Makes `address` the shown conversation: the draft and attachments go with the one left.
  use(address) {
    if (this.s?.address === address) return this.s;
    if (this.s) this.s.draft = this.input.value();
    let s = this.sessions.get(address);
    if (!s) {
      s = newSession(address);
      this.sessions.set(address, s);
      if (this.sessions.size > SESSIONS) {
        const old = [...this.sessions.values()].filter((x) => x !== s).sort((a, b) => a.used - b.used)[0];
        this.sessions.delete(old.address);
      }
    }
    s.used = Date.now();
    this.s = s;
    this.input.set_value(s.draft ?? "");
    this.menu = null;
    this.picker = null;
    this.prompt = null;
    s.follow = true;
    this.scrollDown = true;
    return s;
  }

  // A hidden page does nothing: no reads, no screen scraping.
  tick(cx) {
    const { address } = this.where();
    if (!address || !this.visible()) return;
    const s = this.use(address);
    const agent = agents().find((a) => a.address === address);
    if (agent?.status === "blocked") this.readPrompt(cx, address);
    else if (this.prompt) { this.prompt = null; cx.notify(); }
    if (s.chosen && Date.now() - s.chosen.at > 30000) s.chosen = null;
    this.poll(cx, s);
    this.pollGit(cx, s);
  }

  // Finds the session's transcript from the agent's process, then reads what is new in it.
  poll(cx, s) {
    if (s.busy) return;
    s.busy = true;
    cx.spawn(async (cx) => {
      const on = machineOf(s.address);
      try {
        if (!s.path || Date.now() - s.located > RELOCATE_MS) {
          s.located = Date.now();
          const got = await hc(["get", s.address, "--json"]);
          const info = JSON.parse(got.stdout || "{}");
          s.cwd = info?.foreground?.cwd ?? info?.cwd ?? s.cwd;
          const kind = kindOf(info?.status?.app) ?? kindOf(info?.foreground?.name) ?? kindOf(info?.foreground?.argv?.[0]) ?? s.kind;
          if (kind !== s.kind) Object.assign(s, { kind, path: null, catalog: null });
          const pid = info?.foreground?.pid;
          const script = LOCATE[kind];
          const r = script && Number.isInteger(pid)
            ? await exec("sh", ["-c", script, "sh", String(pid), s.cwd ?? "", info?.status?.title ?? ""], { on, timeout: 10000 }) : null;
          const path = r?.stdout?.trim().split("\n")[0] || null;
          s.searched = true;
          if (path && path !== s.path) Object.assign(s, { path, items: [], results: new Map(), offset: 0, shown: SHOWN, follow: true, usage: null, settings: {} });
          if (!s.path) return;
        }
        const path = s.path;
        const r = s.kind === "opencode"
          ? await exec("python3", ["-I", "-c", OPENCODE, ...path.split("\t"), String(s.offset)], { on, timeout: 20000 })
          : await exec("sh", ["-c", READER, "sh", path, String(s.offset), String(FIRST_BYTES), PROGRAMS[s.kind]], { on, timeout: 20000 });
        if (path !== s.path) return;
        const out = JSON.parse(r.stdout || "{}");
        if (out.error) throw Error(out.error);
        if (out.reset) { s.items = []; s.results = new Map(); }
        s.offset = out.end ?? s.offset;
        s.error = null;
        if (out.items?.length) this.take(s, out.items, cx);
      } catch (error) {
        s.error = String(error?.message ?? error).split("\n")[0].slice(0, 200);
      } finally {
        s.busy = false;
        cx.notify();
      }
    });
  }

  take(s, items, cx) {
    for (const it of items) {
      if (it.k === "mode") { s.mode = it.mode; continue; }
      if (it.k === "settings") { s.settings = { ...(s.settings ?? {}), ...Object.fromEntries(Object.entries(it).filter(([k, v]) => k !== "k" && v != null)) }; continue; }
      if (it.k === "usage") { s.usage = it; continue; }
      for (const img of it.images ?? []) this.cacheImage(img, cx);
      if (it.k === "result") {
        // agy names no call: its result goes to the latest call still without one.
        const of = it.of ?? [...s.items].reverse().find((x) => x.k === "tool" && !s.results.has(x.id))?.id;
        if (of) s.results.set(of, it);
        continue;
      }
      if (it.k === "user" && s.pending.length) {
        const n = norm(it.text);
        let i = s.pending.findIndex((p) => n && (n === norm(p.text) || n.includes(norm(p.text)) || norm(p.text).includes(n)));
        if (i < 0 && Date.parse(it.ts) >= s.pending[0].at - 5000) i = 0;
        if (i >= 0) s.pending.splice(i, 1);
      }
      s.items.push(it);
    }
    if (s.items.length > KEEP) s.items = s.items.slice(-KEEP);
    if (s.follow && s === this.s) this.scrollDown = true;
  }

  // ---- images ----

  // Saves an image (base64 from the transcript, or a local file) under the app's data folder,
  // where image() can draw it; the item keeps only its ref.
  cacheImage(img, cx) {
    if (img.ref) return;
    img.ref = img.data ? hash(img.data.slice(0, 4096) + img.data.length) : hash(img.path);
    const data = img.data;
    delete img.data;
    if (this.images.has(img.ref)) return;
    this.images.set(img.ref, "pending");
    const ext = (img.media?.split("/")[1] ?? img.path?.split(".").pop() ?? "png").replace("jpeg", "jpg").toLowerCase();
    const rel = `${CACHE}/${img.ref}.${ext}`, abs = `${appHome()}/${rel}`;
    cx.spawn(async (cx) => {
      try {
        const buf = data ? Buffer.from(data, "base64") : Buffer.from(await fs.readFile(img.path));
        if (data) await fs.writeFile(abs, buf);
        else if ((await exec("cp", [img.path, abs])).code !== 0) throw Error("copy failed");
        const size = imageSize(buf) ?? { w: 320, h: 240 };
        this.images.set(img.ref, { rel, abs, ...size });
      } catch {
        this.images.set(img.ref, "failed");
      }
      cx.notify();
    });
  }

  thumb(t, id, img, maxW, maxH) {
    const c = this.images.get(img.ref);
    if (!c || c === "pending") return div().id(id).w(Math.min(maxW, 120)).h(Math.min(maxH, 80)).rounded(8).bg(t.hover);
    if (c === "failed") return div().id(id).px(8).py(4).rounded(6).bg(t.hover).text_size(11).text_color(t.dim).child("image");
    const k = Math.min(1, maxW / c.w, maxH / c.h);
    return div().id(id).flex_none().rounded(8).overflow_hidden().border(1).border_color(t.border).cursor_pointer()
      .hover((s) => s.opacity(0.85)).tooltip("Open full size")
      .on_click((_e, cx) => { cx.stop_propagation(); openThing(c.abs); })
      .child(image(c.rel).w(Math.max(24, Math.round(c.w * k))).h(Math.max(24, Math.round(c.h * k))));
  }

  // ---- the agent's questions ----

  readPrompt(cx, address) {
    if (this.reading || Date.now() - this.answered < 1500) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["read", address, "--lines", "0"]);
        const why = terminals().find((x) => x.address === address)?.report?.msg ?? null;
        this.prompt = { ...(parsePrompt(r.stdout ?? "") ?? { options: [], context: [] }), screen: r.stdout ?? "",
          why: typeof why === "string" && why ? why[0].toUpperCase() + why.slice(1) : null };
      } catch {
        this.prompt = null;
      } finally {
        this.reading = false;
        cx.notify();
      }
    });
  }

  keys(cx, address, keys) {
    this.answered = Date.now();
    this.prompt = null;
    cx.spawn(async (cx) => {
      const r = await hc(["keys", address, ...keys]).catch((e) => ({ code: 1, stderr: String(e) }));
      if (r.code !== 0) notify({ title: "Could not answer", body: (r.stderr || r.stdout || "").slice(0, 160), level: "error" });
      cx.notify();
    });
    cx.notify();
  }

  // ---- composing ----

  // The / or @ word at the cursor, and what it could become.
  complete(cx) {
    const s = this.s;
    if (!s) return;
    const value = this.input.value();
    const cursor = Math.min(value.length, this.input.selected_range()?.start ?? value.length);
    const before = value.slice(0, cursor);
    const slash = /^\/(\S*)$/.exec(before);
    const at = /(?:^|\s)@([^\s@]*)$/.exec(before);
    if (slash) {
      if (!s.catalog) this.loadCatalog(cx, s);
      const q = slash[1].toLowerCase();
      const all = [...(s.catalog ?? []), ...(s.kind === "claude" ? BUILTIN : [])];
      const seen = new Set();
      const items = all.filter((c) => !seen.has(c.name) && seen.add(c.name))
        .map((c) => ({ c, r: c.name.toLowerCase().startsWith(q) ? 0 : c.name.toLowerCase().includes(q) ? 1 : (c.desc ?? "").toLowerCase().includes(q) && q ? 2 : -1 }))
        .filter((x) => x.r >= 0).sort((a, b) => a.r - b.r || (a.c.kind === "builtin") - (b.c.kind === "builtin") || a.c.name.localeCompare(b.c.name))
        .slice(0, 8).map((x) => ({ ...x.c, type: "slash" }));
      this.menu = { type: "slash", items, sel: Math.min(this.menu?.type === "slash" ? this.menu.sel : 0, Math.max(0, items.length - 1)), start: 0, cursor, loading: !s.catalog };
    } else if (at) {
      if (!s.files) this.loadFiles(cx, s);
      const q = at[1].toLowerCase();
      const items = (s.files ?? []).map((p) => {
        const base = p.slice(p.lastIndexOf("/") + 1).toLowerCase(), low = p.toLowerCase();
        return { p, r: !q ? 3 : base.startsWith(q) ? 0 : base.includes(q) ? 1 : low.includes(q) ? 2 : -1 };
      }).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r || a.p.length - b.p.length).slice(0, 8).map((x) => ({ type: "file", name: x.p }));
      this.menu = { type: "file", items, sel: Math.min(this.menu?.type === "file" ? this.menu.sel : 0, Math.max(0, items.length - 1)), start: cursor - at[1].length - 1, cursor, loading: !s.files };
    } else this.menu = null;
    cx.notify();
  }

  loadCatalog(cx, s) {
    if (s.catalogBusy) return;
    s.catalogBusy = true;
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", CATALOG, "sh", s.cwd ?? ".", ...(SKILL_HOMES[s.kind] ?? [])], { on: machineOf(s.address), timeout: 15000 }).catch(() => null);
      s.catalog = (r?.stdout ?? "").split("\n").filter(Boolean).map((l) => {
        const [kind, name, desc] = l.split("\t");
        return { kind, name, desc };
      });
      s.catalogBusy = false;
      if (this.menu?.type === "slash") this.complete(cx);
      cx.notify();
    });
  }

  loadFiles(cx, s) {
    if (s.filesBusy) return;
    s.filesBusy = true;
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", FILES, "sh", s.cwd ?? "."], { on: machineOf(s.address), timeout: 15000 }).catch(() => null);
      s.files = (r?.stdout ?? "").split("\n").filter(Boolean);
      s.filesBusy = false;
      if (this.menu?.type === "file") this.complete(cx);
      cx.notify();
    });
  }

  accept(item, cx) {
    const m = this.menu;
    if (!item || !m) return;
    const value = this.input.value();
    const next = item.type === "slash" ? `/${item.name} ${value.slice(m.cursor).trimStart()}`
      : `${value.slice(0, m.start)}@${item.name} ${value.slice(m.cursor).trimStart()}`;
    this.menu = null;
    this.input.set_value(next);
    this.input.focus();
    cx.notify();
  }

  moveMenu(d, cx) {
    if (!this.menu?.items?.length) return;
    this.menu.sel = (this.menu.sel + d + this.menu.items.length) % this.menu.items.length;
    cx.notify();
  }

  addFiles(paths, cx) {
    const s = this.s;
    if (!s) return;
    this.input.focus();
    cx.spawn(async (cx) => {
      for (const src of paths) {
        const name = src.split("/").pop();
        const path = `${appHome()}/${CACHE}/files/${Date.now()}-${name}`;
        // A screenshot dragged from its thumbnail is a file macOS deletes moments later.
        if ((await exec("cp", ["-R", src, path]).catch(() => ({ code: 1 }))).code !== 0) { notify({ title: `Could not attach ${name}`, level: "error" }); continue; }
        const a = { path, name, image: IMAGE_EXT.test(name) ? { path } : null };
        if (a.image) this.cacheImage(a.image, cx);
        s.attach.push(a);
      }
      cx.notify();
    });
  }

  pasted(cx) {
    cx.spawn(async (cx) => {
      const paths = await pasteFiles(`${appHome()}/${CACHE}/files/paste-${Date.now()}.png`);
      if (paths.length) this.addFiles(paths, cx);
      else notify({ title: "Nothing to paste", body: "The clipboard holds no text, image or file.", level: "warning" });
      cx.notify();
    });
  }

  // The conversation's git state, asked on the agent's machine at most every 10 seconds.
  pollGit(cx, s) {
    if (s.gitBusy || !s.cwd || Date.now() - (s.gitAt ?? 0) < 10000) return;
    s.gitBusy = true;
    s.gitAt = Date.now();
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", GIT, "sh", s.cwd], { on: machineOf(s.address), timeout: 10000 }).catch(() => null);
      const [branch, ahead, behind, changed] = (r?.stdout ?? "").trim().split("\t");
      s.git = branch ? { branch, ahead: Number(ahead) || 0, behind: Number(behind) || 0, changed: Number(changed) || 0 } : null;
      s.gitBusy = false;
      cx.notify();
    });
  }

  send(cx) {
    const s = this.s;
    if (!s) return;
    const text = this.input.value().trim();
    const files = s.attach.map((a) => a.path);
    if (!text && !files.length) return;
    const address = s.address;
    const agent = agents().find((a) => a.address === address);
    if (agent?.status === "blocked") {
      notify({ title: "The agent is waiting for an answer", body: "Pick one of its choices first.", level: "warning" });
      return;
    }
    const images = s.attach.filter((a) => a.image).map((a) => a.image);
    this.input.set_value("");
    s.attach = [];
    this.menu = null;
    const item = { k: "user", id: `pending-${Date.now()}`, text, images, at: Date.now(), pending: true };
    if (!/^\//.test(text)) s.pending.push(item);
    s.follow = true;
    this.scrollDown = true;
    cx.spawn(async (cx) => {
      const paths = [];
      for (const f of files) {
        if (machineOf(address)) {
          const r = await hc(["put", address, f, "--json"]).catch(() => null);
          let landed = null;
          try { landed = JSON.parse(r?.stdout ?? "")?.path ?? null; } catch {}
          if (r?.code !== 0 || !landed) { item.failed = `could not send ${f.split("/").pop()} to ${machineOf(address)}`; return cx.notify(); }
          paths.push(landed);
        } else paths.push(f);
      }
      const message = [...paths.map(quote), text].filter(Boolean).join(" ");
      const r = await hc(["send", address, message]).catch((e) => ({ code: 1, stderr: String(e) }));
      if (r.code !== 0) item.failed = (r.stderr || r.stdout || "not sent").split("\n")[0].slice(0, 160);
      cx.notify();
    });
    cx.notify();
  }

  stop(cx, address) {
    cx.spawn(async () => { await hc(["interrupt", address]).catch(() => {}); });
  }

  // ---- mode, model, effort ----

  idleFor(address, what) {
    const st = agents().find((a) => a.address === address)?.status;
    if (st === "working" || st === "blocked") {
      notify({ title: `Can't change the ${what} now`, body: st === "working" ? "Wait for the agent to finish its turn." : "Answer the agent's question first.", level: "warning" });
      return false;
    }
    return true;
  }

  // Claude Code saves /model and /effort as the default for new sessions: its settings go back.
  setModel(cx, kind, id) {
    const s = this.s;
    if (!s || !this.idleFor(s.address, kind)) return;
    this.picker = null;
    s.chosen = { ...(s.chosen ?? {}), [kind]: id, at: Date.now() };
    const on = machineOf(s.address);
    const keep = String.raw`f="$HOME/.claude/settings.json"; case "$1" in save) [ -f "$f" ] && cp "$f" "$f.shepherd-chat";; back) [ -f "$f.shepherd-chat" ] && mv "$f.shepherd-chat" "$f";; esac; exit 0`;
    cx.spawn(async (cx) => {
      await exec("sh", ["-c", keep, "sh", "save"], { on }).catch(() => {});
      try {
        const r = await hc(["send", s.address, `/${kind} ${id}`]);
        if (r.code !== 0) throw Error(r.stderr || r.stdout);
        await sleep(1.5);
      } catch (e) {
        notify({ title: `Could not set the ${kind}`, body: String(e?.message ?? e).slice(0, 160), level: "error" });
        s.chosen = null;
      } finally {
        await exec("sh", ["-c", keep, "sh", "back"], { on }).catch(() => {});
        cx.notify();
      }
    });
    cx.notify();
  }

  // Claude Code cycles its permission modes with shift+tab: press until its footer shows the one picked.
  setMode(cx, id) {
    const s = this.s;
    if (!s || !this.idleFor(s.address, "mode")) return;
    this.picker = null;
    s.chosen = { ...(s.chosen ?? {}), mode: id, at: Date.now() };
    cx.spawn(async (cx) => {
      let now = null;
      for (let i = 0; i < 6; i++) {
        const screen = (await hc(["read", s.address, "--lines", "0"]).catch(() => ({ stdout: "" }))).stdout;
        now = modeOnScreen(screen.split("\n").filter((l) => l.trim()).slice(-4).join("\n"));
        if (now === id) break;
        await hc(["keys", s.address, "shift+tab"]).catch(() => {});
        await sleep(0.4);
      }
      if (now !== id) notify({ title: "That mode isn't available", body: "Claude Code offers it only when started with it.", level: "warning" });
      s.mode = now;
      s.chosen = { ...(s.chosen ?? {}), mode: null };
      cx.notify();
    });
    cx.notify();
  }

  // ---- drawing ----

  markdown(t, id, text, size = 14) {
    return TextView.markdown(id, text).selectable(true).w_full().text_size(size).text_color(t.foreground)
      .on_link_click((url) => { if (/^https?:\/\//.test(url)) openThing(url); });
  }

  // One row of the conversation, centered in its column.
  row(id, child) {
    return h_flex().id(id).w_full().flex_none().justify_center().px(24).child(div().w_full().max_w(WIDTH).child(child));
  }

  userBubble(t, it) {
    const images = it.images ?? [];
    return h_flex().id(`u-${it.id}`).w_full().justify_end()
      .child(v_flex().max_w(Math.round(WIDTH * 0.78)).gap(6).items_end()
        .when(images.length > 0, (el) => el.child(h_flex().gap(6).flex_wrap().justify_end()
          .children(images.map((img, i) => this.thumb(t, `ui-${it.id}-${i}`, img, 260, 180)))))
        .when(Boolean(it.text), (el) => el.child(div().px(14).py(9).rounded(16).bg(t.accent + "24")
          .when(Boolean(it.pending), (e) => e.opacity(0.65))
          .child(this.markdown(t, `um-${it.id}`, it.text, 13.5))))
        .when(Boolean(it.pending), (el) => el.child(div().text_size(10.5).text_color(it.failed ? t.blocked : t.dim)
          .child(it.failed ? `Not sent: ${it.failed}` : "Sending…"))));
  }

  toolCard(t, it, cwd, working, mono) {
    const s = this.s;
    const r = s.results.get(it.id);
    const open = s.open.has(it.id);
    const { name, summary } = toolTitle(it, cwd);
    const mark = r ? (r.err ? div().size(7).flex_none().rounded(4).bg(t.blocked) : svg("mods/workspace-chrome/check.svg").size(12).flex_none().text_color(t.done))
      : working ? svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)
      : div().size(7).flex_none().rounded(4).border(1.5).border_color(t.dim);
    const n = normTool(it);
    const i = n.input;
    const body = () => {
      const parts = [];
      if (n.name === "Bash" && i.command) parts.push(this.markdown(t, `ti-${it.id}`, fence(i.command, "sh"), 12));
      else if (n.name === "Edit" && (i.old_string || i.new_string)) parts.push(diffLines(t, i, mono));
      else if (n.name === "Write" && i.content) parts.push(this.markdown(t, `ti-${it.id}`, fence(i.content), 12));
      else if (n.name === "Patch" && i.diff) parts.push(this.markdown(t, `ti-${it.id}`, fence(i.diff, "diff"), 12));
      else if (typeof i.code === "string") parts.push(this.markdown(t, `ti-${it.id}`, fence(i.code, "js"), 12));
      else if (Object.keys(it.input ?? {}).length) parts.push(this.markdown(t, `ti-${it.id}`, fence(JSON.stringify(it.input, null, 2), "json"), 12));
      if (r?.text) parts.push(v_flex().id(`tr-${it.id}`).max_h(320).overflow_y_scrollbar().rounded(6).bg(t.canvas ?? t.chrome)
        .child(div().px(2).child(this.markdown(t, `trm-${it.id}`, fence(r.text), 11.5))));
      return v_flex().pl(22).pt(4).pb(6).gap(6).children(parts);
    };
    return v_flex().id(`tool-${it.id}`).w_full()
      .child(h_flex().id(`th-${it.id}`).h(26).px(8).gap(8).items_center().rounded(6).text_size(12)
        .cursor_pointer().hover((st) => st.bg(t.hover))
        .on_click((_e, cx) => { open ? s.open.delete(it.id) : s.open.add(it.id); cx.notify(); })
        .child(h_flex().w(14).flex_none().justify_center().child(mark))
        .child(div().flex_none().font_medium().text_color(r?.err ? t.blocked : t.muted).child(name))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(summary))
        .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none().text_color(t.dim)))
      .when(open, (el) => el.child(body()));
  }

  // A run of tool calls: one line that opens to each call. Images they returned show anyway.
  toolGroup(t, id, tools, cwd, working, mono, last) {
    const s = this.s;
    const open = s.open.has(id) || (last && working);
    const results = tools.map((it) => s.results.get(it.id));
    const running = working && results.some((r) => !r);
    const failed = results.some((r) => r?.err);
    const names = [...new Set(tools.map((it) => toolTitle(it, cwd).name))];
    const head = tools.length === 1 ? toolTitle(tools[0], cwd) : { name: `${tools.length} tool calls`, summary: names.slice(0, 4).join(", ") + (names.length > 4 ? "…" : "") };
    const images = results.flatMap((r) => r?.images ?? []);
    return v_flex().id(id).w_full().gap(4)
      .child(h_flex().id(`${id}-h`).h(30).px(10).gap(8).items_center().rounded(8).bg(t.surface ?? t.raised).border(1).border_color(t.border)
        .text_size(12).cursor_pointer().hover((st) => st.bg(t.hover))
        .on_click((_e, cx) => { s.open.has(id) ? s.open.delete(id) : s.open.add(id); cx.notify(); })
        .child(h_flex().w(14).flex_none().justify_center().child(running ? svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working).spin(900)
          : failed ? div().size(7).rounded(4).bg(t.blocked) : svg("mods/workspace-chrome/check.svg").size(12).text_color(t.done)))
        .child(div().flex_none().font_medium().text_color(t.muted).child(head.name))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(head.summary ?? ""))
        .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none().text_color(t.dim)))
      .when(open && tools.length > 1, (el) => el.child(v_flex().pl(6).children(tools.map((it) => this.toolCard(t, it, cwd, working, mono)))))
      .when(open && tools.length === 1, (el) => el.child(this.toolCard(t, tools[0], cwd, working, mono)))
      .when(images.length > 0, (el) => el.child(h_flex().pl(4).gap(6).flex_wrap().children(images.map((img, i) => this.thumb(t, `${id}-img-${i}`, img, 360, 240)))));
  }

  promptCard(t, address) {
    const p = this.prompt;
    if (!p) return null;
    const mono = settings().font_family;
    const keyButton = (id, label, keys) => h_flex().id(id).h(26).px(10).flex_none().items_center().rounded(6).border(1).border_color(t.input ?? t.border)
      .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.keys(cx, address, keys)).child(label);
    const screenTail = p.screen.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim()).slice(-12).join("\n");
    return v_flex().id("prompt").w_full().p(12).gap(8).rounded(12).bg(t.blocked + "12").border(1).border_color(t.blocked + "66")
      .child(h_flex().gap(8).items_center()
        .child(div().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you"))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_medium().text_color(t.foreground).child(p.question ?? p.why ?? "The agent is waiting for you")))
      .when(p.context.length > 0, (el) => el.child(v_flex().px(10).py(6).rounded(6).bg(t.background).text_size(11.5).font_family(mono).text_color(t.muted)
        .children(p.context.map((l, i) => div().id(`pc-${i}`).child(l || " ")))))
      .when(p.options.length > 0, (el) => el.child(v_flex().gap(4).children(p.options.map((o) =>
        h_flex().id(`po-${o.n}`).min_h(30).px(10).py(4).gap(10).items_center().rounded(7)
          .border(1).border_color(o.selected ? t.accent : t.border).bg(t.background)
          .cursor_pointer().hover((s) => s.bg(t.hover).border_color(t.accent))
          .on_click((_e, cx) => this.keys(cx, address, o.keys))
          .child(div().size(18).flex_none().rounded(5).bg(t.hover).flex().items_center().justify_center().text_size(11).font_semibold().text_color(t.foreground).child(o.n))
          .child(div().flex_1().min_w(0).text_size(12.5).text_color(t.foreground).child(o.label))))))
      .when(p.options.length === 0, (el) => el.child(v_flex().px(10).py(6).rounded(6).bg(t.background).text_size(11.5).font_family(mono).text_color(t.muted)
        .children(screenTail.split("\n").map((l, i) => div().id(`ps-${i}`).child(l || " ")))))
      .child(h_flex().gap(6).items_center()
        .when(p.options.length === 0, (el) => el
          .child(keyButton("pk-enter", "Enter", ["enter"]))
          .child(keyButton("pk-up", "↑", ["up"]))
          .child(keyButton("pk-down", "↓", ["down"])))
        .child(keyButton("pk-esc", "Esc", ["esc"]))
        .child(div().flex_1())
        .child(div().text_size(10.5).text_color(t.dim).child("Read from the terminal's screen")));
  }

  // The / and @ completions, above the message box.
  menuPanel(t) {
    const m = this.menu;
    if (!m) return null;
    const empty = m.loading ? "Loading…" : m.type === "slash" ? "No command or skill matches" : "No file matches";
    return v_flex().id("complete").w_full().p(4).gap(1).rounded(10).bg(t.popover).border(1).border_color(t.border)
      .when(m.items.length === 0, (el) => el.child(div().px(10).py(6).text_size(12).text_color(t.dim).child(empty)))
      .children(m.items.map((it, i) => h_flex().id(`cm-${i}`).h(30).px(10).gap(10).items_center().rounded(7)
        .when(i === m.sel, (el) => el.bg(t.selected)).cursor_pointer().hover((s) => s.bg(t.hover))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => this.accept(it, cx))
        .child(div().flex_none().text_size(12.5).font_medium().text_color(t.foreground).child(it.type === "slash" ? `/${it.name}` : it.name))
        .when(it.type === "slash", (el) => el
          .child(div().flex_none().px(5).h(15).flex().items_center().rounded(4).bg(t.hover).text_size(9.5).text_color(t.dim)
            .child(it.kind === "builtin" ? "command" : it.kind))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(it.desc ?? "")))))
      .child(div().px(10).pt(3).pb(2).text_size(10.5).text_color(t.dim).child("↑↓ to move · Tab or Enter to pick · Esc to close"));
  }

  // The mode, model and effort choices, above the message box.
  pickerPanel(t, current, kind) {
    const list = kind === "mode" ? MODES : kind === "model" ? MODELS : EFFORTS;
    const title = kind === "mode" ? "Permission mode" : kind === "model" ? "Model" : "Effort";
    return v_flex().id(`picker-${kind}`).mb(6).w(320).p(4).gap(1).rounded(10).bg(t.popover).border(1).border_color(t.border).shadow_md()
      .child(div().px(10).pt(4).pb(2).text_size(10.5).font_medium().text_color(t.dim).child(title.toUpperCase()))
      .children(list.map((o) => {
        const on = o.id === current[kind];
        return h_flex().id(`pk-${kind}-${o.id}`).min_h(30).px(10).py(4).gap(10).items_center().rounded(7)
          .when(on, (el) => el.bg(t.selected)).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => (kind === "mode" ? this.setMode(cx, o.id) : this.setModel(cx, kind, o.id)))
          .child(v_flex().flex_1().min_w(0)
            .child(div().text_size(12.5).text_color(t.foreground).child(o.name))
            .when(Boolean(o.hint), (el) => el.child(div().truncate().text_size(11).text_color(t.dim).child(o.hint))))
          .when(on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(13).flex_none().text_color(t.accent)));
      }));
  }

  // A chip that opens its choices above it; a press outside, or Esc, closes them.
  chip(t, kind, label, current) {
    const open = this.picker === kind;
    const trigger = h_flex().id(`chip-${kind}`).h(26).px(9).gap(5).flex_none().items_center().rounded(13).text_size(11.5)
      .bg(open ? t.selected : t.background).border(1).border_color(open ? t.accent + "66" : t.border)
      .text_color(open ? t.foreground : t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .child(label)
      .child(svg("mods/workspace-chrome/chevron-down.svg").size(10).text_color(t.dim));
    return Popover.new(`pop-${kind}`).anchor("bottom_left").open(open)
      .on_open_change((on, cx) => { this.picker = on ? kind : this.picker === kind ? null : this.picker; if (on) this.menu = null; cx.notify(); })
      .trigger(trigger)
      .content(this.pickerPanel(t, current, kind));
  }

  // How full the context is, as the quota's bars draw it, and how much of the prompt the cache served.
  contextMeter(t, session) {
    if (typeof session.ctx !== "number") return h_flex().id("ctx").flex_none().gap(8).items_center().text_size(10.5).tooltip("Prompt cache hits")
      .child(div().text_color(t.dim).child("Cache")).child(div().text_color(t.foreground).font_medium().child(`${session.cache}%`));
    const used = Math.max(0, Math.min(100, session.ctx));
    const color = used >= 85 ? t.blocked : used >= 60 ? t.ansi3 ?? t.working : t.accent;
    const W = 56;
    return h_flex().id("ctx").flex_none().gap(8).items_center().text_size(10.5)
      .tooltip(`Context ${used}% used${typeof session.cache === "number" ? ` · prompt cache hit ${session.cache}%` : ""}`)
      .child(div().text_color(t.dim).child("Context"))
      .child(div().w(W).h(4).rounded(2).bg(t.border).overflow_hidden()
        .child(div().h_full().w(Math.round((W * used) / 100)).rounded(2).bg(color)))
      .child(div().text_color(color).font_medium().child(`${used}%`))
      .when(typeof session.cache === "number", (el) => el
        .child(div().w(1).h(10).bg(t.border))
        .child(div().text_color(t.dim).child("Cache"))
        .child(div().text_color(t.foreground).font_medium().child(`${session.cache}%`)));
  }

  // One round button that is Send while there is something to send, else Stop while the agent works.
  sendButton(t, canSend, working, address) {
    const stop = working && !canSend;
    const layer = (id, on, bg, fg, glyph) => div().id(id).absolute().inset_0().rounded(14).bg(bg).flex().items_center().justify_center()
      .opacity(on ? 1 : 0).transition("opacity", { duration: 180, easing: "ease-out" }).text_color(fg).child(glyph);
    return div().id("send").relative().size(28).flex_none().rounded(14).cursor_pointer()
      .when(!canSend && !working, (el) => el.opacity(0.45))
      .tooltip(stop ? "Stop the agent's turn" : "Send (Enter)")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => (stop ? this.stop(cx, address) : this.send(cx)))
      .child(layer("send-go", !stop, t.solid ?? t.accent, t.solid_foreground ?? t.accent_foreground, div().text_size(14).font_bold().child("↑")))
      .child(layer("send-stop", stop, t.foreground, t.background, div().size(9).rounded(2).bg(t.background)));
  }

  empty(t, title, body) {
    return v_flex().flex_1().items_center().justify_center().gap(6).p(24)
      .child(div().text_size(15).font_medium().text_color(t.foreground).child(title))
      .when(Boolean(body), (el) => el.child(div().max_w(440).text_size(12.5).text_color(t.dim).text_center().child(body)));
  }

  render(cx) {
    const t = theme();
    const { address, pane } = this.where();
    const s = address ? this.use(address) : null;
    const agent = agents().find((a) => a.address === address);
    const status = agent?.status ?? pane?.status ?? null;
    const working = status === "working";
    const blocked = status === "blocked";
    const mono = settings().font_family;
    const terminal = terminals().find((x) => x.address === address);
    // Shown again, or for another terminal: the keyboard comes here, once.
    const shown = this.visible() && address ? address : null;
    if (shown !== this.focusedFor && !checking()) {
      this.focusedFor = shown;
      if (shown) cx.timer.after(50, (cx) => { this.input.focus(); this.tick(cx); cx.notify(); });
    }
    let session = null;
    try { session = JSON.parse(terminal?.labels?.["shepherd.session"] ?? "null"); } catch {}
    const kind = s?.kind ?? kindOf(agent?.app ?? pane?.app ?? pane?.program?.key);
    const claude = kind === "claude";
    // Others' model, effort and context come from their own transcript.
    if (!claude) session = { model: s?.settings?.model, effort: s?.settings?.effort, ctx: s?.usage?.ctx, cache: s?.usage?.cache };
    const current = {
      mode: s?.chosen?.mode ?? s?.mode ?? "default",
      model: s?.chosen?.model ?? MODELS.find((m) => m.name === session?.model)?.id ?? null,
      effort: s?.chosen?.effort ?? session?.effort ?? null,
    };
    const name = agent?.program?.name || pane?.program?.name || KIND_NAMES[kind] || "Agent";
    const tabName = spaces().flatMap((x) => x.tabs ?? []).find((c) => c.id === pane?.tab)?.name;

    // The conversation: messages, and runs of tool calls as one line each.
    const rows = [];
    if (s) {
      const list = [...s.items, ...s.pending];
      const from = Math.max(0, list.length - s.shown);
      if (from > 0) rows.push(this.row("earlier", h_flex().justify_center()
        .child(div().id("earlier-btn").px(12).h(26).flex().items_center().rounded(13).border(1).border_color(t.border).text_size(11.5).text_color(t.muted)
          .cursor_pointer().hover((st) => st.bg(t.hover))
          .on_click((_e, cx) => { s.shown += SHOWN; cx.notify(); })
          .child(`Show ${Math.min(from, SHOWN)} earlier`))));
      const shownList = list.slice(from);
      for (let i = 0; i < shownList.length; i++) {
        const it = shownList[i];
        if (it.k === "tool") {
          const tools = [it];
          while (shownList[i + 1]?.k === "tool") tools.push(shownList[++i]);
          const last = i === shownList.length - 1;
          rows.push(this.row(`g-${tools[0].id}`, this.toolGroup(t, `grp-${tools[0].id}`, tools, pane?.cwd, working, mono, last)));
        } else if (it.k === "user") rows.push(this.row(`r-${it.id}`, this.userBubble(t, it)));
        else if (it.k === "note") rows.push(this.row(`r-${it.id}`, h_flex().gap(8).items_start().px(10).py(6).rounded(8).bg(t.blocked + "14")
          .text_size(12).text_color(t.blocked).child(div().flex_none().child("⚠")).child(div().flex_1().min_w(0).child(it.text))));
        else rows.push(this.row(`r-${it.id}`, this.markdown(t, `am-${it.id}`, it.text)));
      }
      if (working) rows.push(this.row("working", h_flex().gap(8).items_center().text_size(12).text_color(t.muted)
        .child(div().text_color(t.working).frames(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"], 80))
        .child(agent?.title && agent.title !== address && !address.endsWith(`/${agent.title}`) ? agent.title : "Working…")));
      rows.push(div().id("chat-end").h(8).flex_none());
    }
    if (this.scrollDown) {
      this.scrollDown = false;
      this.scroll.scroll_to_item(rows.length - 1);
    }

    const header = h_flex().id("chat-head").h(40).flex_none().px(16).gap(10).items_center().border_b(1).border_color(t.border).text_size(12)
      .when(Boolean(icon(agent?.program ?? pane?.program, 16, t.dim)), (el) => el.child(icon(agent?.program ?? pane?.program, 16, t.dim)))
      .child(div().flex_none().text_size(13).font_semibold().text_color(t.foreground).child(tabName && !/^\d+$/.test(tabName) ? tabName : name))
      .child(div().flex_none().max_w(320).truncate().text_color(t.dim).child(shortPath(pane?.cwd ?? "", null)))
      .when(Boolean(s?.git), (el) => el.child(h_flex().id("git").flex_none().gap(5).items_center().px(7).h(20).rounded(6).bg(t.hover).text_size(11)
        .tooltip(`${s.git.branch}${s.git.ahead ? ` · ${s.git.ahead} to push` : ""}${s.git.behind ? ` · ${s.git.behind} to pull` : ""} · ${s.git.changed} changed file${s.git.changed === 1 ? "" : "s"}`)
        .child(svg("mods/workspace-chrome/git-branch.svg").size(11).text_color(t.dim))
        .child(div().max_w(220).truncate().text_color(t.foreground).child(s.git.branch))
        .when(s.git.ahead > 0, (e) => e.child(div().text_color(t.accent).child(`↑${s.git.ahead}`)))
        .when(s.git.behind > 0, (e) => e.child(div().text_color(t.ansi3 ?? t.working).child(`↓${s.git.behind}`)))
        .when(s.git.changed > 0, (e) => e.child(div().text_color(t.dim).child(`±${s.git.changed}`)))))
      .child(div().flex_1())
      .when(working, (el) => el.child(h_flex().gap(5).items_center().text_size(11).text_color(t.working)
        .child(svg("mods/workspace-chrome/spinner.svg").size(11).spin(900)).child("Working")))
      .when(blocked, (el) => el.child(div().flex_none().px(7).h(20).flex().items_center().rounded(6).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(status === "done", (el) => el.child(h_flex().gap(5).items_center().text_size(11).text_color(t.done).child(div().size(7).rounded(4).bg(t.done)).child("Done")))
      .when(Boolean(address), (el) => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.hover).text_size(10.5).text_color(t.dim).child(address)));

    const searching = s && !s.path;
    const body = !address ? this.empty(t, "No chat for this tab", "Press Chat in the tab bar (⌘⇧C) on a tab running an agent.")
      : !terminal ? this.empty(t, "This terminal has ended", "Press Chat in the tab bar to go back.")
      : searching ? this.empty(t, s.searched ? `No ${KIND_NAMES[kind] ?? "agent"} session found yet` : "Looking for the session…",
        s.searched ? (kind ? "Chat mode reads the agent's own session files on its machine. A new session shows up after its first message." : "Chat mode supports Claude Code, Codex, Copilot, Antigravity and OpenCode.") : "")
      : v_flex().flex_1().min_h(0).relative()
        .child(v_flex().id("chat-list").size_full().pt(20).pb(12).gap(14).overflow_y_scrollbar().track_scroll(this.scroll)
          .on_scroll_wheel((e, cx) => { if (e.delta.y > 0 && s.follow) { s.follow = false; cx.notify(); } })
          .children(rows))
        .when(!s.follow, (el) => el.child(h_flex().absolute().bottom(12).left(0).right(0).justify_center()
          .child(div().id("latest").px(14).h(30).flex().items_center().gap(6).rounded(15).bg(t.popover).border(1).border_color(t.border)
            .text_size(12).text_color(t.foreground).cursor_pointer().hover((st) => st.bg(t.hover))
            .on_click((_e, cx) => { s.follow = true; this.scrollDown = true; cx.notify(); })
            .child("↓ Latest"))));

    const value = this.input.value();
    const canSend = Boolean(value.trim()) || Boolean(s?.attach?.length);
    const modeName = MODES.find((m) => m.id === current.mode)?.name ?? "Ask before edits";
    const modelName = MODELS.find((m) => m.id === current.model)?.name ?? session?.model ?? "Model";
    const effortName = EFFORTS.find((e) => e.id === current.effort)?.name ?? "Effort";
    const composer = v_flex().id("composer").w_full().on_drop((e, cx) => { if (e.paths?.length) this.addFiles(e.paths, cx); }).rounded(16).border(1).border_color(blocked ? t.blocked + "66" : t.input ?? t.border).bg(t.surface ?? t.background)
      .when(Boolean(s?.attach?.length), (el) => el.child(h_flex().px(12).pt(10).gap(8).flex_wrap().children(s.attach.map((a, i) =>
        div().id(`att-${i}`).relative()
          .child(a.image ? this.thumb(t, `att-img-${i}`, a.image, 96, 72)
            : div().px(10).py(7).rounded(8).bg(t.hover).text_size(11.5).text_color(t.foreground).child(a.name))
          .child(div().id(`att-x-${i}`).absolute().top(-6).right(-6).size(18).rounded(9).bg(t.foreground).text_color(t.background)
            .flex().items_center().justify_center().text_size(11).cursor_pointer()
            .on_click((_e, cx) => { cx.stop_propagation(); s.attach.splice(i, 1); cx.notify(); }).child("×"))))))
      .child(div().id("composer-input").w_full().when(Boolean(this.menu), (el) => el.key_context("ShepChatMenu"))
        .on_action("shep_chat_up", (_e, cx) => this.moveMenu(-1, cx))
        .on_action("shep_chat_down", (_e, cx) => this.moveMenu(1, cx))
        .on_action("shep_chat_accept", (_e, cx) => this.accept(this.menu?.items?.[this.menu.sel], cx))
        .on_action("shep_chat_close", (_e, cx) => { this.menu = null; cx.notify(); })
        .child(Textarea.new(this.input).w_full().px(14).pt(12).pb(4).border_0().bg(t.surface ?? t.background).text_size(13.5).text_color(t.foreground)))
      .child(h_flex().px(8).pb(8).pt(2).gap(6).items_center()
        .child(div().id("attach").size(28).flex_none().rounded(14).flex().items_center().justify_center().text_size(17).text_color(t.muted)
          .cursor_pointer().hover((st) => st.bg(t.hover).text_color(t.foreground)).tooltip("Attach files or images (or drop them, or paste a screenshot)")
          .on_click((_e, cx) => cx.spawn(async (cx) => { const p = await pickFiles(); if (p.length) this.addFiles(p, cx); }))
          .child("+"))
        .when(claude, (el) => el
          .child(this.chip(t, "mode", modeName, current))
          .child(this.chip(t, "model", modelName, current))
          .child(this.chip(t, "effort", effortName, current)))
        .when(!claude, (el) => el.children([s?.settings?.mode, s?.settings?.model, s?.settings?.effort].filter(Boolean).map((v, i) =>
          div().id(`info-${i}`).h(26).px(9).flex().flex_none().items_center().rounded(13).border(1).border_color(t.border)
            .text_size(11.5).text_color(t.muted).child(String(v)))))
        .child(div().flex_1())
        .when(typeof session?.ctx === "number" || typeof session?.cache === "number", (el) => el.child(this.contextMeter(t, session)))
        .child(div().w(6).flex_none())
        .child(this.sendButton(t, canSend, working, address)));

    return v_flex()
      .id("chat")
      .size_full()
      .rounded(10)
      .overflow_hidden()
      .bg(t.background)
      .text_color(t.foreground)
      .on_drop((e, cx) => { if (e.paths?.length) this.addFiles(e.paths, cx); })
      .child(header)
      .child(body)
      .when(Boolean(s?.error), (el) => el.child(this.row("err", div().text_size(11).text_color(t.blocked).child(`Transcript: ${s.error}`))))
      .when(Boolean(terminal), (el) => el.child(h_flex().id("bottom").w_full().flex_none().justify_center().px(24).pb(16).pt(6)
        .child(v_flex().w_full().max_w(WIDTH).gap(8)
          .when(blocked && Boolean(this.prompt), (c) => c.child(this.promptCard(t, address)))
          .when(Boolean(this.menu), (c) => c.child(this.menuPanel(t)))
          .child(composer))));
  }
}
