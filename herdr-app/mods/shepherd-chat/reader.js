// What the chat runs on the agent's machine, as: sh -c SCRIPT sh <args...>
// JSONL transcripts need sh and jq (as shepherd-report does); OpenCode's database needs python3.
//
// Every reader prints {"end": <cursor>, "reset", "items": [...]} or {"error"}, where items are:
//   {k:"user", id, ts, text, images}    a person's message; images: [{data (base64), media}]
//   {k:"assistant", id, ts, text}       the agent's reply (markdown)
//   {k:"tool", id, ts, name, input}     a tool call; long strings in its input are cut
//   {k:"result", id, of, err, text, images}  a tool call's result; `of` its call's id, or null
//                                       for the latest call without one (agy names none)
//   {k:"note", id, text}                something went wrong on the agent's side
//   {k:"mode", mode}                    Claude Code's permission mode from then on
//   {k:"settings", model, effort, mode} what the agent says it runs with
//   {k:"usage", ctx, cache}             context used and prompt cache hits, in percent

// Kinds of agent, from what the terminal reports (OSC 7501 `app`) or runs.
export function kindOf(app) {
  const a = String(app ?? "").toLowerCase();
  return /claude/.test(a) ? "claude" : /codex/.test(a) ? "codex" : /copilot/.test(a) ? "copilot"
    : /antigravity|\bagy\b/.test(a) ? "agy" : /opencode/.test(a) ? "opencode" : null;
}
export const KIND_NAMES = { claude: "Claude Code", codex: "Codex", copilot: "Copilot", agy: "Antigravity", opencode: "OpenCode" };

// Whole new lines of a JSONL file through a jq program:  <file> <offset> <max bytes first> <program>
const TAIL = String.raw`
f=$1; since=$2; max=$3; prog=$4
command -v jq >/dev/null 2>&1 || { printf '{"error":"jq is not installed"}\n'; exit 0; }
[ -r "$f" ] || { printf '{"error":"the transcript cannot be read"}\n'; exit 0; }
size=$(wc -c < "$f" | tr -d ' ')
reset=false
if [ "$since" -gt "$size" ]; then since=0; reset=true; fi
# Only whole lines: a line still being written waits for the next read.
end=$size
if [ "$size" -gt 0 ] && [ "$(tail -c 1 "$f" | od -An -c | tr -d ' ')" != '\n' ]; then
  part=$(tail -n 1 "$f" | wc -c | tr -d ' ')
  end=$((size - part))
fi
if [ "$end" -le "$since" ]; then
  printf '{"end":%s,"reset":%s,"items":[]}\n' "$since" "$reset"; exit 0
fi
start=$since
if [ "$since" = 0 ] && [ "$end" -gt "$max" ]; then start=$((end - max)); fi
tail -c +$((start + 1)) "$f" | head -c $((end - start)) | jq -R -n -c --argjson end "$end" --argjson reset "$reset" "$prog"
`;

const COMMON = String.raw`
def clip($n): if type == "string" and length > $n then .[0:$n] + "…" else . end;
def tidy: gsub("(?s)<system-reminder>.*?</system-reminder>"; "")
  | gsub("</?pasted_content[^>]*>"; "")
  | gsub("(?s)<hc from=\"[^\"]*\">(?<m>.*?)</hc>"; "\(.m)")
  | gsub("<command-name>(?<c>[^<]*)</command-name>"; "\(.c)")
  | gsub("(?s)<command-(message|args)>.*?</command-(message|args)>"; "")
  | gsub("^\\s+|\\s+$"; "");
def text: if type == "string" then . elif type == "array" then map(select(.type == "text" or .type == "Text" or .type == "input_text") | .text) | join("\n") elif . == null then "" else tojson end;
def images: if type == "array" then [.[] | select(.type == "image" and .source.type == "base64" and ((.source.data | length) < 6000000))
  | {data: .source.data, media: .source.media_type}] else [] end;
def cut: if type == "object" then with_entries(.value |= (if type == "string" then clip(6000) elif type == "array" or type == "object" then (tojson | clip(1500)) else . end)) else {value: (tostring | clip(1500))} end;
def pct($a; $b): if ($b // 0) > 0 then (($a // 0) * 100 / $b | floor) else null end;
`;

