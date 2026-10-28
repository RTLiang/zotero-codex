# Images and message rendering

Users attach images, view rendered Markdown and LaTeX, and enlarge attached or generated images. Image generation is an explicit skill-driven conversation action.

## Sub-features

- `image-attach` accepts an image through the picker, paste or drag/drop and permits removal before sending.
- `image-enlarge` opens attached/generated images and closes with Escape, background click or the close button.
- `image-generate` prepares the `$imagegen` token from the + menu; sending a suitable request can invoke image generation.
- `message-render` displays Markdown, code, tables and mathematical notation in a real response.
- `math-output` requires Markdown LaTeX in model explanations: `$...$` inline and `$$...$$` on separate lines for display equations, including variable references. New, resumed and forked chats receive the same instruction; existing replies are not rewritten.
- `pdf-reference-jump` navigates explicit Markdown citations to figures, tables, equations, sections and physical pages. Current-PDF fragments target the attached paper; absolute source URLs matching another saved paper use that paper's PDF and its explicit locator. A `#page=N&quote=URI-encoded-original-text` target locates an exact passage in the current PDF. Plain-text locators and quotations remain text, including quotations beside a numbered section.
- `activity-display` toggles tool/file/reasoning activity details separately from final replies.

## How to get to it (user POV)

- Open the sidebar, click + → Add image, paste an image, or drag an image onto the composer.
- Click an image attachment or a completed message image.
- Click + → Generate image, or type `$imagegen` in the composer.
- Send a request for a formatted explanation. Open sidebar Settings to toggle Show activity details.
- In a paper chat with a PDF, click a figure, table, equation, section, physical page or explicit quoted passage reference in an assistant reply.

## Driving it with control.mjs and native app control

Preconditions:

- Doctor passes and Codex is open for a fixture paper. Use a disposable local PNG and keep it in this run's evidence directory.
- Actual responses and generated images require authenticated scratch Codex storage and the applicable enabled skill.

