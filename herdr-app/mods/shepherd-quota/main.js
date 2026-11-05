// The foot of the Shepherd sidebar: the focused agent's quota as one line (an agent
// without quota shows only its icon; a plain terminal, or nothing focused, only the
// terminal icon), then Settings, Machines (add a machine) and Commands (the palette). Clicking the quota opens every account with its windows, resets and pace;
// leaving that popup closes it.
//
// Where the numbers come from, newest first per account:
//   1. `shepherd.quota` labels that `shepherd-report` writes from an agent's status
//      line, on terminals of any connected machine: Claude Code's documented
//      `rate_limits`, and Antigravity CLI's `quota` buckets.
//   2. A fallback on the machine that holds the login, when no label is fresh: its
//      `curl` asks the providers' own usage endpoints (Claude's OAuth usage, ChatGPT's
//      Codex usage, GitHub's Copilot user, OpenCode Go's usage). These are
//      undocumented and may change; the token never leaves that machine. Results are
//      kept in shared("shepherd.quota").
// Remaining quota is shown (100% = untouched), as the status line does. Pace compares
// what is used with how much of the window has gone by: well ahead of the clock runs
// out early. A card's bar marks how much of the window's time is left.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, panes, focused, exec, run, theme, shared, setShared, openOverlay, closeOverlay, props, window, home } from "herdr";

const STORE = "shepherd.quota";
const FRESH_MS = 10 * 60000; // a label newer than this needs no fallback
const POLL_MS = 5 * 60000; // fallback at most this often per machine and provider
const RETRY_MS = 30 * 60000; // after a failed fallback (no login, no curl/jq)
const STALE_MS = 30 * 60000; // older numbers are marked as such

