// Claude Code's own slash commands that make sense from a chat, as its menu describes them.
// Skills and custom commands come from the agent's machine (reader.js CATALOG).
export const BUILTIN = [
  ["add-dir", "Add a new working directory"],
  ["btw", "Ask a quick side question without interrupting the main conversation"],
  ["clear", "Start a new session with empty context"],
  ["compact", "Free up context by summarizing the conversation so far"],
  ["context", "Visualize current context usage"],
  ["cost", "Show the cost and duration of this session"],
  ["diff", "View uncommitted changes and per-turn diffs"],
  ["effort", "Set effort level for model usage"],
  ["export", "Export the current conversation to a file or clipboard"],
  ["fast", "Toggle fast mode"],
  ["goal", "Set a goal Claude checks before stopping"],
  ["init", "Initialize a new CLAUDE.md file with codebase documentation"],
  ["mcp", "Manage MCP servers"],
  ["memory", "Edit CLAUDE.md files and memory settings"],
  ["model", "Set the AI model for Claude Code"],
  ["plan", "Enable plan mode or view the current session plan"],
  ["recap", "Generate a one-line session recap now"],
  ["rename", "Rename the current conversation"],
  ["resume", "Resume a previous conversation"],
  ["review", "Review a pull request"],
  ["rewind", "Restore the code and/or conversation to a previous point"],
  ["security-review", "Complete a security review of the pending changes"],
  ["status", "Show version, model, account and connectivity"],
  ["todos", "List the current todo items"],
  ["usage", "Show plan usage limits"],
].map(([name, desc]) => ({ kind: "builtin", name, desc }));

// The models and effort levels Claude Code takes, and its permission modes in shift+tab order.
export const MODELS = [
  { id: "claude-opus-5-5", name: "Opus 5.5", hint: "Most capable" },
  { id: "claude-fable-5-2", name: "Fable 5.2", hint: "Long, careful work" },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5", hint: "Fast and capable" },
  { id: "claude-haiku-5-5", name: "Haiku 5.5", hint: "Fastest" },
];
export const EFFORTS = [
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
  { id: "xhigh", name: "Extra high" },
  { id: "max", name: "Max" },
];
export const MODES = [
  { id: "default", name: "Ask before edits", hint: "Asks before changing files or running commands" },
  { id: "acceptEdits", name: "Accept edits", hint: "Edits go through; other actions still ask" },
  { id: "plan", name: "Plan", hint: "Reads and plans, changes nothing" },
  { id: "auto", name: "Auto", hint: "Runs what looks safe without asking" },
  { id: "bypassPermissions", name: "Bypass permissions", hint: "Nothing asks first (needs a launch flag)" },
];
