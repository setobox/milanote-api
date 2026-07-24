import { milanoteShareUrlSchema, type MilanoteDocument } from "@milanote-api/parser";
import {
  Activity,
  Braces,
  Check,
  Clipboard,
  ClipboardX,
  DatabaseZap,
  Filter,
  LayoutDashboard,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { BoardCanvas } from "@/components/board/BoardCanvas.tsx";
import { JsonViewer } from "@/components/board/JsonViewer.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  buildAbsoluteApiUrl,
  buildBoardRequestPath,
  defaultIncludeSelectors,
  fieldSelectorOptions,
  type FieldView,
  type PlaygroundFilter,
} from "@/features/api/request.ts";
import { useBoardApi } from "@/hooks/useBoardApi.ts";
import { countDescendants, formatFetchedAt, getNodeLabel } from "@/utils/boardModel.ts";

interface AppProps {
  apiOrigin?: string;
  fetcher?: typeof fetch;
}

type CopyState = "error" | "idle" | "success";
type FilterMode = PlaygroundFilter["mode"];

const selectorGroups = [...new Set(fieldSelectorOptions.map((option) => option.group))].map(
  (group) => ({
    group,
    options: fieldSelectorOptions.filter((option) => option.group === group),
  }),
);

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function BoardSummary({ document }: { document: MilanoteDocument }) {
  const rows = [
    ["Board ID", document.source.boardId],
    ["顶层元素", String(document.board.children.length)],
    ["全部元素", String(countDescendants(document.board))],
    ["抓取时间", formatFetchedAt(document.fetchedAt)],
  ] as const;

  return (
    <dl className="grid gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1">
          <dt className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </dt>
          <dd className="truncate font-mono text-xs" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SelectorChecklist({
  legend,
  mode,
  onToggle,
  selected,
}: {
  legend: string;
  mode: "exclude" | "include";
  onToggle: (selector: string) => void;
  selected: readonly string[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-medium">
        {legend}
        <span className="ml-2 font-mono text-[0.6875rem] text-muted-foreground">
          {selected.length}
        </span>
      </legend>
      <div className="max-h-52 space-y-3 overflow-y-auto rounded-md border bg-background p-2.5">
        {selectorGroups.map(({ group, options }) => (
          <div key={group} className="grid gap-1.5">
            <p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
              {group}
            </p>
            {options.map((option) => {
              const id = `${mode}-${option.value.replaceAll(/[^A-Za-z0-9]/g, "-")}`;
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent"
                  htmlFor={id}
                >
                  <input
                    id={id}
                    aria-label={`${mode === "include" ? "包含" : "排除"}${option.label} (${option.value})`}
                    className="mt-0.5 size-3.5 shrink-0 accent-primary"
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => onToggle(option.value)}
                  />
                  <span className="min-w-0">
                    <span className="block">{option.label}</span>
                    <code className="block truncate font-mono text-[0.625rem] text-muted-foreground">
                      {option.value}
                    </code>
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function toggleValue(values: readonly string[], value: string): readonly string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

export function App({ apiOrigin, fetcher }: AppProps) {
  const { boardDocument, error, isLoading, load, responseData, status } = useBoardApi({ fetcher });
  const [shareUrl, setShareUrl] = useState("");
  const [submittedRequestPath, setSubmittedRequestPath] = useState<string>();
  const [inputError, setInputError] = useState<string>();
  const [filterError, setFilterError] = useState<string>();
  const [filterMode, setFilterMode] = useState<FilterMode>("view");
  const [view, setView] = useState<FieldView>("full");
  const [include, setInclude] = useState<readonly string[]>(defaultIncludeSelectors);
  const [exclude, setExclude] = useState<readonly string[]>([]);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const boardTitle = boardDocument
    ? getNodeLabel(boardDocument.board)
    : responseData
      ? "Filtered response"
      : "Board inspector";

  const filter = useMemo<PlaygroundFilter>(
    () =>
      filterMode === "include" ? { include, mode: "include" } : { exclude, mode: "view", view },
    [exclude, filterMode, include, view],
  );

  const currentRequestPath = useMemo(() => {
    const parsedShareUrl = milanoteShareUrlSchema.safeParse(shareUrl);
    if (!parsedShareUrl.success) {
      return undefined;
    }

    try {
      return buildBoardRequestPath(parsedShareUrl.data, filter);
    } catch {
      return undefined;
    }
  }, [filter, shareUrl]);

  const currentApiUrl = currentRequestPath
    ? buildAbsoluteApiUrl(currentRequestPath, apiOrigin ?? window.location.origin)
    : undefined;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = milanoteShareUrlSchema.safeParse(shareUrl);

    if (!result.success) {
      setInputError("请输入有效的 Milanote 公开分享链接。");
      return;
    }

    if (filter.mode === "include" && filter.include.length === 0) {
      setFilterError("白名单模式至少需要选择一个字段。");
      return;
    }

    const requestPath = buildBoardRequestPath(result.data, filter);
    setInputError(undefined);
    setFilterError(undefined);
    setSubmittedRequestPath(requestPath);
    void load(requestPath);
  }

  function retry(): void {
    if (submittedRequestPath) {
      void load(submittedRequestPath);
    }
  }

  async function copyApiUrl(): Promise<void> {
    if (!currentApiUrl) {
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("CLIPBOARD_UNAVAILABLE");
      }
      await navigator.clipboard.writeText(currentApiUrl);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }

    if (copyResetTimer.current) {
      clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2400);
  }

  useEffect(
    () => () => {
      if (copyResetTimer.current) {
        clearTimeout(copyResetTimer.current);
      }
    },
    [],
  );

  const CopyIcon = copyState === "success" ? Check : copyState === "error" ? ClipboardX : Clipboard;
  const copyLabel =
    copyState === "success"
      ? "API 链接已复制"
      : copyState === "error"
        ? "复制失败"
        : "复制完整 API 链接";

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-card/80 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <DatabaseZap className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase">
              Milanote API
            </p>
            <h1 className="truncate text-sm font-semibold sm:text-base">{boardTitle}</h1>
          </div>
        </div>
        <Badge variant={status === "success" ? "success" : "outline"}>
          <Activity className="size-3" aria-hidden="true" />
          {isLoading ? "FETCHING" : status.toUpperCase()}
        </Badge>
      </header>

      <main className="grid min-h-[calc(100svh-4rem)] grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="border-b bg-sidebar p-4 lg:border-r lg:border-b-0 lg:p-5">
          <div className="grid gap-4 lg:sticky lg:top-5">
            <Card>
              <CardHeader>
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <Search className="size-4" aria-hidden="true" />
                  <span className="font-mono text-[0.6875rem] tracking-wide uppercase">
                    GET /api/detail
                  </span>
                </div>
                <CardTitle>解析共享画板</CardTitle>
                <CardDescription>
                  粘贴你有权公开访问的 Milanote 分享链接，并选择需要返回的字段。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={submit}>
                  <div className="grid gap-2">
                    <label className="text-xs font-medium" htmlFor="share-url">
                      Milanote 分享链接
                    </label>
                    <Input
                      id="share-url"
                      name="url"
                      type="url"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="https://app.milanote.com/…?p=…"
                      aria-invalid={Boolean(inputError)}
                      aria-describedby={inputError ? "share-url-error" : "share-url-help"}
                      value={shareUrl}
                      onChange={(event) => {
                        setShareUrl(event.currentTarget.value);
                        setCopyState("idle");
                        if (inputError) setInputError(undefined);
                      }}
                    />
                    {inputError ? (
                      <p id="share-url-error" className="text-xs text-destructive" role="alert">
                        {inputError}
                      </p>
                    ) : (
                      <p id="share-url-help" className="text-xs leading-5 text-muted-foreground">
                        链接仅用于当前请求，不会写入页面地址、本地存储或最近记录。
                      </p>
                    )}
                  </div>

                  <div className="grid gap-3 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Filter className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <p className="text-xs font-semibold">响应筛选</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1.5">
                        <label className="text-[0.6875rem] font-medium" htmlFor="filter-mode">
                          模式
                        </label>
                        <select
                          id="filter-mode"
                          className={selectClassName}
                          value={filterMode}
                          onChange={(event) => {
                            setFilterMode(event.currentTarget.value as FilterMode);
                            setFilterError(undefined);
                            setCopyState("idle");
                          }}
                        >
                          <option value="view">预设 / 黑名单</option>
                          <option value="include">白名单</option>
                        </select>
                      </div>
                      {filterMode === "view" ? (
                        <div className="grid gap-1.5">
                          <label className="text-[0.6875rem] font-medium" htmlFor="field-view">
                            预设
                          </label>
                          <select
                            id="field-view"
                            className={selectClassName}
                            value={view}
                            onChange={(event) => {
                              setView(event.currentTarget.value as FieldView);
                              setCopyState("idle");
                            }}
                          >
                            <option value="full">完整</option>
                            <option value="standard">标准</option>
                            <option value="compact">精简</option>
                          </select>
                        </div>
                      ) : null}
                    </div>

                    {filterMode === "include" ? (
                      <SelectorChecklist
                        legend="仅保留字段"
                        mode="include"
                        selected={include}
                        onToggle={(selector) => {
                          setInclude((current) => toggleValue(current, selector));
                          setFilterError(undefined);
                          setCopyState("idle");
                        }}
                      />
                    ) : (
                      <SelectorChecklist
                        legend="额外排除字段（可选）"
                        mode="exclude"
                        selected={exclude}
                        onToggle={(selector) => {
                          setExclude((current) => toggleValue(current, selector));
                          setCopyState("idle");
                        }}
                      />
                    )}
                    {filterError ? (
                      <p className="text-xs text-destructive" role="alert">
                        {filterError}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2 border-t pt-4">
                    <code
                      className="block truncate rounded-md bg-code px-3 py-2 font-mono text-[0.625rem] text-code-foreground"
                      title={currentApiUrl}
                    >
                      {currentApiUrl ?? "输入有效分享链接后生成完整 API 链接"}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!currentApiUrl}
                      onClick={() => void copyApiUrl()}
                    >
                      <CopyIcon aria-hidden="true" />
                      {copyLabel}
                    </Button>
                    <p className="text-[0.6875rem] leading-5 text-muted-foreground">
                      复制内容包含分享权限参数，请勿公开传播。
                    </p>
                  </div>

                  <Button className="w-full" type="submit" aria-busy={isLoading}>
                    {isLoading ? (
                      <RefreshCw className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Search aria-hidden="true" />
                    )}
                    {isLoading ? "正在解析" : "解析画板"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Alert>
              <ShieldCheck aria-hidden="true" />
              <AlertTitle>隐私提示</AlertTitle>
              <AlertDescription>
                API 使用 GET 查询参数。分享链接可能出现在平台访问日志和 CDN
                缓存键中，请勿提交私有或无权访问的画板。
              </AlertDescription>
            </Alert>

            {boardDocument ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">响应摘要</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <BoardSummary document={boardDocument} />
                  <Button type="button" variant="outline" onClick={retry}>
                    <RefreshCw aria-hidden="true" />
                    重新抓取
                  </Button>
                </CardContent>
              </Card>
            ) : responseData ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">投影响应</CardTitle>
                  <CardDescription>
                    当前字段不足以构建完整 Canvas，右侧仅展示 JSON。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" type="button" variant="outline" onClick={retry}>
                    <RefreshCw aria-hidden="true" />
                    重新抓取
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 bg-workspace p-3 sm:p-4 lg:p-5" aria-live="polite">
          <div className="h-full min-h-[36rem] overflow-hidden rounded-xl border bg-card shadow-sm">
            {isLoading ? (
              <div className="grid h-full min-h-[36rem] place-items-center p-8" role="status">
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-40 w-full" />
                  <p className="text-center text-sm text-muted-foreground">
                    正在读取并规范化共享画板…
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="grid h-full min-h-[36rem] place-items-center p-6">
                <Alert className="max-w-lg border-destructive/30 bg-destructive/5">
                  <Badge variant="destructive" className="mb-2">
                    {error.code}
                  </Badge>
                  <AlertTitle>无法载入画板</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                  <Button className="mt-3 w-fit" type="button" variant="outline" onClick={retry}>
                    重新尝试
                  </Button>
                </Alert>
              </div>
            ) : boardDocument && responseData ? (
              <Tabs defaultValue="canvas" className="gap-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {getNodeLabel(boardDocument.board)}
                    </p>
                    <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">
                      document/v{boardDocument.version}
                    </p>
                  </div>
                  <TabsList aria-label="结果查看方式">
                    <TabsTrigger value="canvas">
                      <LayoutDashboard aria-hidden="true" />
                      Canvas
                    </TabsTrigger>
                    <TabsTrigger value="json">
                      <Braces aria-hidden="true" />
                      JSON
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="canvas" className="overflow-hidden">
                  {boardDocument.board.children.length > 0 ? (
                    <BoardCanvas board={boardDocument.board} />
                  ) : (
                    <div className="grid min-h-[32rem] place-items-center p-8 text-center">
                      <div className="max-w-sm">
                        <Badge variant="outline">EMPTY</Badge>
                        <h2 className="mt-4 text-base font-semibold">画板暂时为空</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          API 已成功响应，但没有可视化元素。可切换到 JSON 查看完整结果。
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="json" className="overflow-hidden">
                  <JsonViewer value={responseData} />
                </TabsContent>
              </Tabs>
            ) : responseData ? (
              <div className="grid gap-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">字段投影结果</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      当前响应省略了 Canvas 所需字段。
                    </p>
                  </div>
                  <Badge variant="outline">JSON ONLY</Badge>
                </div>
                <JsonViewer value={responseData} />
              </div>
            ) : (
              <div className="grid min-h-[36rem] place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <Badge variant="outline">READY</Badge>
                  <h2 className="mt-4 text-base font-semibold">输入分享链接开始解析</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    完整响应可使用 Canvas 和 JSON；筛选响应将展示 JSON。
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
