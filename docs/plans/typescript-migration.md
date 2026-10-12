# TypeScript migration

Goal: move the plugin runtime from hand-written JavaScript to TypeScript sources that compile
to the same shipped JavaScript, with the behavior contract pinned and checked.

Definition of done: every file in the `bootstrap.js` script list has a `.ts` source under `src/`,
`npm run check` type-checks those sources under `strict`, the emitted `content/*.js` are token
equivalent to the pre-migration files, the existing test suite passes against the emitted files,
and the plugin installs and runs in Zotero 10 from the packaged build.

Non-goals: no new plugin behavior, no module-system change, no bundler, no redesign of the
sidebar, no change to `manifest.json`, `bootstrap.js`, `prefs.js`, or the XPI layout.

## Decisions

**Sources live in `src/*.ts` and compile to `content/*.js`.** The shipped paths stay what
`bootstrap.js` lists, so the loader order and the XPI layout do not change. Emitted files are
build output and stay out of git.

**`tsc` is the only compiler.** No bundler, no loaders. Plugins in this ecosystem that use
esbuild bundle every module into one file, which would replace the
`globalThis.ZoteroCodexModules` registry, the per-file `loadSubScript` contract, and the test
entry points. That is a bigger change than this migration, so it waits for its own reason.

**Each source file stays a script, not a module.** The file keeps its IIFE, writes its slot in
`globalThis.ZoteroCodexModules`, and keeps the `module.exports` shim that the Node tests require.
Because the files are scripts, their types share one global scope and cross-module references
need no imports.

**Type checking is strict from the first file.** Files migrate one at a time, so each file is
converted exactly once. A `strict: false` first pass would convert everything twice.

**The behavior pin is token equivalence.** `scripts/check-emit-equivalence.mjs` parses both the
pre-migration file (from a git ref) and the emitted file with the TypeScript parser, prints both
through the same printer, and compares the text. Equal output means the emitted file has the same
tokens in the same order, so the only differences are formatting and comments, which JavaScript
semantics do not see. The 63 existing tests then run against the emitted files, and the native
Zotero proof runs against the packaged build.

Evidence: `content/runtime-settings.js` converted to `src/runtime-settings.ts` and compiled with
`strict: true` prints to the same tokens as the original, and `tests/runtime-settings.test.cjs`
passes against the emitted file. The same check on the four large files compiled without
annotations reported token equivalence, so the emit path itself is not a risk.

**Two compiler settings carry the pin.** `alwaysStrict: false` stops `tsc` from adding a
file-level `"use strict"`. `useDefineForClassFields: false` stops a class field declaration from
emitting an initializer that would define the property at construction time. The gate catches both.

**Host APIs are declared by hand in `src/globals.d.ts`.** The plugin touches about 20 Zotero and
Firefox globals. A hand-written declaration file shows the exact host surface the plugin uses and
grows only when a migrated file calls a new API.

**The verification helper fingerprints tracked sources.** `fingerprint()` in
`.cursor/skills/verify-zotero-codex/scripts/control.mjs` hashed every file under `content/`, which
now includes build output that exists only after a build. It hashes tracked files instead, so a
fresh clone and a built tree fingerprint the same.

## Units

Each unit is one commit that ends green: `npm run check`, `npm test`, and, for a unit that
touches a native path, the Zotero proof.

1. Build pipeline, plus `runtime-settings.ts` as the first migrated file. Adds `typescript`,
   `tsconfig.json`, the compiler entry point, the equivalence gate, and the CI install step.
2. `protocol.ts`. Pure data transforms, no host APIs, and the largest test file.
3. `localization.ts` and `preferences.ts`. Small files that share the localization contract.
4. `codex-client.ts`. Types the app-server JSON-RPC boundary, which is where typed parsing pays.
5. `markdown.ts`. Pure transforms plus the `katex` host global.
6. `sidebar.ts`. The 4540-line view layer, migrated last, verified by six sidebar test files.
7. `main.ts`. Declares the `ZoteroCodexPlugin` global that `bootstrap.js` calls.
8. Cleanup. Delete the equivalence gate once no file is left to check, and update the docs.

## Verification contract per unit

Commands: `npm run check` (type check, static checks, equivalence gate), `npm test` (compiles,
then runs the suite against the emitted files), `npm run build` (compiles, packages the XPI).

Native path per the repository rule: `control.mjs launch` and `prove` in an isolated Zotero 10
profile, run for the units that change the packaged build and once more at the end. Evidence lands
in `output/verification/<run>/`.

Skips: the `how` skill was skipped because the contract is machine-pinned by the gate and the
suite, not by prose. The `deslop` and `no-comments` skills are not installed in this environment.
