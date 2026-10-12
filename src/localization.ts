type LocalizationChoice = "auto" | "en-US" | "zh-CN";

interface L10nMessage {
  value: string | null;
  attributes?: { name: string; value: string }[];
}

interface L10nInstance {
  formatMessagesSync(messages: { id: string; args?: Record<string, unknown> }[]): L10nMessage[];
  formatValueSync(id: string, args?: Record<string, unknown>): string | null;
}

type L10nConstructor = new (resources: string[], allowOverrides?: boolean, bundle?: unknown, locales?: string[]) => L10nInstance;

interface LocalizationCacheEntry {
  locale: LocalizationChoice;
  l10n: L10nInstance;
}

interface LocalizationRoot {
  matches?(selector: string): boolean;
  querySelectorAll?(selector: string): Iterable<Element>;
}

interface LocalizationModule {
  configure(getPreference: (name: string) => unknown): void;
  normalize(value: unknown): LocalizationChoice;
  selected(): LocalizationChoice;
  effectiveLocale(): string;
  setAttributes<T extends Element>(element: T | null, id: string | null, args?: Record<string, unknown> | null): T | null;
  clearAttributes<T extends Element>(element: T | null | undefined): T | null | undefined;
  refresh(root: LocalizationRoot | null | undefined): void;
  formatValue(doc: Document | null | undefined, id: string, args?: Record<string, unknown>, fallback?: string): Promise<string | undefined>;
}

(function (global) {
  "use strict";
  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};
  const RESOURCE = "zotero-codex.ftl";
  const CHOICES = new Set<LocalizationChoice>(["auto", "en-US", "zh-CN"]);
  const contexts = new WeakMap<Document, LocalizationCacheEntry>();
  let getPreference: (name: string) => unknown = () => "auto";

  function normalize(value: unknown): LocalizationChoice {
    return CHOICES.has(value as LocalizationChoice) ? value as LocalizationChoice : "auto";
  }

  function selected(): LocalizationChoice {
    return normalize(getPreference("language"));
  }

  function effectiveLocale(): string {
    const value = selected();
    return value === "auto" ? (global.Services?.locale?.appLocaleAsBCP47 || "en-US") : value;
  }

  function context(doc: Document): L10nInstance | null {
    const locale = selected();
    if (locale === "auto") return null;
    const saved = contexts.get(doc);
    if (saved?.locale === locale) return saved.l10n;
    const Constructor = global.Zotero?.getMainWindow?.()?.Localization || doc.defaultView?.Localization;
    const l10n = new Constructor!([RESOURCE], true, undefined, [locale]);
    contexts.set(doc, { locale, l10n });
    return l10n;
  }

  function apply(element: Element, suppliedID = "", suppliedArgs?: Record<string, unknown>): void {
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

  function setAttributes<T extends Element>(element: T | null, id: string | null, args: Record<string, unknown> | null = null): T | null {
    if (!element || !id) return element;
    element.setAttribute("data-zcs-l10n-id", id);
    if (args) element.setAttribute("data-zcs-l10n-args", JSON.stringify(args));
    else element.removeAttribute("data-zcs-l10n-args");
    apply(element, id, args || undefined);
    return element;
  }

  function clearAttributes<T extends Element>(element: T | null | undefined): T | null | undefined {
    for (const name of ["data-zcs-l10n-id", "data-zcs-l10n-args", "data-l10n-id", "data-l10n-args"]) {
      element?.removeAttribute?.(name);
    }
    return element;
  }

  function refresh(root: LocalizationRoot | null | undefined): void {
    if (!root) return;
    if (root.matches?.("[data-zcs-l10n-id]")) apply(root as Element);
    for (const element of root.querySelectorAll?.("[data-zcs-l10n-id]") || []) apply(element);
  }

  async function formatValue(doc: Document | null | undefined, id: string, args?: Record<string, unknown>, fallback?: string): Promise<string | undefined> {
    try {
      const l10n = context(doc as Document);
      return (l10n
        ? l10n.formatValueSync(id, args || undefined)
        : await doc?.l10n?.formatValue?.(id, args || undefined)) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  modules.Localization = {
    configure: (reader: (name: string) => unknown) => { getPreference = reader; },
    normalize, selected, effectiveLocale, setAttributes, clearAttributes, refresh, formatValue,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
