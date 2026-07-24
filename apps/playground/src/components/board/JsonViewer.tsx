import { Check, Clipboard, ClipboardX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button.tsx";

export function JsonViewer({ value }: { value: unknown }) {
  const formattedValue = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const copyStatus =
    copyState === "success"
      ? "JSON 已复制"
      : copyState === "error"
        ? "复制失败，请手动选择文本"
        : "";

  async function copyJson(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error("CLIPBOARD_UNAVAILABLE");
      }
      await navigator.clipboard.writeText(formattedValue);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2400);
  }

  useEffect(
    () => () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const CopyIcon = copyState === "success" ? Check : copyState === "error" ? ClipboardX : Clipboard;

  return (
    <section
      className="flex h-full min-h-[32rem] flex-col gap-3 p-4 sm:p-5"
      aria-labelledby="json-viewer-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="json-viewer-title" className="text-sm font-semibold">
            规范化 JSON
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">可直接用于渲染或下游处理</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {copyStatus}
          </span>
          <Button variant="outline" size="sm" type="button" onClick={() => void copyJson()}>
            <CopyIcon />
            复制 JSON
          </Button>
        </div>
      </div>
      <pre
        className="min-h-0 flex-1 overflow-auto rounded-lg border bg-code p-4 font-mono text-xs leading-5 text-code-foreground shadow-inner sm:text-sm"
        tabIndex={0}
      >
        <code>{formattedValue}</code>
      </pre>
    </section>
  );
}
