# tift-test-syntax

A minimal VS Code extension providing syntax highlighting for TIFT CLI test
scripts (see `cli/README.md#scripted--batch-mode`): the `$`/`>`/`---`/`@`/`#`/`!`
line-prefix format used by files like `examples/CloakOfDarkness/test_dev.txt`.

It's a plain TextMate grammar (`syntaxes/tift-test.tmLanguage.json`) associated
with the `.tift-test` file extension — no compiled code, nothing to build.

## Trying it out (Extension Development Host)

1. Open this folder (`tools/vscode-tift-test`) in VS Code as its own window/workspace.
2. Press <kbd>F5</kbd> (or Run and Debug → "Launch Extension"). This opens a new
   "Extension Development Host" window with the grammar active.
3. In that window, open (or rename a copy of) a test script to a `.tift-test`
   file, e.g. copy `examples/CloakOfDarkness/test_dev.txt` to `test_dev.tift-test`.

This only highlights files opened in that Extension Development Host window —
it doesn't persist to your normal VS Code.

## Installing it for normal use

VS Code has no built-in "auto-load this folder as an extension" mechanism for
regular (non-debugging) windows, so to have it active whenever you open this
repo normally, install it once per machine:

```
cd tools/vscode-tift-test
npx @vscode/vsce package
code --install-extension tift-test-syntax-0.1.0.vsix
```

(`vsce package` needs a `README.md` and a license field to run without
warnings — both are already present via this file and the repo's
`LICENSE.txt`.)

Alternatively, skip packaging entirely and just copy/symlink this folder into
your user extensions directory (`~/.vscode/extensions/tift-test-syntax`), then
reload VS Code.

## Once installed

Any `.tift-test` file is highlighted automatically. If your test scripts are
still named `.txt` (the rename hasn't happened yet — see `cli/README.md`),
you can preview the highlighting on an existing file without renaming it via
the Command Palette: "Change Language Mode" → "TIFT Test Script".
