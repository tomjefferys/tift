# tift-cli

A terminal front-end for TIFT games. It implements the same word-by-word
"pseudo-parser" as the touchscreen web app — instead of typing free-text
commands, you build a command by typing/selecting one word at a time from
the choices the engine offers — but for a terminal, and it also doubles as
the runner for scripted game tests (see `make examples-test`).

## Building

From the repo root:
```
make cli
```
This produces `cli/out/main.mjs` (an ESM bundle built with esbuild).

> Note: `package.json`'s `bin`/`main` fields point at `out/main.js`, but the
> build actually outputs `out/main.mjs`. Run the CLI directly with
> `node out/main.mjs ...` (as the examples below, and the Makefile, do)
> rather than relying on the `bin` entry.

## Usage

```
node out/main.mjs [options] <data-file.yaml> [<data-file2.yaml> ...]
```

Data files are loaded in order and merged into one game — typically the
standard library, the default message properties, and the game itself, e.g.:

```
node out/main.mjs stdlib.yaml properties.yaml adventure.yaml
```

### Options

| Flag | Short | Description |
|---|---|---|
| `--silent` | `-s` | Suppress normal output (used for quiet batch/test runs; failures are still reported on stderr). |
| `--saveFile <path>` | `-f` | Persist game state to a JSON file, loaded on startup if it exists and updated as you play. Without this, state is in-memory only and lost when the process exits. |
| `--dev` | `-d` | Start with [developer mode](#developer-commands) already enabled. |

## Interactive mode

When stdin is a TTY, the CLI runs interactively:

- Type letters to filter the current word choices by prefix (`x` is a
  built-in shorthand for `examine`).
- <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> cycle the highlighted choice forward/backward.
- <kbd>Enter</kbd> selects the highlighted choice — or, if what you've typed so
  far matches exactly one word, selects that word directly without needing
  to tab to it.
- <kbd>Backspace</kbd> deletes the last typed character; with nothing typed, it
  removes the last word already added to the in-progress command.
- <kbd>Ctrl+C</kbd> quits immediately.
- <kbd>Ctrl+L</kbd> opens the [control menu](#control-menu-ctrll); press it again
  (or run a menu command) to return to the game.
- <kbd>Ctrl+D</kbd> is a shortcut that toggles [developer mode](#developer-commands)
  without leaving the game input.

Once you've built a full command (a verb plus whatever objects/prepositions
it needs) — i.e. there are no further words to add — it's sent to the engine
and the response is printed above the input line.

Any of the loaded data files being edited and saved while the CLI is running
triggers an automatic live reload of the game.

### Control menu (Ctrl+L)

- **quit** — exit the CLI.
- **restart** — delete any saved state and restart the game from the
  beginning.
- **clear** — clear the terminal screen.
- **developer** — toggle [developer mode](#developer-commands) on/off.

Note that `restart` (and the live-reload trigger) rebuild the game from
scratch, which resets developer mode back to whatever `--dev` was set to at
startup, not to whatever you'd toggled it to just before restarting.

## Developer commands

The engine exposes a small set of developer/debugging commands for jumping
straight to a particular game state without having to play through normally
(see `engine/src/debug.ts`):

| Command | Effect |
|---|---|
| `teleport <room>` | Move the player to any room, by id. |
| `get <item>` | Move any item straight into the player's inventory, regardless of where it currently is. |
| `drop <item>` | Move any item from the player's inventory to the player's current location. |
| `list <type>` | List all entities of a type: `rooms`, `items`, `objects`, `verbs`, `specials`, or `contexts`. |
| `inspect <type> <id>` | Dump the raw properties of a specific entity, e.g. `inspect room bar`. |

These commands are always available from the engine (they're disabled only
when `NODE_ENV=test`, e.g. under the test suites). The CLI surfaces them two
ways:

- **Interactively**, once developer mode is enabled (`--dev`/`-d` at
  startup, or toggled via the control menu / <kbd>Ctrl+D</kbd>), the word
  choices switch to show only developer commands, and a `[DEV]` marker
  appears before the input line. Building and submitting a developer
  command works exactly like a normal command.
- **In scripts**, via the `>` line prefix — see below.

## Scripted / batch mode

When stdin is *not* a TTY (e.g. piped input — this is how `make
examples-test` drives the CLI), it reads a script from stdin line by line
instead, printing output as it goes and exiting with a non-zero status if
any expectation fails.

Script line types:

- `$ <command words>` — run a game command, e.g. `$ go north` or
  `$ take brass key`. Multi-word object names (e.g. "velvet cloak") are
  matched automatically by trying successively longer word combinations.
- `> <command words>` — run a [developer command](#developer-commands), e.g.
  `> teleport bar` or `> get lamp`. Matched only against developer/debug
  words, so it reaches the developer version of a word even when a normal
  in-game verb of the same name exists (e.g. `get`/`drop`).
- `# ...` — a comment; ignored.
- `! <text>` — a negative assertion: fails the script if `<text>` appears
  anywhere in the output produced since the last command.
- any other non-blank line — a positive assertion: fails the script if the
  text does *not* appear in the output produced since the last command.

On failure, the runner reports the line number, the output collected since
the last command, and the expectation that failed, then continues with the
rest of the script; if any line failed, the whole run exits with a
non-zero status.

Example (adapted from `examples/CloakOfDarkness/test.txt`, which exercises
normal gameplay):

```
Foyer of the Opera House

$ look

$ inventory
velvet cloak
```

Developer commands are typically kept in a separate script, since they set
up scenarios that wouldn't come up during normal play — see
`examples/CloakOfDarkness/test_dev.txt`, run via the `examples-test` make
target alongside `test.txt`:

```
Foyer of the Opera House

> teleport bar
Player teleported to location bar.

> get hook
$ inventory
small brass hook
```

## Save files

Pass `-f <path>` to persist state to disk between runs — it's loaded
automatically at startup if the file exists, and rewritten as the game
progresses. Without `-f`, state exists only in memory for the life of the
process (e.g. plain `node out/main.mjs adventure.yaml` always starts fresh).

## Testing

```
npx vitest --run
```
or, from the repo root: `make cli-test`.

## Linting

```
npm run lint
```
or, from the repo root: `make cli-lint`.