// Prints {"account": {...}, "usage": <endpoint body>} or {"error": "..."}. Needs curl and jq.
// The token goes to curl on stdin (-H @-), so it is not in the process list.
const FALLBACK = `
fail() { jq -nc --arg e "$1" '{error: $e}' 2>/dev/null || printf '{"error":"fallback needs jq"}\\n'; exit 0; }
command -v curl >/dev/null 2>&1 || fail "curl is not installed"
command -v jq >/dev/null 2>&1 || fail "jq is not installed"
case "$1" in
claude)
  dir=\${CLAUDE_CONFIG_DIR:-$HOME/.claude}
  conf=\${CLAUDE_CONFIG_DIR:+$CLAUDE_CONFIG_DIR/.claude.json}; conf=\${conf:-$HOME/.claude.json}
  token=$(jq -r '.claudeAiOauth.accessToken // empty' "$dir/.credentials.json" 2>/dev/null)
  if [ -z "$token" ] && command -v security >/dev/null 2>&1; then
    token=$(security find-generic-password -s 'Claude Code-credentials' -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)
  fi
  [ -n "$token" ] || fail "no Claude Code login"
  account=$(jq -c '.oauthAccount // {} | {id: .accountUuid, email: .emailAddress, org: .organizationName}' "$conf" 2>/dev/null) || account='{}'
  body=$(printf 'Authorization: Bearer %s\\n' "$token" | curl -fsS -m 15 -H @- -H 'anthropic-beta: oauth-2025-04-20' -H 'Accept: application/json' https://api.anthropic.com/api/oauth/usage 2>&1) || fail "$body"
  ;;
codex)
  auth=\${CODEX_HOME:-$HOME/.codex}/auth.json
  token=$(jq -r '.tokens.access_token // empty' "$auth" 2>/dev/null)
  id=$(jq -r '.tokens.account_id // empty' "$auth" 2>/dev/null)
  [ -n "$token" ] || fail "no Codex login"
  account=$(jq -nc --arg id "$id" '{id: (if $id == "" then null else $id end)}')
  body=$({ printf 'Authorization: Bearer %s\\n' "$token"; [ -n "$id" ] && printf 'ChatGPT-Account-Id: %s\\n' "$id"; } | curl -fsS -m 15 -H @- -H 'User-Agent: codex_cli_rs/0.1' -H 'Accept: application/json' https://chatgpt.com/backend-api/wham/usage 2>&1) || fail "$body"
  ;;
copilot)
  # Copilot CLI's login (its config starts with // comments), else OpenCode's Copilot
  # login, else gh's token.
  token=$(sed '/^[[:space:]]*\\/\\//d' "\${COPILOT_HOME:-$HOME/.copilot}/config.json" 2>/dev/null | jq -r '[.authTokens // {} | to_entries[] | .value.token // empty][0] // empty' 2>/dev/null)
  [ -n "$token" ] || token=$(jq -r '."github-copilot".refresh // empty' "\${XDG_DATA_HOME:-$HOME/.local/share}/opencode/auth.json" 2>/dev/null)
  [ -n "$token" ] || token=$(gh auth token 2>/dev/null)
  [ -n "$token" ] || fail "no Copilot login"
  account='{}'
  body=$(printf 'Authorization: token %s\\n' "$token" | curl -fsS -m 15 -H @- -H 'Accept: application/json' -H 'X-GitHub-Api-Version: 2025-04-01' https://api.github.com/copilot_internal/user 2>&1) || fail "$body"
  body=$(printf '%s' "$body" | jq -c '{login, copilot_plan, quota_reset_date, quota_reset_date_utc, quota_snapshots}' 2>/dev/null) || fail "unexpected answer"
  ;;
opencode)
  # OpenCode's Console sign-in (opencode auth login), as OpenCode itself reads Go usage.
  db=\${XDG_DATA_HOME:-$HOME/.local/share}/opencode/opencode.db
  [ -f "$db" ] || fail "no OpenCode data"
  q="select value from credential where integration_id = 'opencode' and active = 1 order by time_updated desc limit 1"
  cred=$(sqlite3 -readonly "$db" "$q" 2>/dev/null)
  if [ -z "$cred" ] && command -v python3 >/dev/null 2>&1; then
    cred=$(python3 -I -c 'import sqlite3, sys; r = sqlite3.connect("file:" + sys.argv[1] + "?mode=ro", uri=True).execute(sys.argv[2]).fetchone(); print(r[0] if r else "")' "$db" "$q" 2>/dev/null)
  fi
  [ -n "$cred" ] || fail "no OpenCode Console login (needs sqlite3 or python3 to read it)"
  token=$(printf '%s' "$cred" | jq -r 'if .type == "oauth" then .access else .key end // empty' 2>/dev/null)
  org=$(printf '%s' "$cred" | jq -r '.metadata.orgID // empty' 2>/dev/null)
  expires=$(printf '%s' "$cred" | jq -r '.expires // 0 | floor' 2>/dev/null)
  [ -n "$token" ] && [ -n "$org" ] || fail "no OpenCode Console workspace"
  [ "\${expires:-0}" = 0 ] || [ "$expires" -gt "$(date +%s)000" ] || fail "OpenCode Console login expired; open OpenCode to refresh it"
  origin=$(printf '%s' "$cred" | jq -r '.metadata.server // "https://opencode.ai"' | sed -E 's#^(https?://[^/]+).*#\\1#; s#//console\\.opencode\\.ai$#//opencode.ai#')
  account=$(printf '%s' "$cred" | jq -c '.metadata // {} | {id: (.accountID // null), email: (.email // null), org: (.orgName // null)}')
  body=$({ printf 'Authorization: Bearer %s\\n' "$token"; printf 'x-opencode-org-id: %s\\n' "$org"; } | curl -fsS -m 15 -H @- -H 'Accept: application/json' "$origin/zen/go/v1/usage" 2>&1) || fail "$body"
  ;;
*) fail "unknown provider" ;;
esac
printf '%s' "$body" | jq -c --argjson account "$account" '{account: $account, usage: .}' 2>/dev/null || fail "unexpected answer"
`;

// Whether an agent runs this program, by Herdr's agent kind, program key or name.
const runs = (re) => (a) => [a.app, a.program?.key, a.program?.name].some((v) => typeof v === "string" && re.test(v));

