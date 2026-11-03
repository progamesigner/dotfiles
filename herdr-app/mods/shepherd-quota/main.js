// Subscription quota at the bottom of the Shepherd sidebar: one account (the focused
// agent's, else the latest), and every account in a popup when clicked.
//
// Where the numbers come from, newest first per account:
//   1. `shepherd.quota` labels that `shepherd-report` writes from Claude Code's status
//      line (documented `rate_limits` fields), on terminals of any connected machine.
//   2. A fallback on the machine that holds the login, when no label is fresh: its
//      `curl` asks the providers' own usage endpoints (Claude's OAuth usage, ChatGPT's
//      Codex usage). These are undocumented and may change; the token never leaves
//      that machine. Results are kept in shared("shepherd.quota").
// Remaining quota is shown (100% = untouched), as the status line does.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, focused, exec, theme, shared, setShared, openOverlay, props, window } from "herdr";

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
*) fail "unknown provider" ;;
esac
printf '%s' "$body" | jq -c --argjson account "$account" '{account: $account, usage: .}' 2>/dev/null || fail "unexpected answer"
`;

const PROVIDERS = {
  claude: { name: "Claude", is: (a) => a.app === "claude-code" || a.program?.key === "claude" },
  codex: { name: "Codex", is: (a) => a.app === "codex" || a.program?.key === "codex" },
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
const accountKey = (provider, account, machine) => `${provider}:${account?.id || account?.email || `@${machine}`}`;

// One account's numbers from a `shepherd.quota` label.
function fromLabel(terminal) {
  const q = jsonLabel(terminal, "shepherd.quota");
  if (!q || q.provider !== "claude") return null;
  const machine = machineOf(terminal.address);
  return {
    key: accountKey("claude", q.account, machine),
    provider: "claude",
    account: q.account ?? {},
    five_hour: win(q.five_hour?.used, q.five_hour?.resets),
    seven_day: win(q.seven_day?.used, q.seven_day?.resets),
    at: toMs(q.at) ?? 0,
    source: "status line",
    machines: [machine],
  };
}

function parseClaude(usage) {
  const limits = Array.isArray(usage?.limits) ? usage.limits : [];
  const find = (kind) => limits.find((l) => l.kind === kind && typeof l.percent === "number");
  const session = find("session"), weekly = find("weekly_all");
  return {
    five_hour: session ? win(session.percent, session.resets_at) : win(usage?.five_hour?.utilization, usage?.five_hour?.resets_at),
    seven_day: weekly ? win(weekly.percent, weekly.resets_at) : win(usage?.seven_day?.utilization, usage?.seven_day?.resets_at),
  };
}

function parseCodex(usage) {
  const out = { five_hour: null, seven_day: null };
  for (const w of [usage?.rate_limit?.primary_window, usage?.rate_limit?.secondary_window]) {
    if (typeof w?.used_percent !== "number") continue;
    const resets = w.reset_at ?? (typeof w.reset_after_seconds === "number" ? Date.now() / 1000 + w.reset_after_seconds : null);
    out[(w.limit_window_seconds ?? 0) <= 6 * 3600 ? "five_hour" : "seven_day"] = win(w.used_percent, resets);
  }
  return out;
}

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
    for (const w of ["five_hour", "seven_day"]) {
      if (e[w]?.resets && e[w].resets <= now) e[w] = { used: 0, resets: null, rolled: true };
    }
  }
  return [...byKey.values()].sort((a, b) => (a.provider === b.provider ? b.at - a.at : a.provider === "claude" ? -1 : 1));
}

// The focused agent's account, else the most recently updated one.
function primary(list) {
  const f = focused();
  const address = f?.agent ?? f?.terminal;
  if (address) {
    const own = fromLabel(terminals().find((t) => t.address === address));
    if (own) return list.find((e) => e.key === own.key) ?? own;
    const agent = agents().find((a) => a.address === address);
    const provider = agent && Object.keys(PROVIDERS).find((p) => PROVIDERS[p].is(agent));
    const m = machineOf(address);
    const same = provider && list.find((e) => e.provider === provider && e.machines?.includes(m));
    if (same) return same;
  }
  return [...list].sort((a, b) => b.at - a.at)[0] ?? null;
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

const who = (e) => e.account?.email || e.account?.org || (e.machines?.[0] ? e.machines[0] : "this computer");

export default class Quota extends View {
  init(_props, cx) {
    if (props()?.all) return;
    this.polled = new Map(); // "machine|provider" -> when it may be asked again
    this.busy = new Set();
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
      if (e && now - e.at < FRESH_MS) fresh.add(machineOf(t.address));
    }
    const wanted = new Set();
    for (const a of agents()) {
      for (const [p, def] of Object.entries(PROVIDERS)) {
        const m = machineOf(a.address);
        if (def.is(a) && !(p === "claude" && fresh.has(m))) wanted.add(`${m}|${p}`);
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
          const windows = provider === "claude" ? parseClaude(out.usage) : parseCodex(out.usage);
          if (!windows.five_hour && !windows.seven_day) throw Error("no quota windows in the answer");
          const account = provider === "codex" ? { ...out.account, email: out.usage.email ?? null } : out.account ?? {};
          const e = {
            key: accountKey(provider, account, m),
            provider,
            account,
            plan: out.usage.plan_type ?? null,
            ...windows,
            at: Date.now(),
            source: "usage endpoint",
            machines: [m],
          };
          setShared(STORE, { ...(shared(STORE) ?? {}), [e.key]: e });
          ok = true;
        } catch (error) {
          this.error = `${PROVIDERS[provider].name}${m ? ` on ${m}` : ""}: ${String(error.message ?? error).split("\n")[0].slice(0, 160)}`;
        } finally {
          this.polled.set(job, Date.now() + (ok ? POLL_MS : RETRY_MS));
          this.busy.delete(job);
          cx.notify();
        }
      });
    }
  }

  meter(t, id, label, w, now, width) {
    const left = w ? Math.max(0, Math.min(100, 100 - w.used)) : null;
    const color = left === null ? t.dim : left <= 20 ? t.blocked : left <= 50 ? t.ansi3 ?? t.working : t.accent;
    const resets = w && inTime(w.resets, now);
    return h_flex()
      .id(id)
      .flex_1()
      .min_w(0)
      .gap(5)
      .items_center()
      .text_size(11)
      .tooltip(left === null ? `${label}: no data` : `${label}: ${left}% left${resets ? ` · resets in ${resets}` : w.rolled ? " · window reset" : ""}`)
      .child(div().flex_none().text_color(t.dim).child(label))
      .child(div().flex_none().w(width).h(4).rounded(2).bg(t.border).overflow_hidden()
        .child(div().h_full().w(Math.round((width * (left ?? 0)) / 100)).rounded(2).bg(color)))
      .child(div().flex_none().text_color(left === null ? t.dim : color).child(left === null ? "–" : `${Math.round(left)}%`));
  }

  account(t, e, now, big) {
    const stale = now - e.at > STALE_MS;
    return v_flex()
      .gap(big ? 6 : 4)
      .min_w(0)
      .child(h_flex().gap(6).items_center().min_w(0).text_size(11)
        .child(div().flex_none().font_medium().text_color(t.muted).child(PROVIDERS[e.provider]?.name ?? e.provider))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(`${who(e)}${e.plan ? ` · ${e.plan}` : ""}`))
        .when(big || stale, (el) => el.child(div().flex_none().text_color(stale ? t.blocked : t.dim).child(ago(e.at, now)))))
      .child(h_flex().gap(10).items_center()
        .child(this.meter(t, `${e.key}-5h`, "5h", e.five_hour, now, big ? 72 : 44))
        .child(this.meter(t, `${e.key}-7d`, "7d", e.seven_day, now, big ? 72 : 44)))
      .when(big, (el) => el.child(div().text_size(10.5).text_color(t.dim).child(`from the ${e.source}${e.machines?.length ? ` · ${e.machines.map((m) => m || "this computer").join(", ")}` : ""}`)));
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
        .gap(14)
        .bg(t.popover)
        .overflow_y_scrollbar()
        .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Quota"))
        .when(list.length === 0, (el) => el.child(div().text_size(12).text_color(t.dim).child("No quota yet. Claude Code reports it through shepherd-report in its status line; Codex is asked on the machine it runs on.")))
        .children(list.map((e) => this.account(t, e, now, true)));
    }
    if (this.firstLook !== true) {
      this.firstLook = true;
      this.fallback(cx);
    }
    const main = primary(list);
    return v_flex()
      .id("quota")
      .size_full()
      .px(16)
      .py(9)
      .justify_center()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .tooltip(this.error && !main ? this.error : "All accounts")
      .on_click(() => openOverlay({ mod: "shepherd-quota", kind: "popup", width: 320, height: Math.min(480, 56 + Math.max(1, list.length) * 86), props: { all: true } }))
      .child(main ? this.account(t, main, now, false) : div().text_size(11).text_color(t.dim).child("No quota yet"));
  }
}
