(function (global) {
  "use strict";
  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};
  const RESOURCE = "zotero-codex.ftl";
  const CHOICES = new Set(["auto", "en-US", "zh-CN"]);
  const contexts = new WeakMap();
  let getPreference = () => "auto";

  function normalize(value) {
    return CHOICES.has(value) ? value : "auto";
  }

  function selected() {
    return normalize(getPreference("language"));
  }

  function effectiveLocale() {
    const value = selected();
    return value === "auto" ? (global.Services?.locale?.appLocaleAsBCP47 || "en-US") : value;
  }

  function context(doc) {
    const locale = selected();
    if (locale === "auto") return null;
    const saved = contexts.get(doc);
    if (saved?.locale === locale) return saved.l10n;
    const Constructor = global.Zotero?.getMainWindow?.()?.Localization || doc.defaultView?.Localization;
    const l10n = new Constructor([RESOURCE], true, undefined, [locale]);
    contexts.set(doc, { locale, l10n });
    return l10n;
  }

  function apply(element, suppliedID = "", suppliedArgs) {
    const id = suppliedID || element.getAttribute?.("data-zcs-l10n-id");
    if (!id) return;
    const argsText = suppliedID ? "" : element.getAttribute?.("data-zcs-l10n-args");
    const args = suppliedID ? suppliedArgs : argsText ? JSON.parse(argsText) : undefined;
    const l10n = element.ownerDocument && context(element.ownerDocument);
    if (!l10n) {
      element.ownerDocument?.l10n?.setAttributes?.(element, id, args);
      return;
    }
    element.removeAttribute("data-l10n-id");
    element.removeAttribute("data-l10n-args");
    const [message] = l10n.formatMessagesSync([{ id, args }]);
    if (!message) return;
    if (message.value !== null) element.textContent = message.value;
    for (const attribute of message.attributes || []) element.setAttribute(attribute.name, attribute.value);
  }

  function setAttributes(element, id, args = null) {
    if (!element || !id) return element;
    element.setAttribute("data-zcs-l10n-id", id);
    if (args) element.setAttribute("data-zcs-l10n-args", JSON.stringify(args));
    else element.removeAttribute("data-zcs-l10n-args");
    apply(element, id, args || undefined);
    return element;
  }

  function clearAttributes(element) {
    for (const name of ["data-zcs-l10n-id", "data-zcs-l10n-args", "data-l10n-id", "data-l10n-args"]) {
      element?.removeAttribute?.(name);
    }
    return element;
  }

  function refresh(root) {
    if (!root) return;
    if (root.matches?.("[data-zcs-l10n-id]")) apply(root);
    for (const element of root.querySelectorAll?.("[data-zcs-l10n-id]") || []) apply(element);
  }

  async function formatValue(doc, id, args, fallback) {
    try {
      const l10n = context(doc);
      return (l10n
        ? l10n.formatValueSync(id, args || undefined)
        : await doc?.l10n?.formatValue?.(id, args || undefined)) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  modules.Localization = {
    configure: (reader) => { getPreference = reader; },
    normalize, selected, effectiveLocale, setAttributes, clearAttributes, refresh, formatValue,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
