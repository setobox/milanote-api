import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiUrl,
  HISTORY_KEY,
  loadHistory,
  loadSaved,
  newTab,
  requestParameters,
  SAVED_KEY,
  validatedBody,
  type HistoryEntry,
  type HttpResult,
  type RequestTab,
  type SavedRequest,
} from "./model.ts";

export function useWorkbench(fetcher: typeof fetch = fetch) {
  const [tabs, setTabs] = useState<RequestTab[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState<string>();
  const [saved, setSaved] = useState(loadSaved);
  const [history, setHistory] = useState(loadHistory);
  const controllers = useRef(new Map<string, AbortController>());
  const replays = useRef(new Map<string, RequestTab>());
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const update = useCallback(
    (id: string, patch: Partial<RequestTab>) =>
      setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab))),
    [],
  );
  function open(tab: RequestTab): void {
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  }
  function cancel(id: string): void {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    update(id, { pending: false, error: "请求已取消" });
  }
  function close(id: string): void {
    if (tabs.length <= 1) return;
    const index = tabs.findIndex((tab) => tab.id === id);
    if (active?.id === id) setActiveId(tabs[index - 1]?.id ?? tabs[index + 1]?.id);
    cancel(id);
    setTabs((current) => {
      const rest = current.filter((tab) => tab.id !== id);
      return rest.length ? rest : [newTab()];
    });
  }
  async function send(tab: RequestTab, base: string, token: string): Promise<void> {
    let url: string;
    let body: string | undefined;
    try {
      url = apiUrl(base, tab.operation);
      body = tab.operation === "parse" ? validatedBody(tab.raw) : undefined;
      if (body) url += requestParameters(body);
    } catch (error) {
      update(tab.id, { error: error instanceof Error ? error.message : "请求配置无效。" });
      return;
    }
    controllers.current.get(tab.id)?.abort();
    const controller = new AbortController();
    controllers.current.set(tab.id, controller);
    const raw = body ? JSON.stringify(JSON.parse(body), null, 2) : tab.raw;
    update(tab.id, { pending: true, error: undefined, raw });
    const start = performance.now();
    const method = body ? "POST" : "GET";
    const current = () =>
      controllers.current.get(tab.id) === controller && !controller.signal.aborted;
    try {
      const response = await fetcher(url, {
        method,
        body,
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const text = await response.text();
      if (!current()) return;
      const result: HttpResult = {
        status: response.status,
        statusText: response.statusText,
        text,
        headers: Object.fromEntries(response.headers),
        elapsed: Math.round(performance.now() - start),
        bytes: new TextEncoder().encode(text).byteLength,
        request: { url, method, body },
      };
      update(tab.id, { result, pending: false });
      const id = crypto.randomUUID();
      replays.current.set(id, { ...tab, raw, result, pending: false, error: undefined });
      if (replays.current.size > 100) {
        const oldest = replays.current.keys().next().value;
        if (oldest) replays.current.delete(oldest);
      }
      const entry: HistoryEntry = {
        id,
        operation: tab.operation,
        status: result.status,
        elapsed: result.elapsed,
        at: new Date().toISOString(),
      };
      setHistory((old) => {
        const next = [entry, ...old].slice(0, 100);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          /* Session history remains usable. */
        }
        return next;
      });
    } catch {
      if (current())
        update(tab.id, { pending: false, error: "无法连接 API。检查服务地址、网络和跨域配置。" });
    } finally {
      if (controllers.current.get(tab.id) === controller) controllers.current.delete(tab.id);
    }
  }
  function save(tab: RequestTab, name: string, apiBase: string): boolean {
    const entry: SavedRequest = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 80) || tab.name,
      operation: tab.operation,
      raw: tab.raw,
      apiBase,
    };
    const next = [entry, ...saved].slice(0, 100);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next);
      return true;
    } catch {
      return false;
    }
  }
  function removeSaved(id: string): boolean {
    const next = saved.filter((entry) => entry.id !== id);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next);
      return true;
    } catch {
      return false;
    }
  }
  function clearHistory(): void {
    setHistory([]);
    replays.current.clear();
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* No persistent history is accessible. */
    }
  }
  function replay(id: string): string | undefined {
    const tab = replays.current.get(id);
    if (!tab?.result) return;
    open({ ...tab, id: crypto.randomUUID() });
    const url = new URL(tab.result.request.url);
    url.search = "";
    return url.toString().replace(/\/api\/(?:boards\/parse|capabilities|openapi\.json)$/, "");
  }
  useEffect(() => {
    const activeControllers = controllers.current;
    return () => {
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
    };
  }, []);
  return {
    tabs,
    active,
    saved,
    history,
    setActiveId,
    update,
    open,
    close,
    cancel,
    send,
    save,
    removeSaved,
    clearHistory,
    replay,
    canReplay: (id: string) => replays.current.has(id),
  };
}
