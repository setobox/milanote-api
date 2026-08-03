import { milanoteShareUrlSchema, type MilanoteDocument } from "@milanote-api/parser";
import {
  Braces,
  Clipboard,
  DatabaseZap,
  Filter,
  Github,
  LayoutDashboard,
  Moon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  buildAbsoluteApiUrl,
  buildBoardRequestPath,
  customPresetStorageKey,
  defaultIncludeSelectors,
  fieldSelectorTree,
  type FieldSelectorTreeNode,
  type FieldView,
  type PlaygroundFilter,
  toggleSelectorWithDependencies,
  withSelectorDependencies,
} from "@/features/api/request.ts";
import { useAppearance } from "@/hooks/useAppearance.ts";
import { useBoardApi } from "@/hooks/useBoardApi.ts";
import { countDescendants, formatFetchedAt, getNodeLabel } from "@/utils/boardModel.ts";

interface AppProps {
  apiOrigin?: string;
  fetcher?: typeof fetch;
}

type CopyState = "error" | "idle" | "success";
type FilterMode = PlaygroundFilter["mode"];
type PresetValue = FieldView | "custom";

interface FilterDraft {
  exclude: readonly string[];
  include: readonly string[];
  mode: FilterMode;
}

interface RequestComposerProps {
  filterMode: FilterMode;
  filterSummary: string;
  inputError?: string;
  isLoading: boolean;
  onOpenFilterSettings: () => void;
  onPresetChange: (value: PresetValue) => void;
  onShareUrlChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  shareUrl: string;
  variant: "hero" | "sidebar";
  view: FieldView;
}

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
  function TreeItem({ depth, node }: { depth: number; node: FieldSelectorTreeNode }) {
    const id = node.value ? `${mode}-${node.value.replaceAll(/[^A-Za-z0-9]/g, "-")}` : undefined;

    return (
      <li
        className="grid min-w-0 gap-1"
        style={{ paddingLeft: depth === 0 ? undefined : `${depth * 0.75}rem` }}
      >
        {node.value && id ? (
          <label
            className="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
            htmlFor={id}
          >
            <input
              id={id}
              aria-label={`${mode === "include" ? "包含" : "排除"}${node.label} (${node.value})`}
              className="size-4 shrink-0 accent-primary"
              type="checkbox"
              checked={selected.includes(node.value)}
              onChange={() => onToggle(node.value!)}
            />
            <span className="min-w-0">
              <span className="block">{node.label}</span>
              <code className="block truncate font-mono text-[0.625rem] text-muted-foreground">
                {node.value}
              </code>
            </span>
          </label>
        ) : (
          <p className="px-2 pt-2 text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {node.label}
          </p>
        )}
        {node.children.length > 0 ? (
          <ul className="grid min-w-0 gap-1" aria-label={`${node.label}子字段`}>
            {node.children.map((child) => (
              <TreeItem key={child.value ?? child.label} depth={depth + 1} node={child} />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className="text-xs font-medium">
        {legend}
        <span className="ml-2 font-mono text-[0.6875rem] text-muted-foreground">
          {selected.length}
        </span>
      </legend>
      <ul className="selector-list grid min-w-0 gap-3 rounded-xl border p-3 sm:grid-cols-2">
        {fieldSelectorTree.map((node) => (
          <TreeItem key={node.label} depth={0} node={node} />
        ))}
      </ul>
    </fieldset>
  );
}

function RequestComposer({
  filterMode,
  filterSummary,
  inputError,
  isLoading,
  onOpenFilterSettings,
  onPresetChange,
  onShareUrlChange,
  onSubmit,
  shareUrl,
  variant,
  view,
}: RequestComposerProps) {
  const selectedPreset = filterMode === "include" ? "custom" : view;
  const isHero = variant === "hero";

  return (
    <form className={isHero ? "grid gap-5" : "grid gap-4"} onSubmit={onSubmit}>
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
          aria-describedby={inputError ? "share-url-error" : undefined}
          value={shareUrl}
          onChange={(event) => onShareUrlChange(event.currentTarget.value)}
        />
        {inputError ? (
          <p id="share-url-error" className="text-xs text-destructive" role="alert">
            {inputError}
          </p>
        ) : null}
      </div>

      <div
        className={
          isHero
            ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            : "grid gap-3 border-t pt-4"
        }
      >
        <div className="grid gap-1.5">
          <label className="text-[0.6875rem] font-medium" htmlFor="field-view">
            返回预设
          </label>
          <Select
            value={selectedPreset}
            onValueChange={(value) => onPresetChange(value as PresetValue)}
          >
            <SelectTrigger id="field-view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">完整</SelectItem>
              <SelectItem value="standard">标准</SelectItem>
              <SelectItem value="compact">精简</SelectItem>
              <SelectItem value="custom">自定义（本地保存）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className={isHero ? "min-w-36" : "w-full"} type="submit" aria-busy={isLoading}>
          {isLoading ? (
            <RefreshCw className="animate-spin" aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}
          {isLoading ? "正在解析" : "解析画板"}
        </Button>
      </div>

      <Button
        className="filter-button min-h-11 w-full justify-between"
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        onClick={onOpenFilterSettings}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          高级字段筛选
        </span>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">{filterSummary}</span>
      </Button>
    </form>
  );
}

function FilterSettingsDialog({
  copyLabel,
  draft,
  error,
  onApply,
  onCancel,
  onCopy,
  onModeChange,
  onToggle,
  open,
  previewApiUrl,
}: {
  copyLabel: string;
  draft: FilterDraft;
  error?: string;
  onApply: () => void;
  onCancel: () => void;
  onCopy: () => void;
  onModeChange: (mode: FilterMode) => void;
  onToggle: (selector: string) => void;
  open: boolean;
  previewApiUrl?: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="filter-dialog max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[52rem]">
        <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-6">
          <DialogTitle>高级字段筛选</DialogTitle>
          <DialogDescription>
            调整后先预览 API 链接，再点击“应用筛选”保存到当前请求。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-5">
            <div className="grid gap-1.5">
              <label className="text-[0.6875rem] font-medium" htmlFor="filter-mode">
                筛选方式
              </label>
              <Select
                value={draft.mode}
                onValueChange={(value) => onModeChange(value as FilterMode)}
              >
                <SelectTrigger id="filter-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">从预设中排除字段</SelectItem>
                  <SelectItem value="include">仅保留选中字段</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.mode === "include" ? (
              <SelectorChecklist
                legend="保留字段"
                mode="include"
                selected={draft.include}
                onToggle={onToggle}
              />
            ) : (
              <SelectorChecklist
                legend="排除字段"
                mode="exclude"
                selected={draft.exclude}
                onToggle={onToggle}
              />
            )}

            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="grid gap-2 border-t pt-4">
              <p className="text-[0.6875rem] font-medium text-muted-foreground">草稿 API 链接</p>
              <code
                className="api-url-code block truncate rounded-lg px-3 py-2 font-mono text-[0.625rem] text-code-foreground"
                title={previewApiUrl}
              >
                {previewApiUrl ?? "输入有效分享链接后生成草稿 API 链接"}
              </code>
              <Button type="button" variant="outline" disabled={!previewApiUrl} onClick={onCopy}>
                <Clipboard aria-hidden="true" />
                {copyLabel === "复制完整 API 链接" ? "复制草稿 API 链接" : copyLabel}
              </Button>
              <p className="text-[0.6875rem] leading-5 text-muted-foreground">
                复制的 URL 包含分享权限参数，请勿公开。
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="button" onClick={onApply}>
            <Filter aria-hidden="true" />
            应用筛选
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toggleValue(values: readonly string[], value: string): readonly string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function readCustomPreset(): readonly string[] {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(customPresetStorageKey) ?? "null",
    );
    if (
      Array.isArray(value) &&
      value.every((selector): selector is string => typeof selector === "string")
    ) {
      return withSelectorDependencies(value);
    }
  } catch {
    // A corrupted local preference should not prevent the Playground from loading.
  }
  return withSelectorDependencies(defaultIncludeSelectors);
}

function toFilter({ exclude, include, mode }: FilterDraft, view: FieldView): PlaygroundFilter {
  return mode === "include" ? { include, mode: "include" } : { exclude, mode: "view", view };
}

function getRequestPath(shareUrl: string, filter: PlaygroundFilter): string | undefined {
  const parsedShareUrl = milanoteShareUrlSchema.safeParse(shareUrl);
  if (!parsedShareUrl.success) {
    return undefined;
  }

  try {
    return buildBoardRequestPath(parsedShareUrl.data, filter);
  } catch {
    return undefined;
  }
}

export function App({ apiOrigin, fetcher }: AppProps) {
  const { appearance, toggleAppearance } = useAppearance();
  const { boardDocument, error, isLoading, load, responseData } = useBoardApi({ fetcher });
  const [shareUrl, setShareUrl] = useState("");
  const [submittedRequestPath, setSubmittedRequestPath] = useState<string>();
  const [inputError, setInputError] = useState<string>();
  const [filterMode, setFilterMode] = useState<FilterMode>("view");
  const [view, setView] = useState<FieldView>("full");
  const [include, setInclude] = useState<readonly string[]>(readCustomPreset);
  const [exclude, setExclude] = useState<readonly string[]>([]);
  const [isFilterSettingsOpen, setIsFilterSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>({
    exclude: [],
    include: readCustomPreset(),
    mode: "view",
  });
  const [draftFilterError, setDraftFilterError] = useState<string>();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const boardTitle = boardDocument
    ? getNodeLabel(boardDocument.board)
    : responseData
      ? "Filtered response"
      : "Board inspector";

  const activeDraft = useMemo<FilterDraft>(
    () => ({ exclude, include, mode: filterMode }),
    [exclude, filterMode, include],
  );
  const filter = useMemo(() => toFilter(activeDraft, view), [activeDraft, view]);
  const draftFilter = useMemo(() => toFilter(draft, view), [draft, view]);
  const draftRequestPath = useMemo(
    () => getRequestPath(shareUrl, draftFilter),
    [draftFilter, shareUrl],
  );
  const draftApiUrl = draftRequestPath
    ? buildAbsoluteApiUrl(draftRequestPath, apiOrigin ?? window.location.origin)
    : undefined;
  const filterSummary =
    filterMode === "include"
      ? `仅保留 ${include.length} 项`
      : exclude.length > 0
        ? `排除 ${exclude.length} 项`
        : "未设置";
  const isIdle = !isLoading && !error && !responseData;

  function openFilterSettings(nextDraft: FilterDraft = activeDraft): void {
    setDraft({
      exclude: [...nextDraft.exclude],
      include: [...nextDraft.include],
      mode: nextDraft.mode,
    });
    setDraftFilterError(undefined);
    setIsFilterSettingsOpen(true);
  }

  function cancelFilterSettings(): void {
    setDraftFilterError(undefined);
    setIsFilterSettingsOpen(false);
  }

  function applyFilterSettings(): void {
    if (draft.mode === "include" && draft.include.length === 0) {
      setDraftFilterError("白名单模式至少需要选择一个字段。");
      return;
    }

    setFilterMode(draft.mode);
    setInclude(draft.include);
    setExclude(draft.exclude);
    setDraftFilterError(undefined);
    setCopyState("idle");
    setIsFilterSettingsOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = milanoteShareUrlSchema.safeParse(shareUrl);

    if (!result.success) {
      setInputError("请输入有效的 Milanote 公开分享链接。");
      return;
    }

    if (filter.mode === "include" && filter.include.length === 0) {
      openFilterSettings(activeDraft);
      setDraftFilterError("白名单模式至少需要选择一个字段。");
      return;
    }

    const requestPath = buildBoardRequestPath(result.data, filter);
    setInputError(undefined);
    setSubmittedRequestPath(requestPath);
    void load(requestPath);
  }

  function retry(): void {
    if (submittedRequestPath) {
      void load(submittedRequestPath);
    }
  }

  async function copyApiUrl(apiUrl: string | undefined): Promise<void> {
    if (!apiUrl) {
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("CLIPBOARD_UNAVAILABLE");
      }
      await navigator.clipboard.writeText(apiUrl);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }

    if (copyResetTimer.current) {
      clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2400);
  }

  function selectPreset(value: PresetValue): void {
    if (value === "custom") {
      openFilterSettings({ exclude, include: readCustomPreset(), mode: "include" });
      return;
    }

    setFilterMode("view");
    setView(value);
    setCopyState("idle");
  }

  function updateDraftMode(mode: FilterMode): void {
    setDraft((current) => ({ ...current, mode }));
    setDraftFilterError(undefined);
  }

  function toggleDraftSelector(selector: string): void {
    setDraft((current) =>
      current.mode === "include"
        ? { ...current, include: toggleSelectorWithDependencies(current.include, selector) }
        : { ...current, exclude: toggleValue(current.exclude, selector) },
    );
    setDraftFilterError(undefined);
  }

  useEffect(
    () => () => {
      if (copyResetTimer.current) {
        clearTimeout(copyResetTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(customPresetStorageKey, JSON.stringify(include));
    } catch {
      // localStorage may be unavailable in privacy-restricted browser contexts.
    }
  }, [include]);

  const copyLabel =
    copyState === "success"
      ? "API 链接已复制"
      : copyState === "error"
        ? "复制失败"
        : "复制完整 API 链接";

  const composerProps: Omit<RequestComposerProps, "variant"> = {
    filterMode,
    filterSummary,
    inputError,
    isLoading,
    onOpenFilterSettings: () => openFilterSettings(),
    onPresetChange: selectPreset,
    onShareUrlChange: (value) => {
      setShareUrl(value);
      setCopyState("idle");
      if (inputError) setInputError(undefined);
    },
    onSubmit: submit,
    shareUrl,
    view,
  };

  return (
    <div className="playground-shell min-h-svh text-foreground">
      <header className="playground-header sticky top-2 z-30 mx-2 flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-3 sm:mx-4 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="app-logo grid size-9 shrink-0 place-items-center rounded-xl text-primary-foreground">
            <DatabaseZap className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase">
              Milanote API
            </p>
            <h1 className="truncate text-sm font-semibold sm:text-base">{boardTitle}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLoading ? (
            <Badge variant="outline">
              <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
              正在解析
            </Badge>
          ) : error ? (
            <Badge variant="destructive">解析失败</Badge>
          ) : responseData ? (
            <Badge variant="success">已解析</Badge>
          ) : null}
          <Button
            className="size-10 rounded-xl cursor-pointer"
            type="button"
            size="icon"
            variant="outline"
            aria-label={appearance === "dark" ? "切换为日间模式" : "切换为夜间模式"}
            onClick={toggleAppearance}
          >
            {appearance === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </Button>
          {/* 跳转github */}
          <Button
            className="size-10 rounded-xl cursor-pointer"
            type="button"
            size="icon"
            variant="outline"
          >
            <a
              href="https://github.com/setobox/milanote-api"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="size-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </header>

      {isIdle ? (
        <main className="idle-workspace grid min-h-[calc(100svh-5rem)] place-items-center px-3 py-8 sm:px-6">
          <section
            className="hero-composer w-full max-w-2xl rounded-2xl border p-5 sm:p-8"
            aria-live="polite"
          >
            <div className="brand-beads mb-6" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Board inspector
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              连接你的公开画板
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              输入 Milanote 公开分享链接，将画板转换为可检查、可筛选的结构化 JSON。
            </p>
            <div className="mt-7">
              <RequestComposer {...composerProps} variant="hero" />
            </div>
          </section>
        </main>
      ) : (
        <main className="grid min-h-[calc(100svh-5rem)] grid-cols-1 gap-3 px-2 pb-2 pt-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-4 lg:px-4 lg:pb-4">
          <aside className="tool-sidebar min-w-0 rounded-2xl border p-3 sm:p-4">
            <div className="grid gap-4 lg:sticky lg:top-20">
              <Card>
                <CardHeader>
                  <CardTitle>解析共享画板</CardTitle>
                </CardHeader>
                <CardContent>
                  <RequestComposer {...composerProps} variant="sidebar" />
                </CardContent>
              </Card>

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

          <section className="workspace-surface min-w-0 rounded-2xl border" aria-live="polite">
            <div className="workspace-panel h-full overflow-hidden rounded-[calc(var(--radius)+4px)]">
              {isLoading ? (
                <div className="grid min-h-72 place-items-center p-8" role="status">
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
                <div className="grid min-h-72 place-items-center p-6">
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
                  <div className="result-toolbar flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
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
                      <div className="empty-state grid min-h-72 place-items-center p-8 text-center">
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
                  <div className="result-toolbar flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
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
              ) : null}
            </div>
          </section>
        </main>
      )}

      <FilterSettingsDialog
        copyLabel={copyLabel}
        draft={draft}
        error={draftFilterError}
        open={isFilterSettingsOpen}
        previewApiUrl={draftApiUrl}
        onApply={applyFilterSettings}
        onCancel={cancelFilterSettings}
        onCopy={() => void copyApiUrl(draftApiUrl)}
        onModeChange={updateDraftMode}
        onToggle={toggleDraftSelector}
      />
    </div>
  );
}