const wrap = (body) => `${COMMON}
{end: $end, reset: $reset, items: [inputs | fromjson? // empty | (${body})]}`;

const CLAUDE = wrap(String.raw`
  def shown: (startswith("<local-command") or startswith("Caveat:") or startswith("<task-notification")) | not;
  select(.isSidechain != true and .isMeta != true)
  | .timestamp as $ts | .uuid as $u
  | if .type == "permission-mode" then {k: "mode", mode: .permissionMode}
    elif .type == "user" then
      .message.content as $c
      | if ($c | type) == "string" then
          ($c | tidy) as $t | select($t != "" and ($t | shown)) | {k: "user", id: $u, ts: $ts, text: ($t | clip(8000)), images: []}
        else
          ($c | to_entries[] | .key as $i | .value | select(.type == "tool_result")
            | {k: "result", id: "\($u)-\($i)", of: .tool_use_id, err: (.is_error == true), text: (.content | text | clip(4000)), images: (.content | images)}),
          (([$c[] | select(.type == "text") | .text] | join("\n") | tidy) as $t
            | ($c | images) as $im
            | select(($t != "" and ($t | shown)) or ($im | length) > 0)
            | {k: "user", id: $u, ts: $ts, text: ($t | clip(8000)), images: $im})
        end
    elif .type == "assistant" then
      .message.content | if type == "array" then . else [] end | to_entries[] | .key as $i | .value
      | if .type == "text" then select(.text | test("\\S")) | {k: "assistant", id: "\($u)-\($i)", ts: $ts, text: (.text | clip(20000))}
        elif .type == "tool_use" then {k: "tool", id: .id, ts: $ts, name: .name, input: (.input // {} | cut)}
        else empty end
    else empty end`);

// Codex: each finished step as one `item_completed` event, plus its settings and token counts.
const CODEX = wrap(String.raw`
  .timestamp as $ts | .payload as $p
  | if .type == "event_msg" and $p.type == "item_completed" then
      $p.item as $it
      | if $it.type == "UserMessage" then
          ([$it.content[]? | select(.type == "text") | .text] | join("\n") | tidy) as $t
          | select($t != "" and ($t | startswith("<environment_context>") | not))
          | {k: "user", id: $it.id, ts: $ts, text: ($t | clip(8000)), images: []}
        elif $it.type == "AgentMessage" then
          ([$it.content[]? | .text // empty] | join("")) as $t | select($t | test("\\S"))
          | {k: "assistant", id: $it.id, ts: $ts, text: ($t | clip(20000))}
        elif $it.type == "CommandExecution" then
          {k: "tool", id: $it.id, ts: $ts, name: "Bash", input: {command: (($it.parsed_cmd[0].cmd // ($it.command | if type == "array" then .[-1] else tostring end)) | clip(6000))}},
          {k: "result", id: "\($it.id)-r", of: $it.id, err: (($it.exit_code // 0) != 0), text: (($it.aggregated_output // "") | clip(4000)), images: []}
        elif $it.type == "FileChange" then
          ($it.changes // {} | to_entries) as $ch
          | {k: "tool", id: $it.id, ts: $ts, name: "Patch", input: {file_path: ($ch[0].key // ""), files: ($ch | length),
              diff: ([$ch[] | "*** \(.value.type // "update") \(.key)\n" + ((.value.unified_diff // .value.content // "") | clip(3000))] | join("\n") | clip(8000))}},
            {k: "result", id: "\($it.id)-r", of: $it.id, err: ($it.status == "failed"), text: (($it.stderr // "") | clip(2000)), images: []}
        elif $it.type == "McpToolCall" then
          {k: "tool", id: $it.id, ts: $ts, name: "mcp__\($it.server)__\($it.tool)", input: ($it.arguments // {} | cut)},
          {k: "result", id: "\($it.id)-r", of: $it.id, err: ($it.result.isError == true or $it.status == "failed"), text: (($it.result.content // $it.error // "") | text | clip(4000)), images: []}
        elif $it.type == "Extension" then
          {k: "tool", id: $it.id, ts: $ts, name: "WebSearch", input: {query: ($it.query // "")}},
          {k: "result", id: "\($it.id)-r", of: $it.id, err: false, text: ([$it.results[]? | "- [\(.title // .url)](\(.url))"] | join("\n") | clip(3000)), images: []}
        else empty end
    elif .type == "event_msg" and $p.type == "thread_settings_applied" then
      {k: "settings", model: $p.thread_settings.model, effort: $p.thread_settings.reasoning_effort, mode: $p.thread_settings.approval_policy}
    elif .type == "event_msg" and $p.type == "token_count" and $p.info != null then
      $p.info as $i | {k: "usage", ctx: pct($i.last_token_usage.input_tokens; $i.model_context_window), cache: pct($i.last_token_usage.cached_input_tokens; $i.last_token_usage.input_tokens)}
    elif .type == "event_msg" and $p.type == "task_complete" and ($p.error // null) != null then
      {k: "note", id: "\($ts)-err", text: ($p.error | if type == "object" then (.message // tojson) else tostring end | clip(600))}
    else empty end`);