- Open the picker through `click '.zcs-add-button'` then `click '.zcs-image-option'`, each with `--run "$verify_run"`. Use native app control to choose the PNG in the OS dialog. Capture the action and `snapshot image-picker-result --run "$verify_run"`; expect `.zcs-image-attachment` with the correct name and preview.
- Repeat paste and drag/drop using native app control. Do not assign an image array or call the sidebar's file handler. Capture each input route and the resulting attachment. Click `.zcs-image-attachment .zcs-attachment-remove` and confirm removal before sending.
- Click the actual `.zcs-image-preview` or `.zcs-message-image` with `click '.zcs-image-preview'` or `click '.zcs-message-image'`, scoped to the intended image and with `--run "$verify_run"`. Capture `.zcs-image-dialog`; it is attached to the window document, so use the unprefixed `.zcs-image-dialog-close` selector for its close button. Use native app control for Escape, and test background dismissal in a separate opening. Keyboard Enter/Space on the preview is another accessibility entry.
- Choose `click '.zcs-add-button'` then `click '.zcs-generate-image-option'`. Expect `$imagegen ` in `.zcs-input`. Record that this proves prompt preparation only. For generation, send a small explicit image request, wait for a completed image, and verify both displayed pixels and the completed `imageGeneration` item in the stored session. The image result can be embedded base64, so a separate generated file is not required. Repeat direct `$imagegen` entry when changing invocation logic.
- For Markdown/LaTeX, use `fill '.zcs-input' 'Explain an invented example with a Markdown table, a fenced code block, an inline fraction, and a displayed two-by-two matrix. Use Markdown LaTeX dollar delimiters for math. Do not use tools.'`, then send normally. This prose prompt avoids shell backslash escaping and follows the current math-output contract. Capture the actual reply, rendered `table`, `pre` and `.katex` elements, and inspect the screenshot for missing glyphs or exposed delimiters. A nonconforming model answer is an unmet test input, not a renderer failure or pass.
- For the default math-output instruction, ask for an invented formula involving a fraction, subscripts and a sum, plus a separate equation with a root and explanations of the variables. Do not request LaTeX or delimiters in the prompt. Inspect the actual stored assistant text for inline `$...$` and display `$$...$$`, and the native reply for `.katex` and `.katex-display` elements. Reconnect the isolated runtime and send a follow-up to the same chat to cover resumed instructions. Use synthetic content only and verify context before sending. Capture actions, completed replies, stored text and screenshots; a prompt-contract unit test alone does not prove model compliance.
- Include a numbered item containing only inline formulas, for example `1. $r_i=\frac{x_i^2}{\sqrt{m}}$，$\alpha_i+\beta_j$`. Confirm it remains a list with two `.zcs-inline-math` spans and no `.katex-error`. Test separate sum, aligned and matrix equations as `.zcs-display-math`; inspect their full pixels and confirm long formulas stay within a local horizontal scroller without widening the transcript. Bare-LaTeX inference must not consume explicit inline delimiters in paragraphs, lists, headings or quotes.
- For PDF references, send a real turn about a fixture PDF that contains a numbered figure, table, equation, section and a distinct paragraph. Request explicit Markdown citations, click them in the assistant's actual reply, inspect the reader page and target, then reopen the chat and repeat. A figure or table reference should show the object itself, not merely its citation in prose or a search result; an equation should show the equation and a section should show its heading. A page target uses the physical PDF page, even when printed page labels differ. Include a plain section mention followed by a plain quotation and confirm neither gains a link. User messages, code and external Markdown links must not gain nested reference links. If the model omits a reference, do not fabricate one in the transcript as proof.
- With English plugin UI, ask for a Chinese explanation of the fixture PDF with a verified source citation. Inspect Chinese visible citation labels and unchanged target keys such as `#page=1`; click the reference and verify its physical page. Interface-language selection alone does not establish citation-label language.
- In a fixture PDF chat, request Markdown links to synthetic HTTPS pages that do not match any fixture item. Confirm they remain blue `.zcs-link` anchors with their original URLs, and click one to verify it opens externally. For a current-paper URL without a locator, a title label such as `paper` or `全文` renders as a page-one `.zcs-pdf-reference`; an ordinary label retains a `.zcs-link` anchor, but clicking a URL matching a saved paper still opens its local PDF or library item. Inspect the clicked destination as well as the anchor class and URL. Add a link matching a second synthetic saved PDF with `#page=5` and a `3.2.2 节` label; compare it with the current-document link and verify both show their requested headings. Repeat after reopening the chat; PDF references should still navigate within Zotero.
- Repeat a searchable reference with `click SELECTOR --capture reference-settled --capture-when .cursor/skills/verify-zotero-codex/scripts/pdf-reference-settled.js --run "$verify_run"`. This waits for both the temporary position highlight and Find paint to clear. Compare its annotation count to the baseline and inspect the screenshot. Test missing references and a valid click immediately afterward: the error must be recoverable and must not leave stale paint or a permanent message over the composer.
- Open `click '.zcs-more-button'`, toggle the checkbox identified by `[data-zcs-l10n-id="zotero-codex-show-work-process-control"]`, and capture the difference after a real turn containing activity. Reopen settings to confirm the preference. A text-only reply cannot prove hidden tool activity.

## Gotchas

- The helper does not automate OS file dialogs, clipboard image transfer or drag/drop. Record those routes as untested when native app control is unavailable.
- The plugin accepts GIF, JPEG, PNG and WebP, up to ten images and 20 MiB per image. Verify actual visible errors for boundary cases.
- The Generate image menu inserts a skill token; it does not itself generate an image.
- Preview conversations are simulated. They are useful for layout checks but cannot prove real generated-image protocol or native font loading.
- Image previews use data URLs. Keep private source images, auth and unrelated chats out of artifacts.
