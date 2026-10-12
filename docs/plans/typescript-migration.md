# TypeScript migration

Goal: move the plugin runtime from hand-written JavaScript to TypeScript sources that compile
to the same shipped JavaScript, with the behavior contract pinned and checked.

Done means every file in the `bootstrap.js` script list has a `.ts` source under `src/`,
`npm run check` type-checks those sources under `strict`, the emitted `content/*.js` keep the
tokens of the files they replace, the test suite passes against the emitted files, and the plugin
runs in Zotero 10 from the packaged build.

Non-goals: no new plugin behavior, no module-system change, no bundler, no sidebar redesign, and
no change to `manifest.json`, `bootstrap.js`, `prefs.js`, or the XPI layout.

## Decisions

Sources live in `src/*.ts` and compile to `content/*.js`, the paths `bootstrap.js` already lists,
so the loader order and the XPI layout stay as they are. Emitted files are build output and stay
out of git.

`tsc` is the only compiler. Bundling every module into one file would replace the
`globalThis.ZoteroCodexModules` registry, the per-file `loadSubScript` contract, and the test
entry points, which is a larger change than this migration.

Each source file stays a script that keeps its IIFE, writes its own registry slot, and keeps the
`module.exports` shim the Node tests require. Scripts share one global type scope, so they need no
imports.

Type checking is strict from the first file. Files migrate one at a time, so each one is converted
once.

The behavior pin is token equivalence. `scripts/check-emit-equivalence.mjs` parses the
pre-migration file from a git ref and the emitted file with the TypeScript parser, prints both
through one printer, and compares the text. Only formatting and comments can differ, and
JavaScript semantics do not see those. `alwaysStrict: false` and `useDefineForClassFields: false`
keep the emit free of added tokens, and the gate catches a regression in either setting.

Host APIs are declared in `src/globals.d.ts`. The plugin calls about 20 Zotero and Firefox
globals, so the declarations grow only when a migrated file calls a new one. `src/modules.d.ts`
holds the registry type and shrinks as migrated modules declare their own interfaces.

`fingerprint()` in `.cursor/skills/verify-zotero-codex/scripts/control.mjs` hashes tracked files
rather than everything under `content/`, which now holds build output. A fresh clone and a built
tree then fingerprint the same.

## Units

Each unit is one commit and ends green.

1. Build pipeline, with `runtime-settings.ts` as the first file. Adds `typescript`,
   `tsconfig.json`, the compiler entry point, the equivalence gate, and the CI install step.
2. `protocol.ts`. Pure data transforms with the largest test file.
3. `localization.ts` and `preferences.ts`.
4. `codex-client.ts`. Types the app-server JSON-RPC boundary.
5. `markdown.ts`.
6. `sidebar.ts`, verified by the six sidebar test files.
7. `main.ts`, which declares the `ZoteroCodexPlugin` global that `bootstrap.js` calls.
8. Cleanup. Delete the equivalence gate, which has nothing left to check, and update the docs.

## Checks

`npm run check` compiles the sources, type-checks them, runs the static checks, then runs the
gate. `npm test` compiles and runs the suite against the emitted files. `npm run build` compiles
and packages the XPI.

The gate reads the pre-migration file from commit `308f160`, so it needs the full git history. CI
checks out with `fetch-depth: 0` for that reason.

A unit that changes the packaged build is verified in an isolated Zotero 10 profile with
`.cursor/skills/verify-zotero-codex/scripts/control.mjs launch` and `prove`, with evidence under
`output/verification/<run>/`.