// In display order. `fallback`: asked on the login's machine when no label is fresh.
const PROVIDERS = {
  claude: { name: "Claude", app: "Claude Code", fallback: true, is: runs(/^claude([- ]code)?$/i) },
  codex: { name: "Codex", app: "Codex", fallback: true, is: runs(/^codex$/i) },
  copilot: { name: "Copilot", app: "GitHub Copilot", fallback: true, is: runs(/copilot/i) },
  opencode: { name: "OpenCode Go", app: "OpenCode", fallback: true, is: runs(/^open ?code$/i) },
  // Only its status line reports quota (through shepherd-report).
  antigravity: { name: "Antigravity", app: "Antigravity CLI", fallback: false, is: runs(/antigravity|^agy$/i) },
};
const ORDER = Object.keys(PROVIDERS);

const HOUR = 3600 * 1000;
const BAR = 118; // a card's bar, in the 340-wide popup
const SPAN = { five_hour: 5 * HOUR, seven_day: 7 * 24 * HOUR, day: 24 * HOUR };

// The foot's buttons, as in jotyy/herdr-ovis-studio: Machines opens Herdr's shipped
// machine-add mod.
const ACTIONS = {
  settings: () => run("app.settings"),
  machines: () => run("mod.open", { name: "machine-add" }),
  commands: () => run("app.palette"),
};

const machineOf = (address) => (address?.includes("/") ? address.slice(0, address.indexOf("/")) : "");

