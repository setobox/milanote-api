import { useState } from "react";
import { Braces, Copy, Download, Timer, Send } from "lucide-react";
import { successSchema } from "@milanote-api/api/contracts";
import { ResponsePreview } from "./ResponsePreview.tsx";
import { Popover } from "radix-ui";
import { JsonEditor } from "./JsonEditor.tsx";
import { readJson, type RequestTab } from "./model.ts";

export function ResponsePanel({
  tab,
  dark,
  notify,
}: {
  tab: RequestTab;
  dark: boolean;
  notify: (message: string) => void;
}) {
  const [mode, setMode] = useState("body");
  const result = tab.result;
  const parsed = readJson(result?.text ?? "");
  const payload = successSchema.safeParse(parsed);
  const formatted = parsed === undefined ? (result?.text ?? "") : JSON.stringify(parsed, null, 2);
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(result?.text ?? "");
      notify("响应已复制");
    } catch {
      notify("复制失败，请在响应中手动选择文本。");
    }
  }
  function download(): void {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([result.text], { type: parsed === undefined ? "text/plain" : "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = parsed === undefined ? "response.txt" : "response.json";
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return (
    <>
      <div className="panel-heading">
        <span>
          <Braces size={15} /> 响应
        </span>
        <div className="inline-actions">
          <button
            title="复制响应"
            aria-label="复制响应"
            disabled={!result}
            onClick={() => void copy()}
          >
            <Copy size={14} />
          </button>
          <button title="下载响应" aria-label="下载响应" disabled={!result} onClick={download}>
            <Download size={14} />
          </button>
        </div>
      </div>
      <div className="response-status" aria-live="polite">
        {result ? (
          <>
            <span className={result.status < 400 ? "success" : "danger"}>
              ● {result.status} {result.statusText}
            </span>
            <Popover.Root>
              <Popover.Trigger className="timing-trigger" aria-label="查看分段耗时">
                <Timer size={12} /> {result.elapsed} ms
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="timing-popover" sideOffset={8} align="start">
                  <h3>分段耗时</h3>
                  {payload.success ? (
                    <>
                      <dl>
                        {Object.entries(payload.data.meta.timings).map(([stage, ms]) => (
                          <div key={stage}>
                            <dt>
                              {
                                {
                                  permission: "获取权限",
                                  boards: "读取画板",
                                  parse: "解析数据",
                                  total: "服务端总计",
                                }[stage]
                              }
                            </dt>
                            <dd>{ms.toFixed(1)} ms</dd>
                          </div>
                        ))}
                      </dl>
                      <p>上游请求 {payload.data.meta.upstreamRequests} 次</p>
                    </>
                  ) : (
                    <p>该响应没有分段耗时，可查看响应头 Server-Timing。</p>
                  )}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <span>{(result.bytes / 1024).toFixed(2)} KB 正文</span>
          </>
        ) : (
          <span>等待发送请求</span>
        )}
        {tab.pending && <span className="pending">请求中…</span>}
      </div>
      <div className="panel-tabs" role="tablist" aria-label="响应查看方式">
        {[
          ["body", "JSON / 正文"],
          ["headers", "响应头"],
          ["preview", "画板预览"],
        ].map(([id, name]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id ?? "body")}
          >
            {name}
          </button>
        ))}
      </div>
      {!result ? (
        <div className="response-empty">
          <div className="empty-orbit">
            <Send size={24} />
          </div>
          <h2>响应会出现在这里</h2>
          <p>填入分享链接，发送你的第一个请求。</p>
          <span className="key-hint">Ctrl / ⌘ + Enter</span>
        </div>
      ) : mode === "body" ? (
        <JsonEditor value={formatted} dark={dark} readOnly label="响应正文" />
      ) : mode === "headers" ? (
        <div className="panel-scroll">
          <table className="data-table">
            <tbody>
              {Object.entries(result.headers).map(([key, value]) => (
                <tr key={key}>
                  <th>{key}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel-scroll">
          {payload.success && payload.data.meta.unloadedBoardIds.length > 0 && (
            <div className="notice">
              {payload.data.meta.complete ? "当前范围读取完成" : "部分内容未能读取"} ·{" "}
              {payload.data.meta.unloadedBoardIds.length} 个子画板未展开。
            </div>
          )}
          <ResponsePreview
            parsed={parsed}
            text={result.text}
            unloadedBoardIds={payload.success ? payload.data.meta.unloadedBoardIds : []}
          />
        </div>
      )}
    </>
  );
}
