import type { MilanoteDocument } from "@milanote-api/parser";
import { Activity, Braces, DatabaseZap, LayoutDashboard, RefreshCw, ServerCog } from "lucide-react";

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
  const { boardDocument, error, isLoading, load, status } = useBoardApi({ fetcher });
  const boardTitle = boardDocument ? getNodeLabel(boardDocument.board) : "Board inspector";

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
                  <ServerCog className="size-4" aria-hidden="true" />
                  <span className="font-mono text-[0.6875rem] tracking-wide uppercase">Source</span>
                </div>
                <CardTitle>已配置的共享画板</CardTitle>
                <CardDescription>
                  当前版本从 Worker Secret 读取分享链接。在线搜索将在后续 API commit 接入。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-md border bg-muted/50 p-3">
                  <p className="text-[0.6875rem] text-muted-foreground uppercase">Endpoint</p>
                  <code className="mt-1 block font-mono text-xs">GET /api/board</code>
                </div>
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  onClick={() => void load()}
                >
                  <RefreshCw className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
                  {isLoading ? "正在解析" : "重新抓取"}
                </Button>
              </CardContent>
            </Card>

            {boardDocument ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">响应摘要</CardTitle>
                </CardHeader>
                <CardContent>
                  <BoardSummary document={boardDocument} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 bg-workspace p-3 sm:p-4 lg:p-5" aria-live="polite">
          <div className="h-full min-h-[36rem] overflow-hidden rounded-xl border bg-card shadow-sm">
            {isLoading && !boardDocument ? (
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
            ) : error && !boardDocument ? (
              <div className="grid h-full min-h-[36rem] place-items-center p-6">
                <Alert className="max-w-lg border-destructive/30 bg-destructive/5">
                  <Badge variant="destructive" className="mb-2">
                    {error.code}
                  </Badge>
                  <AlertTitle>无法载入画板</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                  <Button
                    className="mt-3 w-fit"
                    type="button"
                    variant="outline"
                    onClick={() => void load()}
                  >
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

                {error ? (
                  <Alert className="m-4 w-auto border-destructive/30 bg-destructive/5">
                    <AlertTitle>刷新失败，仍显示上一次结果</AlertTitle>
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                ) : null}

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
              <div className="grid min-h-[36rem] place-items-center text-sm text-muted-foreground">
                等待画板数据
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
