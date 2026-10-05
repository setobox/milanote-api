import { useId, useState, type ReactNode } from "react";
import { Copy, Info, X } from "lucide-react";
import { Popover } from "radix-ui";
import { apiUrl, hasPlaceholderUrl, requestCode, type RequestTab } from "./model.ts";

export function CodePopover({
  tab,
  apiBase,
  authenticated,
  notify,
  children,
}: {
  tab: RequestTab;
  apiBase: string;
  authenticated: boolean;
  notify: (message: string) => void;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<"curl" | "javascript" | "python">("curl");
  const titleId = useId();
  let code = "";
  let error = "";
  try {
    code = requestCode(
      language,
      apiUrl(apiBase || "https://YOUR_API_HOST", tab.operation),
      tab.operation,
      tab.raw,
      authenticated,
    );
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "请检查请求参数。";
  }
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      notify("请求代码已复制");
    } catch {
      notify("复制失败，请手动选择代码。");
    }
  }
  return (
    <Popover.Root modal={false}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="code-popover"
          sideOffset={8}
          collisionPadding={12}
          align="end"
          aria-labelledby={titleId}
        >
          <div className="code-popover-heading">
            <h2 id={titleId}>请求代码</h2>
            <Popover.Close aria-label="关闭代码浮窗">
              <X size={16} />
            </Popover.Close>
          </div>
          <p className="code-note">代码随当前参数同步；Token 使用占位符。</p>
          {(hasPlaceholderUrl(tab.raw) || !apiBase) && (
            <p className="code-placeholder-note">
              <Info size={14} />
              未填写的链接已用占位符替代，运行前请替换。
            </p>
          )}
          <div className="panel-tabs" role="tablist" aria-label="代码语言">
            {(
              [
                ["curl", "cURL (Bash)"],
                ["javascript", "JavaScript"],
                ["python", "Python"],
              ] as const
            ).map(([value, name]) => (
              <button
                key={value}
                role="tab"
                aria-selected={language === value}
                onClick={() => setLanguage(value)}
              >
                {name}
              </button>
            ))}
          </div>
          {error ? (
            <p className="form-note" role="alert">
              {error}
            </p>
          ) : (
            <pre className="code-output" tabIndex={0} aria-label="请求代码内容">
              {code}
            </pre>
          )}
          <div className="code-popover-footer">
            <button className="send-button" disabled={Boolean(error)} onClick={() => void copy()}>
              <Copy size={14} />
              复制代码
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
