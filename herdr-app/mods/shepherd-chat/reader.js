// Shell scripts the chat runs on the agent's machine, each as: sh -c SCRIPT sh <args...>
// They need only sh, sed and jq (as shepherd-report does).

// Reads what is new in a transcript:  <transcript> <offset> <max bytes on the first read>
// prints {"end": <offset of the last whole line>, "size", "reset", "items": [...]} or {"error"}.
//   {k:"user", id, ts, text, images}    a person's message; images: [{data (base64), media}]
//   {k:"assistant", id, ts, text}       the agent's reply (markdown)
//   {k:"tool", id, ts, name, input}     a tool call; long strings in its input are cut
//   {k:"result", id, of, err, text, images}  a tool call's result, `of` its call's id
//   {k:"mode", mode}                    the session's permission mode from then on
export const READER = String.raw`
f=$1; since=$2; max=$3
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
  printf '{"end":%s,"size":%s,"reset":%s,"items":[]}\n' "$since" "$size" "$reset"; exit 0
fi
start=$since
if [ "$since" = 0 ] && [ "$end" -gt "$max" ]; then start=$((end - max)); fi
tail -c +$((start + 1)) "$f" | head -c $((end - start)) | jq -R -n -c --argjson end "$end" --argjson size "$size" --argjson reset "$reset" '
def clip($n): if type == "string" and length > $n then .[0:$n] + "…" else . end;
def tidy: gsub("(?s)<system-reminder>.*?</system-reminder>"; "")
  | gsub("</?pasted_content[^>]*>"; "")
  | gsub("<command-name>(?<c>[^<]*)</command-name>"; "\(.c)")
  | gsub("(?s)<command-(message|args)>.*?</command-(message|args)>"; "")
  | gsub("^\\s+|\\s+$"; "");
def shown: (startswith("<local-command") or startswith("Caveat:") or startswith("<task-notification")) | not;
def text: if type == "string" then . elif type == "array" then map(select(.type == "text") | .text) | join("\n") else tojson end;
def images: if type == "array" then [.[] | select(.type == "image" and .source.type == "base64" and ((.source.data | length) < 6000000))
  | {data: .source.data, media: .source.media_type}] else [] end;
{end: $end, size: $size, reset: $reset, items: [inputs | fromjson? // empty
  | select(.isSidechain != true and .isMeta != true)
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
        elif .type == "tool_use" then {k: "tool", id: .id, ts: $ts, name: .name,
          input: (.input // {} | with_entries(.value |= (if type == "string" then clip(6000) elif type == "array" or type == "object" then (tojson | clip(1500)) else . end)))}
        else empty end
    else empty end]}'
`;

// The transcript of the Claude Code session running as `pid` (or a child of it), from the
// session file Claude Code keeps for each process:  <pid>
// prints the transcript's path, or nothing.
export const LOCATE = String.raw`
for p in "$1" $(pgrep -P "$1" 2>/dev/null); do
  for d in "$CLAUDE_CONFIG_DIR" "$HOME/.claude"; do
    [ -n "$d" ] && [ -f "$d/sessions/$p.json" ] || continue
    id=$(sed -n 's/.*"sessionId" *: *"\([^"]*\)".*/\1/p' "$d/sessions/$p.json" | head -1)
    [ -n "$id" ] || continue
    log=$(ls -t "$d"/projects/*/"$id".jsonl 2>/dev/null | head -1)
    [ -n "$log" ] && { printf '%s\n' "$log"; exit 0; }
  done
done
exit 0
`;

// The skills and custom commands an agent in <folder> can run, one per line:
//   <skill|command>\t<name>\t<description>
// From the person's and the project's .claude folders, and from installed plugins.
export const CATALOG = String.raw`
cwd=$1
meta() { awk -v k="$1" 'NR==1 && !/^---/ {exit} NR>1 && /^---/ {exit} more {sub(/^ +/, ""); print substr($0, 1, 200); exit} NR>1 && index($0, k ":") == 1 {sub("^" k ": *", ""); if ($0 ~ /^[>|][-+]?$/) {more=1; next} gsub(/^["\047]|["\047]$/, ""); print substr($0, 1, 200); exit}' "$2"; }
emit() {
  name=$(meta name "$2"); [ -n "$name" ] || name=$3
  printf '%s\t%s\t%s\n' "$1" "$4$name" "$(meta description "$2")"
}
for base in "$cwd/.claude" "$HOME/.claude"; do
  for f in "$base"/skills/*/SKILL.md; do [ -f "$f" ] && emit skill "$f" "$(basename "$(dirname "$f")")" ""; done
  for f in "$base"/commands/*.md; do [ -f "$f" ] && emit command "$f" "$(basename "$f" .md)" ""; done
done
find -L "$HOME/.claude/plugins/cache" -maxdepth 6 \( -path '*/skills/*/SKILL.md' -o -path '*/commands/*.md' \) 2>/dev/null | head -400 | while read -r f; do
  plugin=$(printf '%s' "$f" | sed 's#.*/plugins/cache/[^/]*/\([^/]*\)/.*#\1#')
  case "$f" in
    */SKILL.md) emit skill "$f" "$(basename "$(dirname "$f")")" "$plugin:";;
    *) emit command "$f" "$(basename "$f" .md)" "$plugin:";;
  esac
done
exit 0
`;

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