// Copilot CLI: events.jsonl in its session's folder.
const COPILOT = wrap(String.raw`
  .type as $t | .data as $d | .timestamp as $ts
  | if $t == "user.message" then
      ($d.content // "" | tidy) as $x | select($x != "") | {k: "user", id: (.id // $d.messageId), ts: $ts, text: ($x | clip(8000)), images: []}
    elif $t == "assistant.message" then
      (($d.content // "") | select(test("\\S")) | {k: "assistant", id: $d.messageId, ts: $ts, text: clip(20000)}),
      ($d.toolRequests[]? | if .name == "task_complete" then
          (.arguments.summary // "" | select(test("\\S")) | {k: "assistant", id: "\($d.messageId)-done", ts: $ts, text: clip(20000)})
        else {k: "tool", id: .toolCallId, ts: $ts, name: .name, input: (.arguments // {} | cut)} end)
    elif $t == "tool.execution_complete" then
      {k: "result", id: "\($d.toolCallId)-r", of: $d.toolCallId, err: ($d.success == false),
        text: (($d.result.content // $d.result.detailedContent // $d.error.message // $d.error // "") | text | clip(4000)), images: []}
    elif $t == "session.usage_record" then
      $d.usage as $u | {k: "usage", ctx: pct($u.inputTokens; $u.maxPromptTokens), cache: pct($u.cacheReadTokens; $u.inputTokens)},
      {k: "settings", model: ($u.modelDisplayName // $u.model)}
    elif $t == "session.mode_changed" then {k: "settings", mode: ($d.newMode // $d.mode // $d.agentMode)}
    elif $t == "session.error" or $t == "session.warning" then {k: "note", id: (.id // $ts), text: (($d.message // $d | tostring) | clip(600))}
    else empty end`);

