# mna

> Command-line tool for [My Next Adventure](https://mynextadventure.cloud).

`mna` is an open-source CLI for managing your trips on My Next Adventure.
It also ships as an agent skill — run `mna skills install` and your AI coding
agent (Claude Code, Cursor, …) can plan, research, build, cost, and manage whole
trips on your behalf. See [`skills/mna/SKILL.md`](./skills/mna/SKILL.md).

Status: **pre-1.0, alpha.** Tagged releases publish binaries to GitHub
Releases. npm and Homebrew distribution land with the first tag.

## Install

### npm (Node 20+)

```bash
npm install -g @mantacodedevs/mna-cli
```

This installs the `mna` binary. It bundles all dependencies as a single
JS file; no Bun required.

### Homebrew (macOS + Linux)

```bash
brew install mantacodedevs/tap/mna
```

Installs a precompiled native binary. The tap is updated per release; see
[RELEASING.md](./RELEASING.md).

### Pre-built binary from GitHub Releases

```bash
# Pick the right artifact for your OS/arch:
#   mna-darwin-arm64.tar.gz   (Apple Silicon)
#   mna-darwin-x64.tar.gz     (Intel Mac)
#   mna-linux-x64.tar.gz      (Linux x86_64)
curl -L -o mna.tar.gz \
  https://github.com/MantaCodeDevs/mna-cli/releases/latest/download/mna-darwin-arm64.tar.gz
tar -xzf mna.tar.gz
mv mna-darwin-arm64 /usr/local/bin/mna
mna --version
```

### From source (development)

```bash
git clone https://github.com/MantaCodeDevs/mna-cli
cd mna-cli
bun install
bun run codegen
bun run build
bun link
```

`bun run build` is required before `bun link` — it produces `dist/mna.js`, the bin
target. `bun link` only creates the `mna` symlink if that file already exists, so
skipping the build leaves you with `command not found: mna`.

`mna` should then be on your PATH. See [DEVELOPMENT.md](./DEVELOPMENT.md).

## Quickstart

```bash
mna login                          # opens browser for one-click consent
mna trips list                     # see your trips
mna trips show <tripId>            # detail view
```

If you prefer headless / paste-token login:

```bash
mna login --paste-token <key>      # generate the key from the user menu on app.mynextadventure.cloud
```

## Use it from your AI coding agent

`mna` doubles as an agent **skill** — install it and your agent can plan, research, cost, and
manage whole trips for you. **One command:**

```bash
mna skills install
```

It detects the AI clients on your machine, shows exactly what it will write where, and asks
once. After a successful `mna login` on an interactive terminal it offers the same thing with a
single `y` (silence it with `mna config set skills.prompt false`).

```bash
mna skills list                      # what's detected, and what's already installed
mna skills list --all                # every client mna knows how to install into
mna skills install --dry-run         # show the writes, change nothing
mna skills install --client cursor   # one client only
mna skills install --all --yes       # every supported client, no prompt
mna skills install --no-mcp          # skill only, skip the MCP server entry
mna skills install --scope project   # into ./.claude/skills etc. instead of $HOME
mna skills uninstall                 # remove the skill directory again
```

`--scope project` relocates the **skill** only; MCP servers have no project-level equivalent in
most clients, so they stay in the user-level config either way.

Installs are designed to be boring and reversible:

- **Idempotent** — identical files are left alone; a second run reports "already up to date".
- **Merged, never overwritten** — only the single `mcpServers.my-next-adventure` key is set.
  Configs with `//` comments or trailing commas (VS Code, Gemini CLI) are edited in place, so
  your comments and key order survive. The object being merged into may be re-indented;
  nothing else in the file is touched.
- **Atomic** — every write goes to a temp file and is `rename()`d into place, so an interrupt
  or a full disk cannot truncate a large config like `~/.claude.json`.
- **Backed up** — anything modified is copied to `<file>.mna-backup-<timestamp>` first (mode
  `0600`, most recent 3 kept).
- **Refuses what it doesn't understand** — a config that won't parse, or that has a non-object
  where `mcpServers` should be, is reported and skipped rather than replaced. That only skips
  the MCP entry; the skill files still install.
- **Isolated failures** — an unwritable path for one client doesn't abandon the others, and the
  summary reports what was actually written. Exit code is non-zero if anything failed.

### Supported clients

Every skill directory below is the one that vendor documents — sources linked, and `mna skills
list --json` reports the same URL per client so you can check without taking our word for it.

| Client | `--client` | Skill | MCP server config |
|---|---|---|---|
| Claude Code | `claude-code` | [`~/.claude/skills/mna/`](https://code.claude.com/docs/en/skills) | `~/.claude.json` → `mcpServers` |
| Cursor | `cursor` | [`~/.cursor/skills/mna/`](https://cursor.com/docs/skills) | `~/.cursor/mcp.json` → `mcpServers` |
| Claude Desktop | `claude-desktop` | — | `claude_desktop_config.json` (per-OS) → `mcpServers` |
| Windsurf / Devin Desktop | `windsurf` | [`~/.codeium/windsurf/skills/mna/`](https://docs.devin.ai/desktop/cascade/skills) | `~/.codeium/windsurf/mcp_config.json` |
| VS Code (Copilot agent mode) | `vscode` | — | `<VS Code user dir>/mcp.json` → `servers` |
| Shared agent directory | `agents`, `codex` | [`~/.agents/skills/mna/`](https://learn.chatgpt.com/docs/build-skills) | — |
| OpenCode | `opencode` | [`~/.config/opencode/skills/mna/`](https://opencode.ai/docs/skills/) | — |
| Gemini CLI | `gemini-cli` | [`~/.gemini/skills/mna/`](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md) | `~/.gemini/settings.json` → `mcpServers` |

`~/.agents/skills/` is documented as a read location by Codex CLI, Gemini CLI, Cursor, OpenCode
and Windsurf, so one copy there serves several agents. Worth being precise about what that is:
five vendors independently documenting the same path, **not** a spec guarantee — the Agent Skills
standard defines what a skill contains, not where clients look for one. Claude Code does not read
it. **Codex CLI reads only that path** — `~/.codex/skills/` is a third-party compatibility claim
that OpenAI's own docs do not make, so `--client codex` installs to `~/.agents/skills/`. Codex
keeps MCP servers in TOML, which `mna` does not edit.

Two caveats the CLI also prints, marked `(?)` in the plan:

- **Claude Desktop on Linux.** The Linux build is official (beta), but no Anthropic doc states
  it reads `~/.config/Claude/claude_desktop_config.json` — only the macOS and Windows paths are
  documented. On Linux `mna` writes the conventional path and tells you it is unverified.
- Anything else added on convention alone is flagged the same way rather than silently reported
  as installed.

The MCP entry points at the hosted server `https://mcp.mynextadventure.cloud/mcp`, written in
whichever shape the client expects — `{"type":"http","url":…}` for Claude Code and VS Code,
`{"url":…}` for Cursor, `{"httpUrl":…}` for Gemini CLI, `{"serverUrl":…}` for Windsurf, and the
`npx -y mcp-remote` stdio bridge for Claude Desktop, which has no native remote transport. If
you're logged in, **your API key is written into that config file in plain text** — that is how
these clients take credentials. `mna` sets any config it writes a key into to mode `0600`, and
says so before writing. Prefer OAuth? Use `--no-mcp`, or run `mna skills install` before
`mna login` and let the client do its own OAuth handshake on first use.

### Manual install (fallback)

The skill is plain markdown driving the CLI, so any agent that reads `SKILL.md` files can use
it. Copy it wherever your agent looks:

```bash
# from a clone
mkdir -p ~/.claude/skills && cp -r skills/mna ~/.claude/skills/

# from the npm package
mkdir -p ~/.claude/skills && cp -r "$(npm root -g)/@mantacodedevs/mna-cli/skills/mna" ~/.claude/skills/
```

The skill drives the `mna` CLI, so install the CLI (above) and run `mna login` first.

## Commands

Every command supports `--json` for piping into `jq` or Claude.

### Auth & identity

| Command | Description |
|---|---|
| `mna login [--paste-token <key>]` | Browser-mediated login (default) or headless paste-token. |
| `mna logout [--local-only]` | Revoke the current API key server-side and delete local credentials. |
| `mna whoami [--verify]` | Show the current user; `--verify` re-fetches from `/v1/me`. |
| `mna keys list` | List active API keys with `current` flag on the calling key. |
| `mna keys revoke <name> [--yes]` | Revoke an API key by name. |
| `mna config get\|set apiBaseUrl [<url>]` | Read/override the API base URL locally. |
| `mna config get\|set skills.prompt [true\|false]` | Toggle the post-login "install the skill?" offer. |

### Agent integration

| Command | Description |
|---|---|
| `mna skills list [--all] [--scope=user\|project]` | Show detected AI clients and whether the skill/MCP server is installed. |
| `mna skills install [--client=<id>] [--all] [--scope=user\|project] [--no-mcp] [--dry-run] [--yes]` | Install the skill (and MCP server entry) into your AI clients. |
| `mna skills uninstall [--client=<id>] [--scope=user\|project] [--dry-run] [--yes]` | Remove the installed skill directory. |

### Trips

| Command | Description |
|---|---|
| `mna trips list [--status=planning\|ready\|finished\|cancelled] [--include-example]` | List trips. |
| `mna trips show <tripId> [--all-options]` | Show one trip in detail: each variant's party, plus an accommodation table per variant (cost, guest rating in its source scale, facilities). By default only the selected variant and its selected options; `--all-options` adds the unselected variants and options. |
| `mna trips create --name <name> [--cover-photo <url>]` | Create a new trip. |
| `mna trips edit <tripId> [--name=...] [--cover-photo=...] [--status=...] [--budget=<json>]` | Update trip-level fields. `--budget` is owner only, and `--budget null` clears it. |
| `mna trips delete <tripId> [--yes]` | Delete a trip permanently. |
| `mna trips share <tripId>` | Generate a shareable link for the trip. |
| `mna trips unshare <tripId>` | Revoke all share links. |

### Variants

| Command | Description |
|---|---|
| `mna variants add <tripId> --name <name> <date flags> [<party flags>] [--notes=...]` | Add a new variant. Dates are required, and the party defaults to one adult — see below. |
| `mna variants duplicate <tripId> <variantId>` | Duplicate a variant, party included. |
| `mna variants edit <tripId> <variantId> [--name=...] [--notes=...] [<date flags>] [<party flags>]` | Update variant fields. Omitting the date or party flags leaves those alone. |
| `mna variants select <tripId> <variantId>` | Set the selected variant. |
| `mna variants delete <tripId> <variantId> [--yes]` | Delete a variant. |

A variant carries the trip's dates, and the API refuses to store one without them. Give
either shape, whole — the CLI rejects a half-filled or mixed set before it sends anything:

- **Exact:** `--start-date=YYYY-MM-DD --end-date=YYYY-MM-DD`
- **Flexible:** `--depart-not-before --depart-not-after --return-not-before --return-not-after --min-nights --max-nights`

```bash
mna variants add <tripId> --name "Beach option" --start-date 2026-09-01 --end-date 2026-09-08
mna variants add <tripId> --name "Flexible option" \
  --depart-not-before 2026-09-01 --depart-not-after 2026-09-03 \
  --return-not-before 2026-09-10 --return-not-after 2026-09-12 \
  --min-nights 7 --max-nights 10
```

A variant also records who is travelling, and the budget breakdown is worked out from it. **Set it
whenever the trip is not solo:** a variant created without it is stored as one adult.

- `--adults=<n>` — at least 1.
- `--child-ages=<a,b>` — one age per child, 0–17, comma-separated or repeated. Requires `--adults` on `add`.
- `--no-children` — an adults-only party; on `edit`, removes any children already set.

```bash
mna variants add <tripId> --name "Family option" --start-date 2026-09-01 --end-date 2026-09-08 \
  --adults 2 --child-ages 8,5
mna variants edit <tripId> <variantId> --adults 3         # keeps the children
mna variants edit <tripId> <variantId> --child-ages 8,5,2  # keeps the adults
mna variants edit <tripId> <variantId> --no-children
```

The API replaces the whole party on every write, so `variants edit` reads the current one first and
changes only what you named. Leave the flags off and the party stays untouched. `variants duplicate`
copies the party along with everything else. To see it, `mna trips show` has a Party column for the
selected variant; add `--all-options` to include the other variants.

### Destinations

| Command | Description |
|---|---|
| `mna destinations add <tripId> <variantId> --place <name> [--notes=...] [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--return-to-home]` | Add a destination. |
| `mna destinations edit <tripId> <variantId> <destinationKey> [--place=...] [--notes=...] [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--no-return-to-home]` | Update destination. |
| `mna destinations reorder <tripId> <variantId> --order=key1,key2,key3` | Reorder destinations. |
| `mna destinations delete <tripId> <variantId> <destinationKey> [--yes]` | Delete a destination. |

### Options (accommodation \| transport \| getting-around)

| Command | Description |
|---|---|
| `mna options add <tripId> <variantId> <destinationKey> <kind> --from-json=<file> [--free-cancellation-until=<date>] [--details=<json>] [--photos=<json>]` | Add an option from JSON. `--free-cancellation-until`, `--details` and `--photos` (accommodation only) merge into the body. |
| `mna options edit <tripId> <variantId> <destinationKey> <kind> <optionKey> [--from-json=<file>] [--free-cancellation-until=<date>] [--details=<json>] [--photos=<json>]` | Edit an option. For accommodation, each flag works alone, without a JSON file. `--details` changes only the properties it names; `--photos` replaces the list. |
| `mna options delete <tripId> <variantId> <destinationKey> <kind> <optionKey> [--yes]` | Delete an option. |
| `mna options select <tripId> <variantId> <destinationKey> <kind> <optionKey>` | Select an option. |
| `mna options deselect <tripId> <variantId> <destinationKey> <kind>` | Deselect the current option. |

### Events

| Command | Description |
|---|---|
| `mna events add <tripId> <variantId> --from-json=<file>` | Add an event. |
| `mna events edit <tripId> <variantId> <eventKey> --from-json=<file>` | Edit an event. |
| `mna events toggle <tripId> <variantId> <eventKey>` | Toggle the event's selected state. |
| `mna events delete <tripId> <variantId> <eventKey> [--yes]` | Delete an event. |

### Collaboration & voting

| Command | Description |
|---|---|
| `mna access list <tripId>` | List collaborators on a trip. |
| `mna access invite <tripId> --email=... --role=VIEW\|VOTER\|EDIT\|OWNER` | Invite a collaborator by email. |
| `mna access set-role <tripId> --user=<userId> --role=...` | Change a collaborator's role. |
| `mna access revoke <tripId> --user=<userId> [--yes]` | Remove a collaborator. |
| `mna access create-invite-link <tripId> --role=VIEW\|VOTER\|EDIT` | Generate an invite-link token. |
| `mna access list-invite-links <tripId>` | List active invite links. |
| `mna access revoke-invite-link <tripId> <tokenId> [--yes]` | Revoke an invite link. |
| `mna vote option <tripId> <variantId> <destinationKey> <kind> <optionKey> --value=up\|down\|clear` | Vote on an option. |
| `mna vote event <tripId> <variantId> <eventKey> --value=up\|down\|clear` | Vote on an event. |
| `mna votes list <tripId> <variantId>` | List votes for a variant. |

### Travel goals

| Command | Description |
|---|---|
| `mna goals list [--collection=<id>] [--status=visited\|dreaming\|planning]` | List goals. |
| `mna goals show <goalId>` | Show one goal. |
| `mna goals add --from-json=<file>` | Create a goal from JSON. |
| `mna goals quick-add --text="..."` | Quick-add a goal by name or URL. |
| `mna goals edit <goalId> --from-json=<file>` | Update a goal. |
| `mna goals delete <goalId> [--yes]` | Delete a goal. |
| `mna goals link-trip <goalId> <tripId>` | Link a goal to a trip. |
| `mna goals unlink-trip <goalId>` | Unlink a goal from its trip. |
| `mna goals mark-visited <goalId> [--date=<ISO>]` | Mark a goal as visited. |
| `mna goals mark-dreaming <goalId>` | Reset a goal to "dreaming". |

### Goal collections

| Command | Description |
|---|---|
| `mna collections list` | List your collections. |
| `mna collections show <collectionId>` | Show a collection with nested goals. |
| `mna collections create --name=<name> [--description=...] [--emoji=...] [--visibility=private\|shared\|public]` | Create a collection. |
| `mna collections edit <collectionId> --from-json=<file>` | Update a collection. |
| `mna collections delete <collectionId> [--yes]` | Delete a collection. |
| `mna collections add-goal <collectionId> <goalId>` | Add a goal to a collection. |
| `mna collections remove-goal <collectionId> <goalId>` | Remove a goal from a collection. |
| `mna collections share <collectionId>` | Generate a public share URL. |
| `mna collections open-shared <token>` | Open a publicly shared collection (no login required). |

## Status

All command groups (auth/keys/config, trips, variants, destinations, options, events, access, vote/votes, goals, collections) are wired, CI-tested, and backed by live `/v1/` endpoints in production. Pre-1.0 means the public API contract is still allowed to break under `/v1/`. Once `1.0.0` ships, `/v1/` becomes stable; breaking changes require `/v2/`.

The contract of record is `https://api.mynextadventure.cloud/v1/openapi.json`. If a write seems to "succeed" but a field doesn't stick, re-fetch with `mna trips show <id> --all-options --json` to confirm — and check the request body shape against the OpenAPI schema for that endpoint.

## Configuration

| Env var | Description |
|---|---|
| `MNA_API_KEY` | Override the key from the credentials file. Useful for CI. |
| `MNA_API_BASE_URL` | Override the API base URL. Useful for local dev. |
| `XDG_CONFIG_HOME` | Where the credentials and settings files are stored. Default: `~/.config`. |
| `CI=1` | Suppresses all interactive prompts, including the post-login skill offer. |
| `MNA_DEBUG=1` | Print error stack traces. |
| `NO_COLOR=1` | Disable ANSI colors. |

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md). MIT licensed.
