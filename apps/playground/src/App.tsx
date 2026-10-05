import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Braces,
  ChevronDown,
  Code2,
  FlaskConical,
  History,
  LayoutGrid,
  Moon,
  Plus,
  Search,
  Send,
  Settings2,
  Square,
  Star,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { requestPresets } from "@milanote-api/api/contracts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog.tsx";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll.tsx";
import { useAppearance } from "@/hooks/useAppearance.ts";
import {
  apiUrl,
  newTab,
  operationNames,
  paths,
  requestParameters,
  validatedBody,
} from "@/features/workbench/model.ts";
import { JsonEditor } from "@/features/workbench/JsonEditor.tsx";
import { RequestFields } from "@/features/workbench/RequestFields.tsx";
import { ResponsePanel } from "@/features/workbench/ResponsePanel.tsx";
import { CodePopover } from "@/features/workbench/CodePopover.tsx";
import { useWorkbench } from "@/features/workbench/useWorkbench.ts";

interface AppProps {
  apiOrigin?: string;
  fetcher?: typeof fetch;
}
export function App({ apiOrigin, fetcher }: AppProps) {
  const work = useWorkbench(fetcher);
  const { appearance, toggleAppearance } = useAppearance();
  const [apiBase, setApiBase] = useState(
    apiOrigin ?? import.meta.env.VITE_API_BASE_URL ?? window.location.origin,
  );
  const [token, setToken] = useState("");
  const [page, setPage] = useState(window.location.hash === "#settings" ? "settings" : "workbench");
  const [section, setSection] = useState("history");
  const [editorMode, setEditorMode] = useState("form");
  const [dialog, setDialog] = useState<"search" | "save" | undefined>();
  const [query, setQuery] = useState("");
  const [saveName, setSaveName] = useState("");
  const [message, setMessage] = useState("");
  const [mobilePanel, setMobilePanel] = useState("request");
  const [editorWidth, setEditorWidth] = useState<number>();
  const tab = work.active;
  const history = work.history.filter((entry) => entry.operation === "parse");
  const saved = work.saved.filter((entry) => entry.operation === "parse");
  const docsBase = import.meta.env.BASE_URL;
  function navigate(next: string): void {
    window.history.pushState(null, "", next === "settings" ? "#settings" : "#");
    setPage(next);
  }
  useEffect(() => {
    const change = () => setPage(window.location.hash === "#settings" ? "settings" : "workbench");
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    return () => {
      window.removeEventListener("popstate", change);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  function openPreset(preset: (typeof requestPresets)[number]): void {
    work.open(newTab(preset));
    setMobilePanel("request");
    navigate("workbench");
    setDialog(undefined);
  }
  function send(): void {
    if (!tab) return;
    void work.send(tab, apiBase, token);
    try {
      apiUrl(apiBase, tab.operation);
      if (tab.operation === "parse") validatedBody(tab.raw);
      setMobilePanel("response");
    } catch {
      setMobilePanel("request");
    }
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDialog("search");
      }
      if (event.key === "Enter" && !dialog && page === "workbench") {
        event.preventDefault();
        send();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
  if (!tab) return null;
  const requestPath =
    paths[tab.operation] + (tab.operation === "parse" ? requestParameters(tab.raw) : "");
  const codeProps = { tab, apiBase, authenticated: Boolean(token), notify: setMessage };
  return (
    <div className="workbench" data-mobile-panel={mobilePanel} data-page={page}>
      <aside className="app-sidebar">
        <a className="brand-mark" href={`${docsBase}docs/`}>
          <LayoutGrid size={22} />
          <strong>Milanote API</strong>
        </a>
        <nav className="app-nav" aria-label="主导航">
          <button
            className={page === "workbench" ? "rail-active" : ""}
            onClick={() => {
              navigate("workbench");
              setMobilePanel("request");
            }}
          >
            <FlaskConical size={18} />
            <span>调试台</span>
          </button>
          <a href={`${docsBase}guide/getting-started.html`}>
            <BookOpen size={18} />
            <span>文档</span>
            <ArrowUpRight size={13} />
          </a>
          <button
            className={page === "settings" ? "rail-active" : ""}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={18} />
            <span>设置</span>
          </button>
        </nav>
        <div className="sidebar-records">
          <div className="sidebar-switch" aria-label="请求导航">
            <button
              className={section === "history" ? "selected" : ""}
              onClick={() => setSection("history")}
            >
              <History size={15} />
              历史
            </button>
            <button
              className={section === "saved" ? "selected" : ""}
              onClick={() => setSection("saved")}
            >
              <Star size={15} />
              收藏
            </button>
            {section === "history" && (
              <button
                className="clear-history"
                title="清空历史"
                aria-label="清空历史"
                onClick={work.clearHistory}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <div className="sidebar-content">
            {section === "saved" ? (
              <>
                {!saved.length && (
                  <p className="sidebar-hint">还没有收藏。可在请求区保存当前配置。</p>
                )}
                {saved.map((entry) => (
                  <div className="saved-item" key={entry.id}>
                    <button
                      onClick={() => {
                        work.open({ ...entry, id: crypto.randomUUID(), pending: false });
                        setApiBase(entry.apiBase);
                        setToken("");
                        setMobilePanel("request");
                        navigate("workbench");
                      }}
                    >
                      <Star size={13} />
                      {entry.name}
                    </button>
                    <button
                      aria-label={`删除 ${entry.name}`}
                      onClick={() => {
                        if (!work.removeSaved(entry.id)) setMessage("无法删除本地收藏。");
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
                {!history.length && (
                  <div className="history-empty">
                    <History size={24} />
                    <p>还没有请求记录</p>
                    <span>发送请求后，记录会显示在这里。</span>
                  </div>
                )}
                {history.map((entry) => (
                  <button
                    className="history-item"
                    key={entry.id}
                    disabled={!work.canReplay(entry.id)}
                    onClick={() => {
                      const base = work.replay(entry.id);
                      if (base) {
                        setApiBase(base);
                        setToken("");
                      }
                      setMobilePanel("request");
                      navigate("workbench");
                    }}
                  >
                    <span className={entry.status < 400 ? "success" : "danger"}>
                      {entry.status}
                    </span>
                    <span>
                      {operationNames[entry.operation]}
                      <small>
                        {new Date(entry.at).toLocaleTimeString()} · {entry.elapsed} ms
                      </small>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="sidebar-bottom">
          <a href={`${docsBase}guide/deployment.html`}>
            <BookOpen size={15} />
            <span>部署指南</span>
            <ArrowUpRight size={13} />
          </a>
          <button title="切换主题" aria-label="切换主题" onClick={toggleAppearance}>
            {appearance === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </aside>
      <div className="workbench-main">
        <header className="app-header">
          <h1>{page === "settings" ? "设置" : "调试台"}</h1>
          <button className="search-trigger" aria-label="搜索" onClick={() => setDialog("search")}>
            <Search size={15} />
            <span>搜索</span>
            <kbd>Ctrl K</kbd>
          </button>
        </header>
        <div className="workbench-view" hidden={page !== "workbench"}>
          <div className="mobile-navigation">
            <button
              onClick={() => setMobilePanel("sidebar")}
              aria-pressed={mobilePanel === "sidebar"}
            >
              历史 / 收藏
            </button>
            <button
              onClick={() => setMobilePanel("request")}
              aria-pressed={mobilePanel === "request"}
            >
              请求
            </button>
            <button
              onClick={() => setMobilePanel("response")}
              aria-pressed={mobilePanel === "response"}
            >
              响应
            </button>
          </div>
          <div className="request-tabs-shell">
            <HorizontalScroll>
              <div className="request-tab-bar" role="tablist" aria-label="打开的请求">
                {work.tabs.map((item) => (
                  <div
                    className={`request-tab ${item.id === tab.id ? "active" : ""}`}
                    key={item.id}
                    onMouseDown={(event) => {
                      if (event.button === 1) event.preventDefault();
                    }}
                    onAuxClick={(event) => {
                      if (event.button === 1) {
                        event.preventDefault();
                        if (work.tabs.length > 1) work.close(item.id);
                      }
                    }}
                  >
                    <button
                      role="tab"
                      aria-selected={item.id === tab.id}
                      onClick={() => work.setActiveId(item.id)}
                    >
                      <span className="method-text">
                        {item.operation === "parse" ? "POST" : "GET"}
                      </span>
                      {item.name}
                      {item.pending && <span className="status-dot" />}
                    </button>
                    {work.tabs.length > 1 && (
                      <button
                        title="关闭请求"
                        aria-label={`关闭 ${item.name}`}
                        onClick={() => work.close(item.id)}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="add-tab"
                  title="新建请求"
                  aria-label="新建请求"
                  onClick={() => {
                    work.open(newTab());
                    setMobilePanel("request");
                  }}
                >
                  <Plus size={17} />
                </button>
              </div>
            </HorizontalScroll>
          </div>
          <div
            className="workspace"
            style={
              editorWidth ? ({ "--editor-width": `${editorWidth}px` } as CSSProperties) : undefined
            }
          >
            <main className="request-panel">
              <div className="panel-heading">
                <span>
                  <Braces size={15} />
                  请求
                </span>
                <div className="inline-actions">
                  <button
                    title="保存请求"
                    aria-label="保存请求"
                    onClick={() => {
                      setSaveName(tab.name);
                      setDialog("save");
                    }}
                  >
                    <Star size={16} />
                  </button>
                  <CodePopover key={tab.id} {...codeProps}>
                    <button title="生成请求代码" aria-label="生成请求代码">
                      <Code2 size={17} />
                    </button>
                  </CodePopover>
                </div>
              </div>
              <div className="request-url">
                <span className="http-method">{tab.operation === "parse" ? "POST" : "GET"}</span>
                <code title={requestPath} aria-label="API 请求地址">
                  {requestPath}
                </code>
                {tab.pending ? (
                  <button className="send-button" onClick={() => work.cancel(tab.id)}>
                    <Square size={13} />
                    取消
                  </button>
                ) : (
                  <button className="send-button" onClick={send}>
                    <Send size={14} />
                    发送
                  </button>
                )}
              </div>
              <div className="panel-tabs" role="tablist" aria-label="请求编辑方式">
                {[
                  ["form", "参数"],
                  ["json", "JSON"],
                  ["headers", "请求头"],
                ].map(([id, name]) => (
                  <button
                    role="tab"
                    key={id}
                    aria-selected={editorMode === id}
                    onClick={() => setEditorMode(id ?? "form")}
                  >
                    {name}
                    {id === "headers" && <span className="tab-count">{token ? 3 : 2}</span>}
                  </button>
                ))}
              </div>
              {tab.error && (
                <div className="error-banner" role="alert">
                  {tab.error}
                </div>
              )}
              {editorMode === "json" && tab.operation === "parse" ? (
                <JsonEditor
                  key={tab.id}
                  value={tab.raw}
                  dark={appearance === "dark"}
                  onChange={(raw) => work.update(tab.id, { raw, error: undefined })}
                />
              ) : editorMode === "headers" ? (
                <div className="panel-scroll">
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <th>Accept</th>
                        <td>application/json</td>
                      </tr>
                      {tab.operation === "parse" && (
                        <tr>
                          <th>Content-Type</th>
                          <td>application/json</td>
                        </tr>
                      )}
                      {token && (
                        <tr>
                          <th>Authorization</th>
                          <td>Bearer ••••••••</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <p className="form-note">Bearer Token 可在设置页填写，仅保留在当前会话。</p>
                </div>
              ) : tab.operation !== "parse" ? (
                <p className="form-note">此请求不需要参数。</p>
              ) : (
                <RequestFields
                  key={tab.id}
                  raw={tab.raw}
                  onChange={(raw) => work.update(tab.id, { raw, error: undefined })}
                />
              )}
            </main>
            <div
              className="panel-resizer"
              role="separator"
              aria-label="调整请求区宽度"
              aria-orientation="vertical"
              aria-valuemin={320}
              aria-valuemax={1000}
              aria-valuenow={editorWidth ?? 500}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setEditorWidth(
                    Math.max(
                      320,
                      Math.min(1000, (editorWidth ?? 500) + (event.key === "ArrowLeft" ? -20 : 20)),
                    ),
                  );
                }
              }}
              onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
              onPointerMove={(event) => {
                if (event.buttons === 1) {
                  const left =
                    event.currentTarget.previousElementSibling?.getBoundingClientRect().left ?? 0;
                  setEditorWidth(Math.max(320, Math.min(1000, event.clientX - left)));
                }
              }}
            />
            <section className="response-panel" aria-label="响应面板">
              <ResponsePanel
                key={tab.id}
                tab={tab}
                dark={appearance === "dark"}
                notify={setMessage}
              />
            </section>
          </div>
        </div>
        <main className="settings-page" hidden={page !== "settings"}>
          <div className="settings-intro">
            <Settings2 size={22} />
            <h2>连接与外观</h2>
            <p>配置请求使用的 API 地址和访问凭据。</p>
          </div>
          <section className="settings-section">
            <h3>API 连接</h3>
            <label className="field-label" htmlFor="api-base">
              API 服务地址
            </label>
            <input
              id="api-base"
              type="url"
              value={apiBase}
              onChange={(event) => {
                setApiBase(event.target.value);
                setToken("");
              }}
            />
            <p className="field-help">修改后立即用于下次请求。更换地址会清空 Token。</p>
            <label className="field-label" htmlFor="api-token">
              Bearer Token（可选）
            </label>
            <input
              id="api-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <p className="field-help">凭据仅保留在当前会话，不写入浏览器存储或导出的代码。</p>
          </section>
          <section className="settings-section settings-appearance">
            <div>
              <h3>外观</h3>
              <p>当前使用{appearance === "dark" ? "深色" : "浅色"}主题</p>
            </div>
            <button onClick={toggleAppearance}>
              {appearance === "dark" ? <Sun size={16} /> : <Moon size={16} />}切换为
              {appearance === "dark" ? "浅色" : "深色"}
            </button>
          </section>
          <button className="send-button" onClick={() => navigate("workbench")}>
            返回调试台
          </button>
        </main>
        <footer className="status-bar">
          <button
            className="environment-button"
            aria-label="设置 API 地址"
            onClick={() => navigate("settings")}
          >
            <span className="environment-host" title={apiBase}>
              {apiBase.replace(/^https?:\/\//, "") || "设置 API 地址"}
            </span>
            <ChevronDown size={12} />
          </button>
          <span role="status">{message}</span>
          <span>{work.tabs.length} 个请求</span>
        </footer>
      </div>
      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(undefined);
        }}
      >
        <DialogContent>
          <DialogTitle>{dialog === "search" ? "搜索" : "保存请求配置"}</DialogTitle>
          <DialogDescription>
            {dialog === "save"
              ? "仅保存配置到此浏览器。分享链接包含权限参数，响应不会保存。"
              : "选择快捷模式或已保存的配置。"}
          </DialogDescription>
          {dialog === "save" && (
            <>
              <label className="field-label" htmlFor="save-name">
                名称
              </label>
              <input
                id="save-name"
                value={saveName}
                maxLength={80}
                onChange={(event) => setSaveName(event.target.value)}
              />
              <button
                className="send-button"
                onClick={() => {
                  if (work.save(tab, saveName, apiBase)) {
                    setDialog(undefined);
                    setSection("saved");
                    setMessage("请求配置已保存到本地");
                  } else setMessage("保存失败，浏览器可能禁止本地存储。");
                }}
              >
                保存到本地
              </button>
            </>
          )}
          {dialog === "search" && (
            <>
              <input
                aria-label="搜索关键词"
                placeholder="搜索预设、收藏…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="command-results">
                {requestPresets
                  .filter((preset) => `${preset.name}${preset.description}`.includes(query))
                  .map((preset) => (
                    <button key={preset.id} onClick={() => openPreset(preset)}>
                      <span className="method-text">POST</span>
                      {preset.name}
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                {saved
                  .filter((entry) => entry.name.includes(query))
                  .map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        work.open({ ...entry, id: crypto.randomUUID(), pending: false });
                        setApiBase(entry.apiBase);
                        setToken("");
                        setDialog(undefined);
                        setMobilePanel("request");
                        navigate("workbench");
                      }}
                    >
                      <Star size={14} />
                      {entry.name}
                    </button>
                  ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