// Antigravity CLI: its conversation's steps. Tool results name no call: they follow it.
const AGY = wrap(String.raw`
  .type as $t | "agy-\(.step_index)" as $sid | .created_at as $ts
  | if $t == "USER_INPUT" then
      (.content // "" | if test("<USER_REQUEST>") then (capture("(?s)<USER_REQUEST>\\s*(?<r>.*?)\\s*</USER_REQUEST>").r // .) else . end | tidy) as $x
      | select($x != "") | {k: "user", id: $sid, ts: $ts, text: ($x | clip(8000)), images: []}
    elif $t == "PLANNER_RESPONSE" then
      ((.content // "") | select(test("\\S")) | {k: "assistant", id: $sid, ts: $ts, text: clip(20000)}),
      (.tool_calls // [] | to_entries[] | {k: "tool", id: "\($sid)-\(.key)", ts: $ts, name: .value.name, input: (.value.args // {} | cut)}),
      {k: "usage", ctx: null, cache: pct(.cache_read_tokens; ((.input_tokens // 0) + (.cache_read_tokens // 0)))},
      {k: "settings", model: .model}
    elif $t == "GENERIC" and .source == "MODEL" then
      {k: "result", id: $sid, of: null, err: (.status == "ERROR"), text: ((.content // "") | clip(4000)), images: []}
    elif $t == "ERROR_MESSAGE" then {k: "note", id: $sid, text: ((.error // "error") | clip(600))}
    else empty end`);

export const PROGRAMS = { claude: CLAUDE, codex: CODEX, copilot: COPILOT, agy: AGY };
export const READER = TAIL;

// OpenCode keeps sessions in its SQLite database:  <database> <session> <cursor>
// Each read after a change returns the whole session (its last 300 messages) with reset.
export const OPENCODE = String.raw`
import json, re, sqlite3, sys
db, sid, since = sys.argv[1], sys.argv[2], int(sys.argv[3] or 0)
def clip(s, n):
    s = s if isinstance(s, str) else json.dumps(s, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + "…"
def text(v):
    if isinstance(v, list): return "\n".join(x.get("text", "") for x in v if isinstance(x, dict))
    return v if isinstance(v, str) else ("" if v is None else json.dumps(v, ensure_ascii=False))
def cut(v):
    if not isinstance(v, dict): return {"value": clip(v, 1500)}
    return {k: (clip(x, 6000) if isinstance(x, str) else clip(x, 1500) if isinstance(x, (list, dict)) else x) for k, x in v.items()}
try:
    c = sqlite3.connect("file:" + db + "?mode=ro", uri=True)
    end = c.execute("select max(m) from (select max(time_updated) m from session_message where session_id=? union all select max(time_updated) from session_part where session_id=?)", (sid, sid)).fetchone()[0] or 0
    if end <= since:
        print(json.dumps({"end": since, "reset": False, "items": []})); sys.exit()
    msgs = c.execute("select id, type, data from session_message where session_id=? order by seq desc limit 300", (sid,)).fetchall()[::-1]
    parts = {}
    for mid, data in c.execute("select message_id, data from session_part where session_id=? order by message_id, ordinal", (sid,)):
        parts.setdefault(mid, []).append(json.loads(data))
    items = []
    for mid, typ, data in msgs:
        d = json.loads(data)
        if typ == "user":
            t = re.sub(r"(?s)<hc from=\"[^\"]*\">(.*?)</hc>", r"\1", d.get("text", ""))
            t = re.sub(r"</?pasted_content[^>]*>", "", t).strip()
            if t.strip(): items.append({"k": "user", "id": mid, "text": clip(t, 8000), "images": []})
        elif typ == "assistant":
            for i, p in enumerate(parts.get(mid, [])):
                if p.get("type") == "text" and p.get("text", "").strip():
                    items.append({"k": "assistant", "id": mid + "-" + str(i), "text": clip(p["text"], 20000)})
                elif p.get("type") == "tool":
                    st = p.get("state", {}) or {}
                    items.append({"k": "tool", "id": p.get("id"), "name": p.get("name"), "input": cut(st.get("input", {}))})
                    if st.get("status") in ("completed", "error"):
                        items.append({"k": "result", "id": str(p.get("id")) + "-r", "of": p.get("id"), "err": st.get("status") == "error",
                                      "text": clip(text(st.get("content") or st.get("output") or st.get("error")), 4000), "images": []})
            if d.get("error"): items.append({"k": "note", "id": mid + "-e", "text": clip(text(d.get("error")), 600)})
    s = c.execute("select model, tokens_input, tokens_cache_read from session_v2 where id=?", (sid,)).fetchone()
    if s:
        try: model = json.loads(s[0] or "{}").get("id")
        except Exception: model = None
        total = (s[1] or 0) + (s[2] or 0)
        items.append({"k": "settings", "model": model})
        items.append({"k": "usage", "ctx": None, "cache": (s[2] or 0) * 100 // total if total else None})
    print(json.dumps({"end": end, "reset": True, "items": items}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)[:200]}))
`;

