import { milanoteShareUrlSchema, type MilanoteDocument } from "@milanote-api/parser";
import {
  Activity,
  Braces,
  DatabaseZap,
  LayoutDashboard,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useState } from "react";

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
import { useBoardApi } from "@/hooks/useBoardApi.ts";
import { countDescendants, formatFetchedAt, getNodeLabel } from "@/utils/boardModel.ts";

interface AppProps {
  fetcher?: typeof fetch;
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

export function App({ fetcher }: AppProps) {
  const { boardDocument, error, isLoading, search, status } = useBoardApi({ fetcher });
  const [shareUrl, setShareUrl] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState<string>();
  const [inputError, setInputError] = useState<string>();
  const boardTitle = boardDocument ? getNodeLabel(boardDocument.board) : "Board inspector";

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = milanoteShareUrlSchema.safeParse(shareUrl);

    if (!result.success) {
      setInputError("请输入有效的 Milanote 公开分享链接。");
      return;
    }

    setInputError(undefined);
    setSubmittedUrl(result.data);
    void search(result.data);
  }

  function retry(): void {
    if (submittedUrl) {
      void search(submittedUrl);
    }
  }

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

      <main className="grid min-h-[calc(100svh-4rem)] grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b bg-sidebar p-4 lg:border-r lg:border-b-0 lg:p-5">
          <div className="grid gap-4 lg:sticky lg:top-5">
            <Card>
              <CardHeader>
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <Search className="size-4" aria-hidden="true" />
                  <span className="font-mono text-[0.6875rem] tracking-wide uppercase">
                    GET /api/search
                  </span>
                </div>
                <CardTitle>解析共享画板</CardTitle>
                <CardDescription>
                  粘贴你有权公开访问的 Milanote 分享链接，在线获取规范化数据。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={submit}>
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
            ) : boardDocument ? (
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
                  <JsonViewer value={boardDocument} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="grid min-h-[36rem] place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <Badge variant="outline">READY</Badge>
                  <h2 className="mt-4 text-base font-semibold">输入分享链接开始解析</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    结果将在这里以 Canvas 和 JSON 两种视图呈现。
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