function jsonLabel(terminal, key) {
  const raw = terminal?.labels?.[key];
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

// Seconds, milliseconds or an ISO date: milliseconds, or null.
function toMs(value) {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

const win = (used, resets) => (typeof used === "number" ? { used, resets: toMs(resets) } : null);
const cap = (s) => s.replace(/^\w/, (c) => c.toUpperCase());
// A model's own weekly limit by its model's name ("Fable", or whichever comes next): the
// limit's scope (a name, or an object naming it), else its kind ("seven_day_opus": "Opus").
function modelName(kind, scope) {
  const named = typeof scope === "string" ? scope
    : scope && typeof scope === "object" ? scope.display_name ?? scope.name ?? scope.model ?? scope.model_family ?? Object.values(scope).find((v) => typeof v === "string")
    : null;
  if (typeof named === "string" && named.trim()) return cap(named.trim().replace(/^claude[-_ ]/i, "").replace(/[-_]/g, " "));
  return cap(kind.replace(/^(weekly|seven_day)_/, ""));
}
const accountKey = (provider, account, machine) => `${provider}:${account?.id || account?.email || `@${machine}`}`;

// A month-long window's length, from when it resets back to the same day a month before.
function monthSpan(resets) {
  if (!resets) return 30 * SPAN.day;
  const start = new Date(resets);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return resets - start.getTime();
}

// Every account keeps its limits as a list of windows:
//   {id, label (in a card), short (in the foot, when shown there), used %, resets ms, span ms}
// The first two with a `short` are the foot's line.
const windowOf = (id, label, short, w, span) => ({ id, label, short, span, used: w?.used ?? null, resets: w?.resets ?? null });

// Claude and Codex: 5h and 7d (shown even when unknown), then each model's own weekly limit.
const mainWindows = (five, seven, models = []) => [
  windowOf("5h", "5h", "5h", five, SPAN.five_hour),
  windowOf("7d", "7d", "7d", seven, SPAN.seven_day),
  ...models.map((m) => windowOf(m.label, m.label, null, m, SPAN.seven_day)),
];

// An entry saved before windows were a list.
const windowsOf = (e) => (Array.isArray(e.windows) ? e.windows : mainWindows(e.five_hour, e.seven_day, e.models));

// Antigravity's buckets ("gemini-weekly", "3p-weekly"...): named by what they cover,
// as long as their period says.
function bucketWindow(w) {
  const id = String(w.id ?? "");
  const base = id.replace(/[-_](weekly|daily|monthly|\d+h)$/i, "") || id;
  const label = base.length <= 3 ? base.toUpperCase() : cap(base.replace(/[-_]/g, " "));
  const span = /weekly/i.test(id) ? SPAN.seven_day : /daily/i.test(id) ? SPAN.day : /monthly/i.test(id) ? 30 * SPAN.day
    : /(\d+)h$/i.test(id) ? Number(id.match(/(\d+)h$/i)[1]) * HOUR : null;
  return windowOf(id, label, label.length <= 3 ? label : label[0], win(w.used, w.resets), span);
}
// Gemini's own bucket first: it is the one most work draws on.
const bucketWindows = (list) => list.map(bucketWindow).sort((a, b) => (/gemini/i.test(b.id) ? 1 : 0) - (/gemini/i.test(a.id) ? 1 : 0));

// One account's numbers from a `shepherd.quota` label.
function fromLabel(terminal) {
  const q = jsonLabel(terminal, "shepherd.quota");
  if (!q || !PROVIDERS[q.provider]) return null;
  const machine = machineOf(terminal.address);
  return {
    key: accountKey(q.provider, q.account, machine),
    provider: q.provider,
    account: q.account ?? {},
    plan: q.plan ?? null,
    windows: Array.isArray(q.windows) ? bucketWindows(q.windows)
      : mainWindows(win(q.five_hour?.used, q.five_hour?.resets), win(q.seven_day?.used, q.seven_day?.resets)),
    at: toMs(q.at) ?? 0,
    source: "status line",
    machines: [machine],
  };
}

function parseClaude(usage) {
  const limits = Array.isArray(usage?.limits) ? usage.limits : [];
  const find = (kind) => limits.find((l) => l.kind === kind && typeof l.percent === "number");
  const session = find("session"), weekly = find("weekly_all");
  // Weekly limits of one model (Fable, Opus...) come after the two main windows.
  const models = limits.filter((l) => /^weekly_/.test(l.kind) && l.kind !== "weekly_all" && typeof l.percent === "number")
    .map((l) => ({ label: modelName(l.kind, l.scope), ...win(l.percent, l.resets_at) }));
  if (!limits.length) {
    for (const [k, v] of Object.entries(usage ?? {})) {
      if (/^seven_day_./.test(k) && typeof v?.utilization === "number") models.push({ label: modelName(k), ...win(v.utilization, v.resets_at) });
    }
  }
  return mainWindows(
    session ? win(session.percent, session.resets_at) : win(usage?.five_hour?.utilization, usage?.five_hour?.resets_at),
    weekly ? win(weekly.percent, weekly.resets_at) : win(usage?.seven_day?.utilization, usage?.seven_day?.resets_at),
    models,
  );
}

function parseCodex(usage) {
  const out = { five_hour: null, seven_day: null };
  for (const w of [usage?.rate_limit?.primary_window, usage?.rate_limit?.secondary_window]) {
    if (typeof w?.used_percent !== "number") continue;
    const resets = w.reset_at ?? (typeof w.reset_after_seconds === "number" ? Date.now() / 1000 + w.reset_after_seconds : null);
    out[(w.limit_window_seconds ?? 0) <= 6 * 3600 ? "five_hour" : "seven_day"] = win(w.used_percent, resets);
  }
  return mainWindows(out.five_hour, out.seven_day);
}

// Copilot: each limited allowance (premium requests, and chat and completions on the
// free plan), all resetting at the start of the month.
function parseCopilot(usage) {
  const resets = toMs(usage?.quota_reset_date_utc ?? usage?.quota_reset_date);
  const names = { premium_interactions: ["Premium", "Mo"], chat: ["Chat", null], completions: ["Completions", null] };
  return Object.entries(usage?.quota_snapshots ?? {})
    .filter(([, q]) => q && !q.unlimited && typeof q.percent_remaining === "number")
    .sort(([a], [b]) => (b === "premium_interactions") - (a === "premium_interactions"))
    .map(([id, q]) => {
      const [label, short] = names[id] ?? [cap(id.replace(/_/g, " ")), null];
      return windowOf(id, label, short, win(Math.round((100 - q.percent_remaining) * 10) / 10, resets), monthSpan(resets));
    });
}

// OpenCode Go: a rolling 5h, a week and a month of the subscription, each as % used.
function parseOpenCode(usage) {
  const u = usage?.usage ?? {};
  const month = win(u.monthly?.percent, u.monthly?.resetsAt);
  return [
    windowOf("5h", "5h", "5h", win(u.rolling?.percent, u.rolling?.resetsAt), SPAN.five_hour),
    windowOf("7d", "7d", "7d", win(u.weekly?.percent, u.weekly?.resetsAt), SPAN.seven_day),
    windowOf("month", "Month", "Mo", month, monthSpan(month?.resets)),
  ];
}

const PARSE = { claude: parseClaude, codex: parseCodex, copilot: parseCopilot, opencode: parseOpenCode };

// Every account, newest numbers first. A window past its reset starts again unused.
function entries(now) {
  const byKey = new Map();
  const add = (e) => {
    if (!e) return;
    const old = byKey.get(e.key);
    const machines = [...new Set([...(old?.machines ?? []), ...(e.machines ?? [])])];
    if (!old || e.at > old.at) byKey.set(e.key, { ...e, account: { ...old?.account, ...e.account }, machines });
    else old.machines = machines;
  };
  for (const e of Object.values(shared(STORE) ?? {})) add(e);
  for (const t of terminals()) add(fromLabel(t));
  for (const e of byKey.values()) {
    e.windows = windowsOf(e).map((w) => (w.resets && w.resets <= now ? { ...w, used: 0, resets: null, rolled: true } : w));
  }
  const rank = (p) => (ORDER.includes(p) ? ORDER.indexOf(p) : ORDER.length);
  return [...byKey.values()].sort((a, b) => (a.provider === b.provider ? b.at - a.at : rank(a.provider) - rank(b.provider)));
}

// What the foot shows for the focused pane: quota when supported, otherwise its live context.
function pathLabel(path) {
  if (!path) return "";
  const h = home();
  if (h && path.replace(/[\\/]+$/, "") === h.replace(/[\\/]+$/, "")) return "~";
  const clean = path.replace(/[\\/]+$/, "");
  return clean.split(/[\\/]/).at(-1) || path;
}

function subject(list) {
  const f = focused();
  if (!f) return { terminal: true, label: "Terminal", cwd: null };
  const pane = f.pane ? panes().find((p) => p.pane === f.pane) : null;
  const address = pane?.terminal ?? f.terminal ?? f.agent;
  const terminal = address && terminals().find((t) => t.address === address);
  const own = terminal && fromLabel(terminal);
  if (own) return { entry: list.find((e) => e.key === own.key) ?? own };
  const agent = address && agents().find((a) => a.address === address);
  const program = agent?.program ?? pane?.program;
  const cwd = pane?.cwd ?? f.cwd ?? terminal?.cwd ?? null;
  const name = program?.name || "Terminal";
  const label = [name, pathLabel(cwd)].filter(Boolean).join(" · ");
  const provider = agent && Object.keys(PROVIDERS).find((p) => PROVIDERS[p].is(agent));
  if (provider) {
    const m = machineOf(address);
    const same = list.find((e) => e.provider === provider && e.machines?.includes(m));
    return same ? { entry: same } : { provider, machine: m, program, cwd, label };
  }
  if (program?.icon && !program.shell) return { program, cwd, label };
  return { terminal: true, program, cwd, label };
}

function ago(ms, now) {
  const m = Math.round((now - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}

function inTime(ms, now) {
  if (!ms) return null;
  const m = Math.max(0, Math.round((ms - now) / 60000));
  return m < 60 ? `${m}m` : m < 48 * 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.round(m / 1440)}d`;
}

const who = (e) => e.account?.email || e.account?.name || e.account?.org || (e.machines?.[0] ? e.machines[0] : "this computer");

const left = (w) => (typeof w?.used === "number" ? Math.max(0, Math.min(100, 100 - w.used)) : null);
const leftColor = (t, l) => (l === null ? t.dim : l <= 10 ? t.blocked : l <= 50 ? t.ansi3 ?? t.working : t.accent);

// How far through its window the clock is (0..1), when the window's length is known.
function elapsed(w, span, now) {
  if (!w?.resets || !span) return null;
  return Math.max(0, Math.min(1, 1 - (w.resets - now) / span));
}

function pace(w, span, now) {
  const e = elapsed(w, span, now);
  if (e === null || typeof w.used !== "number") return null;
  const d = w.used - e * 100;
  return d > 10 ? "ahead of pace" : d < -10 ? "under pace" : "on pace";
}

// A program's icon from the app's program table: a one-color glyph or a picture.
function programIcon(t, p, size) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(t.foreground) : image(p.icon).w(size).h(size).flex_none();
}

// A plain shell's badge, as the Shepherd sidebar draws it.
const terminalIcon = (t, size) => div().size(size).flex_none().flex().items_center().justify_center()
  .rounded(3).border(1.5).border_color(t.input ?? t.border).text_size(size * 0.47).font_bold().text_color(t.dim).child(">_");

// The provider's program icon from a running agent, else its initial.
function providerIcon(t, provider, size) {
  const p = agents().find((a) => PROVIDERS[provider]?.is(a))?.program;
  if (p?.icon) return p.tint ? svg(p.icon).size(size).flex_none().text_color(t.foreground) : image(p.icon).w(size).h(size).flex_none();
  return div().size(size).flex_none().flex().items_center().justify_center().text_size(size * 0.6).font_bold().text_color(t.foreground)
    .child((PROVIDERS[provider]?.name ?? provider)[0]?.toUpperCase() ?? "?");
}

export default class Quota extends View {
  init(_props, cx) {
    if (props()?.all) return;
    this.polled = new Map(); // "machine|provider" -> when it may be asked again
    this.busy = new Set();
    this.errors = new Map(); // "machine|provider" -> why its fallback failed last
    cx.timer.every(60000, (cx) => {
      this.fallback(cx);
      cx.notify(); // ages and resets move on their own
    });
  }

  // Asks a machine's own login for numbers no label brought recently.
  fallback(cx) {
    if (!window()) return; // `herdr-app check` renders without a window.
    const now = Date.now();
    const fresh = new Set();
    for (const t of terminals()) {
      const e = fromLabel(t);
      if (e && now - e.at < FRESH_MS) fresh.add(`${machineOf(t.address)}|${e.provider}`);
    }
    const wanted = new Set();
    for (const a of agents()) {
      for (const [p, def] of Object.entries(PROVIDERS)) {
        const job = `${machineOf(a.address)}|${p}`;
        if (def.fallback && def.is(a) && !fresh.has(job)) wanted.add(job);
      }
    }
    for (const job of wanted) {
      if ((this.polled.get(job) ?? 0) > now || this.busy.has(job)) continue;
      this.busy.add(job);
      const [m, provider] = job.split("|");
      cx.spawn(async (cx) => {
        let ok = false;
        try {
          const r = await exec("sh", ["-c", FALLBACK, "sh", provider], { on: m || null });
          const out = JSON.parse(r.stdout || "{}");
          if (out.error || !out.usage) throw Error(out.error || r.stderr || "no answer");
          const windows = PARSE[provider](out.usage);
          if (!windows.some((w) => typeof w.used === "number")) throw Error("no quota windows in the answer");
          const account = provider === "codex" ? { ...out.account, email: out.usage.email ?? null }
            : provider === "copilot" ? { id: out.usage.login ?? null, name: out.usage.login ?? null }
            : out.account ?? {};
          const plan = provider === "copilot" ? (out.usage.copilot_plan ? `Copilot ${cap(out.usage.copilot_plan)}` : null)
            : provider === "opencode" ? "OpenCode Go"
            : out.usage.plan_type ?? null;
          const e = {
            key: accountKey(provider, account, m),
            provider,
            account,
            plan,
            windows,
            at: Date.now(),
            source: "usage endpoint",
            machines: [m],
          };
          setShared(STORE, { ...(shared(STORE) ?? {}), [e.key]: e });
          this.errors.delete(job);
          ok = true;
        } catch (error) {
          this.errors.set(job, `${PROVIDERS[provider].name}${m ? ` on ${m}` : ""}: ${String(error.message ?? error).split("\n")[0].slice(0, 160)}`);
        } finally {
          this.polled.set(job, Date.now() + (ok ? POLL_MS : RETRY_MS));
          this.busy.delete(job);
          cx.notify();
        }
      });
    }
  }

  // The foot's one line: icon, then what each window has left as a short bar.
  compact(t, e) {
    const mini = (id, label, w) => {
      const u = left(w);
      return h_flex().id(id).flex_1().min_w(0).gap(5).items_center().text_size(11)
        .child(div().min_w(14).flex_none().text_color(t.dim).child(label))
        // Only the bar shrinks; labels and percentages keep their space.
        .child(div().relative().flex_1().min_w(0).h(4).rounded(2).bg(t.border).overflow_hidden()
          .child(div().absolute().left(0).top(0).h_full().w(`${u ?? 0}%`).rounded(2).bg(leftColor(t, u))))
        .child(div().w(30).flex_none().text_right().text_color(leftColor(t, u)).child(u === null ? "–" : `${Math.round(u)}%`));
    };
    return h_flex().w_full().gap(10).items_center().min_w(0).overflow_hidden()
      .child(providerIcon(t, e.provider, 14))
      .children(e.windows.filter((w) => w.short).slice(0, 2).map((w) => mini(`${e.key}-${w.id}`, w.short, w)));
  }

  // One window in a card: label, bar (marked where the window's time left is), left, resets in.
  windowRow(t, id, label, w, span, now) {
    const u = left(w);
    const gone = elapsed(w, span, now);
    const mark = gone === null ? null : 1 - gone;
    const resets = w && inTime(w.resets, now);
    return h_flex().id(id).gap(10).items_center().text_size(11.5)
      .tooltip(u === null ? `${label}: no data` : `${label}: ${Math.round(u)}% left${resets ? ` · resets in ${resets}` : w.rolled ? " · window reset" : ""}${mark !== null ? ` · ${Math.round(mark * 100)}% of the window's time left` : ""}`)
      .child(div().w(52).flex_none().truncate().text_color(t.dim).child(label))
      .child(div().relative().flex_none().w(BAR).h(5).rounded(3).bg(t.border)
        .child(div().h_full().w(Math.round((BAR * (u ?? 0)) / 100)).rounded(3).bg(leftColor(t, u)))
        .when(mark !== null, (el) => el.child(div().absolute().top(0).bottom(0).w(2).rounded(1).bg(t.foreground).opacity(0.6).left(Math.min(BAR - 2, Math.round(BAR * mark))))))
      .child(div().w(34).flex_none().text_right().font_medium().text_color(u === null ? t.dim : t.foreground).child(u === null ? "–" : `${Math.round(u)}%`))
      .child(div().w(56).flex_none().text_right().text_color(t.dim).child(resets ?? ""));
  }

  // One account in the popup.
  card(t, e, now) {
    const stale = now - e.at > STALE_MS;
    const email = e.account?.email;
    const plan = e.plan ? e.plan[0].toUpperCase() + e.plan.slice(1) : PROVIDERS[e.provider]?.name ?? e.provider;
    const name = email || e.account?.name;
    const title = name ? `${plan} (${name})` : `${plan} · ${who(e)}`;
    const where = (e.machines ?? []).map((m) => m || "this computer").join(", ");
    const windows = e.windows;
    const paces = windows.map((w) => [w.label, pace(w, w.span, now)]).filter(([, p]) => p);
    return v_flex().gap(10).p(12).rounded(10).bg(t.raised ?? t.chrome).border(1).border_color(t.border)
      .child(h_flex().gap(10).items_center().min_w(0)
        .child(div().size(32).flex_none().rounded(8).bg(t.hover).flex().items_center().justify_center().child(providerIcon(t, e.provider, 18)))
        .child(v_flex().flex_1().min_w(0).gap(1)
          .child(div().min_w(0).truncate().text_size(13).font_medium().text_color(t.foreground).child(title))
          .child(div().min_w(0).truncate().text_size(11).text_color(t.dim).child([PROVIDERS[e.provider]?.app, where].filter(Boolean).join(" · "))))
        .child(div().flex_none().text_size(11).text_color(stale ? t.blocked : t.dim).child(ago(e.at, now))))
      .child(v_flex().gap(7).children(windows.map((w) => this.windowRow(t, `${e.key}-${w.id}`, w.label, w, w.span, now))))
      .when(paces.length > 0, (el) => el.child(div().text_size(11).text_color(t.dim).child(paces.map(([id, p]) => `${id} ${p}`).join(" · "))));
  }

  footButton(t, id, tip, iconName, label, action) {
    return h_flex().id(id).h(28).px(label ? 8 : 0).when(!label, (el) => el.w(28).justify_center()).gap(8).flex_none().items_center().rounded(6)
      .text_size(12.5).text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip)
      .on_click(() => action())
      .child(svg(`mods/shepherd-quota/icons/${iconName}.svg`).size(15))
      .when(Boolean(label), (el) => el.child(label));
  }

  openAll(count) {
    openOverlay({ mod: "shepherd-quota", kind: "popup", width: 340, height: Math.min(560, 52 + Math.max(1, count) * 190), props: { all: true } });
  }

  render(cx) {
    const t = theme();
    const now = Date.now();
    const list = entries(now);
    if (props()?.all) {
      return v_flex()
        .id("quota-all")
        .size_full()
        .p(12)
        .gap(10)
        .bg(t.popover)
        .overflow_y_scrollbar()
        // Leaving the popup closes it.
        .on_hover((on) => { if (!on) closeOverlay(props().overlay); })
        .child(div().px(2).text_size(13).font_medium().text_color(t.foreground).child("Usage"))
        .when(list.length === 0, (el) => el.child(div().text_size(12).text_color(t.dim).child("No usage yet. Claude Code and Antigravity report it through shepherd-report in their status line; Codex, Copilot and OpenCode Go are asked on the machine they run on.")))
        .children(list.map((e) => this.card(t, e, now)));
    }
    if (this.firstLook !== true) {
      this.firstLook = true;
      this.fallback(cx);
    }
    const focus = subject(list);
    const line = focus.entry ? div().flex_1().min_w(0).child(this.compact(t, focus.entry))
      : focus.provider ? h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(programIcon(t, focus.program, 14) ?? providerIcon(t, focus.provider, 14))
        .child(div().min_w(0).truncate().text_size(11).text_color(t.dim).child("Waiting for quota"))
      : h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(focus.program?.icon && !focus.program.shell ? programIcon(t, focus.program, 14) : terminalIcon(t, 14))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(focus.label || "Terminal"));
    const tooltip = focus.entry ? `Usage of every account${now - focus.entry.at > STALE_MS ? ` · stale data, updated ${ago(focus.entry.at, now)}` : ""}`
      : focus.provider ? (this.errors?.get(`${focus.machine}|${focus.provider}`)
        || (PROVIDERS[focus.provider].fallback ? "Waiting for quota data" : `Waiting for quota data from ${PROVIDERS[focus.provider].app}'s status line`))
      : `No quota source · ${focus.label || "Terminal"}${focus.cwd ? ` · ${focus.cwd}` : ""}`;
    return v_flex()
      .id("foot")
      .size_full()
      .px(8)
      .pt(6)
      .pb(6)
      .gap(2)
      .justify_end()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .child(h_flex()
        .id("quota")
        .h(26)
        .px(8)
        .flex_none()
        .items_center()
        .rounded(6)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .tooltip(tooltip)
        .on_click(() => this.openAll(list.length))
        .child(line))
      .child(h_flex().h(32).flex_none().items_center().gap(2)
        .child(this.footButton(t, "settings", "Settings", "settings", "Settings", ACTIONS.settings))
        .child(div().flex_1())
        .child(this.footButton(t, "machines", "Add a machine", "server", null, ACTIONS.machines))
        .child(this.footButton(t, "commands", "Commands", "command", null, ACTIONS.commands)));
  }
}