// The files a process and its children have open (Linux /proc, else lsof).
const OPEN = String.raw`
tree() { k=$(pgrep -P "$1" 2>/dev/null); g=$(for x in $k; do pgrep -P "$x" 2>/dev/null; done); echo "$1" $k $g; }
open_files() { for p in $(tree "$1"); do ls -l "/proc/$p/fd" 2>/dev/null | sed 's/.* -> //'; lsof -nP -p "$p" -Fn 2>/dev/null | sed -n 's/^n//p'; done; }
`;

// Where an agent's session is, from its process:  <pid> <folder> <title>
// prints its transcript's path (OpenCode: "<database>\t<session>"), or nothing.
export const LOCATE = {
  claude: String.raw`
for p in "$1" $(pgrep -P "$1" 2>/dev/null); do
  for d in "$CLAUDE_CONFIG_DIR" "$HOME/.claude"; do
    [ -n "$d" ] && [ -f "$d/sessions/$p.json" ] || continue
    id=$(sed -n 's/.*"sessionId" *: *"\([^"]*\)".*/\1/p' "$d/sessions/$p.json" | head -1)
    [ -n "$id" ] || continue
    log=$(ls -t "$d"/projects/*/"$id".jsonl 2>/dev/null | head -1)
    [ -n "$log" ] && { printf '%s\n' "$log"; exit 0; }
  done
done
exit 0`,
  // The rollout it has open; else the newest one started in its folder.
  codex: OPEN + String.raw`
f=$(open_files "$1" | grep -E '/sessions/.*rollout-[^/]*\.jsonl$' | sort -u | head -1)
[ -n "$f" ] && { printf '%s\n' "$f"; exit 0; }
root="$CODEX_HOME"; [ -n "$root" ] || root="$HOME/.codex"
find "$root/sessions" -name 'rollout-*.jsonl' -mtime -3 2>/dev/null | xargs ls -t 2>/dev/null | while read -r f; do
  head -c 20000 "$f" | grep -q "\"cwd\":\"$2\"" && { printf '%s\n' "$f"; break; }
done
exit 0`,
  // Copilot marks the session it holds with inuse.<pid>.hold.
  copilot: String.raw`
root="$COPILOT_HOME"; [ -n "$root" ] || root="$HOME/.copilot"
for p in "$1" $(pgrep -P "$1" 2>/dev/null); do
  for h in "$root"/session-state/*/inuse."$p".hold; do
    [ -f "$h" ] || continue
    d=$(dirname "$h")
    [ -f "$d/events.jsonl" ] && { printf '%s\n' "$d/events.jsonl"; exit 0; }
  done
done
exit 0`,
  // agy holds presence/<conversation>.lock; its steps are in brain/<conversation>.
  agy: OPEN + String.raw`
base="$HOME/.gemini/antigravity-cli"
best=""
for id in $(open_files "$1" | grep -Eo 'antigravity-cli/(presence|conversations)/[0-9a-fA-F-]{36}' | grep -Eo '[0-9a-fA-F-]{36}$' | sort -u); do
  d="$base/brain/$id/.system_generated/logs"
  log=""
  if [ -f "$d/transcript_full.jsonl" ]; then log="$d/transcript_full.jsonl"; elif [ -f "$d/transcript.jsonl" ]; then log="$d/transcript.jsonl"; fi
  [ -n "$log" ] || continue
  head -n 1 "$log" | grep -q '"USER_INPUT"' || continue
  if [ -z "$best" ] || [ "$log" -nt "$best" ]; then best=$log; fi
done
[ -n "$best" ] && printf '%s\n' "$best"
exit 0`,
  // OpenCode shares one database: its session in this folder with the title the terminal shows.
  opencode: String.raw`
db="$XDG_DATA_HOME"; [ -n "$db" ] || db="$HOME/.local/share"; db="$db/opencode/opencode.db"
[ -f "$db" ] || exit 0
python3 -I -c '
import sqlite3, sys
db, cwd, title = sys.argv[1:4]
c = sqlite3.connect("file:" + db + "?mode=ro", uri=True)
r = c.execute("select id from session_v2 where directory=? and parent_id is null order by (title=?) desc, time_updated desc limit 1", (cwd, title)).fetchone()
if r: print(db + "\t" + r[0])
' "$db" "$2" "$3" 2>/dev/null
exit 0`,
};

