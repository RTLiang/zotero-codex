# Images and message rendering

Users attach images, view rendered Markdown and LaTeX, and enlarge attached or generated images. Image generation is an explicit skill-driven conversation action.

## Sub-features

- `image-attach` accepts an image through the picker, paste or drag/drop and permits removal before sending.
- `image-enlarge` opens attached/generated images and closes with Escape, background click or the close button.
- `image-generate` invokes image generation from the + menu or `$imagegen`.
- `message-render` displays Markdown, code, tables and mathematical notation in a real response.
- `pdf-reference-jump` links figure, table, equation and page references in assistant text to the current PDF. Quoted source passages of at least 20 characters open a PDF text search.
- `activity-display` toggles tool/file/reasoning activity details separately from final replies.

## How to get to it (user POV)

- Open the sidebar, click + → Add image, paste an image, or drag an image onto the composer.
- Click an image attachment or a completed message image.
- Click + → Generate image, or type `$imagegen` in the composer.
- Send a request for a formatted explanation. Open sidebar Settings to toggle Show activity details.
- In a paper chat with a PDF, click a figure, table, equation, page or quoted passage reference in an assistant reply.

## Driving it with control.mjs and native app control

Preconditions:

- Doctor passes and Codex is open for a fixture paper. Use a disposable local PNG and keep it in this run's evidence directory.
- Actual responses and generated images require authenticated scratch Codex storage and the applicable enabled skill.

- Open the picker through `click '.zcs-add-button'` then `click '.zcs-image-option'`, each with `--run "$verify_run"`. Use native app control to choose the PNG in the OS dialog. Capture the action and `snapshot image-picker-result --run "$verify_run"`; expect `.zcs-image-attachment` with the correct name and preview.
- Repeat paste and drag/drop using native app control. Do not assign an image array or call the sidebar's file handler. Capture each input route and the resulting attachment. Click `.zcs-image-attachment .zcs-attachment-remove` and confirm removal before sending.
- Click the actual `.zcs-image-preview` or `.zcs-message-image` with `click '.zcs-image-preview'` or `click '.zcs-message-image'`, scoped to the intended image and with `--run "$verify_run"`. Capture `.zcs-image-dialog`; test Escape, close-button `.zcs-image-dialog-close`, and background dismissal in separate openings. Keyboard Enter/Space on the preview is another accessibility entry.
- Choose `click '.zcs-add-button'` then `click '.zcs-generate-image-option'`. Expect `$imagegen ` in `.zcs-input`. Record that this proves prompt preparation only. For generation, send a small explicit image request, wait for a completed image, and verify both displayed pixels and the completed `imageGeneration` item in the stored session. The image result can be embedded base64, so a separate generated file is not required. Repeat direct `$imagegen` entry when changing invocation logic.
- For Markdown/LaTeX, use `fill '.zcs-input' 'Explain with a Markdown table, a fenced code block, and LaTeX \\[\\frac{a}{b}\\] and \\[\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\]. Do not use tools.'`, then send normally. Capture the actual reply, rendered `table`, `pre` and `.katex` elements, and inspect the screenshot for missing glyphs or exposed delimiters. A nonconforming model answer is an unmet test input, not a renderer failure or pass.
- For PDF references, send a real turn about a fixture PDF that contains a numbered figure, table, equation and a distinct paragraph. Click references in the assistant's actual reply, inspect the reader page and target, then reopen the chat and repeat. A figure or table reference should show the object itself, not merely its citation in prose or a search result; an equation should show the equation. A page reference should use the PDF page label if available. Check that user messages, code and external Markdown links do not gain nested reference links. If the model omits a reference, do not fabricate one in the transcript as proof.
- Open `click '.zcs-more-button'`, toggle the checkbox identified by `[data-zcs-l10n-id="zotero-codex-show-work-process-control"]`, and capture the difference after a real turn containing activity. Reopen settings to confirm the preference. A text-only reply cannot prove hidden tool activity.

## Gotchas

- The helper does not automate OS file dialogs, clipboard image transfer or drag/drop. Record those routes as untested when native app control is unavailable.
- The plugin accepts GIF, JPEG, PNG and WebP, up to ten images and 20 MiB per image. Verify actual visible errors for boundary cases.
- The Generate image menu inserts a skill token; it does not itself generate an image.
- Preview conversations are simulated. They are useful for layout checks but cannot prove real generated-image protocol or native font loading.
- Image previews use data URLs. Keep private source images, auth and unrelated chats out of artifacts.