// The skills and custom commands an agent in <folder> can run, one per line:
//   <skill|command>\t<name>\t<description>
// From the agent's own folders under the home folder (given after <folder>), the project's
// .claude, and Claude Code's installed plugins.
export const CATALOG = String.raw`
cwd=$1; shift
meta() { awk -v k="$1" 'NR==1 && !/^---/ {exit} NR>1 && /^---/ {exit} more {sub(/^ +/, ""); print substr($0, 1, 200); exit} NR>1 && index($0, k ":") == 1 {sub("^" k ": *", ""); if ($0 ~ /^[>|][-+]?$/) {more=1; next} gsub(/^["\047]|["\047]$/, ""); print substr($0, 1, 200); exit}' "$2"; }
emit() {
  name=$(meta name "$2"); [ -n "$name" ] || name=$3
  printf '%s\t%s\t%s\n' "$1" "$4$name" "$(meta description "$2")"
}
for base in "$cwd/.claude" $(for b in "$@"; do printf '%s/%s\n' "$HOME" "$b"; done); do
  for f in "$base"/skills/*/SKILL.md; do [ -f "$f" ] && emit skill "$f" "$(basename "$(dirname "$f")")" ""; done
  for f in "$base"/commands/*.md "$base"/prompts/*.md; do [ -f "$f" ] && emit command "$f" "$(basename "$f" .md)" ""; done
done
for b in "$@"; do [ "$b" = .claude ] || continue
find -L "$HOME/.claude/plugins/cache" -maxdepth 6 \( -path '*/skills/*/SKILL.md' -o -path '*/commands/*.md' \) 2>/dev/null | head -400 | while read -r f; do
  plugin=$(printf '%s' "$f" | sed 's#.*/plugins/cache/[^/]*/\([^/]*\)/.*#\1#')
  case "$f" in
    */SKILL.md) emit skill "$f" "$(basename "$(dirname "$f")")" "$plugin:";;
    *) emit command "$f" "$(basename "$f" .md)" "$plugin:";;
  esac
done; done
exit 0
`;

// Each agent's own folders for skills and commands (CATALOG's arguments).
export const SKILL_HOMES = {
  claude: [".claude"],
  codex: [".codex", ".agents"],
  copilot: [".copilot", ".agents"],
  agy: [".gemini/antigravity-cli", ".agents"],
  opencode: [".config/opencode", ".agents"],
};

// The files under <folder> an @ can name: git's list in a repository, else a shallow find.
export const FILES = String.raw`
cd "$1" 2>/dev/null || exit 0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git ls-files -co --exclude-standard 2>/dev/null | head -20000
else
  find . -maxdepth 4 \( -name .git -o -name node_modules -o -name .venv \) -prune -o -type f -print 2>/dev/null | sed 's#^\./##' | head -20000
fi
exit 0
`;

// Claude Code's footer names its permission mode while it is not the default.
export const modeOnScreen = (screen) => /accept edits on/i.test(screen) ? "acceptEdits" : /plan mode on/i.test(screen) ? "plan"
  : /auto mode on/i.test(screen) ? "auto" : /bypass permissions on/i.test(screen) ? "bypassPermissions" : "default";
