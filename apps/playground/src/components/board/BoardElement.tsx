import type { MilanoteNode } from "@milanote-api/parser";
import { ExternalLink, FileText, ImageIcon } from "lucide-react";
import { useContext, useId, useState, type ReactNode } from "react";
import { BoardLoadContext } from "./BoardLoadContext.ts";

import {
  formatCompactDate,
  getComments,
  getFileName,
  getFileSize,
  getImageUrl,
  getLinkUrl,
  getNodeChildren,
  getNodeDescription,
  getNodeLabel,
  getNodeTypeLabel,
  getTableRows,
  getTaskDueDate,
  isTaskComplete,
} from "@/utils/boardModel.ts";

interface BoardElementProps {
  depth?: number;
  node: MilanoteNode;
}

function Children({ children, depth }: { children: readonly MilanoteNode[]; depth: number }) {
  return children.map((child) => <BoardElement key={child.id} node={child} depth={depth + 1} />);
}

function Heading({
  children,
  depth,
  className,
}: {
  children: ReactNode;
  className?: string;
  depth: number;
}) {
  return (
    <div className={className} role="heading" aria-level={Math.min(depth + 2, 6)}>
      {children}
    </div>
  );
}

function InteractiveCount({
  accessibleLabel,
  count,
  descriptionId,
  visible,
}: {
  accessibleLabel: string;
  count: number;
  descriptionId: string;
  visible: boolean;
}) {
  return (
    <>
      <span id={descriptionId} className="sr-only">
        {accessibleLabel}
      </span>
      {visible ? (
        <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </>
  );
}

export function BoardElement({ depth = 0, node }: BoardElementProps) {
  const unloaded = useContext(BoardLoadContext);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const interactiveCountDescriptionId = useId();
  const children = getNodeChildren(node);
  const label = getNodeLabel(node);
  const description = getNodeDescription(node);
  const typeLabel = getNodeTypeLabel(node.type);
  const imageUrl = getImageUrl(node);
  const linkUrl = getLinkUrl(node);
  if (node.type === "BOARD" && unloaded.includes(node.id))
    return (
      <article className="glass-board-item rounded-lg border p-4">
        <strong>{label}</strong>
        <p className="mt-2 text-sm text-muted-foreground">子画板未展开</p>
      </article>
    );
  const showInteractiveCount = hasFocusWithin || isHovered;

  switch (node.type) {
    case "COLUMN":
      return (
        <section
          className="glass-board-column min-w-0 rounded-2xl border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-describedby={interactiveCountDescriptionId}
          aria-label={`Column: ${label}`}
          tabIndex={0}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setHasFocusWithin(false);
            }
          }}
          onFocusCapture={() => setHasFocusWithin(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <header className="mb-3 flex items-start justify-between gap-3 border-b pb-3">
            <Heading depth={depth} className="min-w-0 break-words text-sm font-semibold">
              {label}
            </Heading>
            <InteractiveCount
              accessibleLabel={`Items: ${children.length}`}
              count={children.length}
              descriptionId={interactiveCountDescriptionId}
              visible={showInteractiveCount}
            />
          </header>
          {children.length > 0 ? (
            <div className="grid gap-2.5">
              <Children children={children} depth={depth} />
            </div>
          ) : (
            <p className="py-5 text-center text-xs text-muted-foreground">Empty column</p>
          )}
        </section>
      );

    case "BOARD":
      return (
        <section className="glass-board-root min-w-0 rounded-2xl border p-3">
          <header className="mb-3">
            <Heading depth={depth} className="min-w-0 truncate text-sm font-semibold">
              {label}
            </Heading>
          </header>
          <div className="grid gap-2.5">
            <Children children={children} depth={depth} />
          </div>
        </section>
      );

    case "CARD":
      return (
        <article className="glass-board-item min-w-0 rounded-xl border border-primary/15 p-3">
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">{typeLabel}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{label}</p>
          {description ? (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
          {children.length > 0 ? (
            <div className="mt-3 grid gap-2 border-t pt-3">
              <Children children={children} depth={depth} />
            </div>
          ) : null}
        </article>
      );

    case "IMAGE":
      return (
        <figure className="glass-board-media min-w-0 overflow-hidden rounded-xl border">
          <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-muted/60">
            {imageUrl ? (
              <img
                className="size-full object-contain"
                src={imageUrl}
                alt={label === "Image" ? "" : label}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="grid place-items-center gap-2 text-muted-foreground"
                aria-hidden="true"
              >
                <ImageIcon className="size-7" />
                <span className="text-xs">No preview</span>
              </div>
            )}
          </div>
          <figcaption className="border-t bg-card/45 p-3">
            <span className="min-w-0 break-words text-sm">{label}</span>
          </figcaption>
        </figure>
      );

    case "FILE": {
      const fileName = getFileName(node);
      const fileSize = getFileSize(node);
      return (
        <article className="glass-board-item min-w-0 rounded-xl border p-3">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              {linkUrl ? (
                <a
                  className="block truncate rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={fileName}
                >
                  {fileName}
                </a>
              ) : (
                <p className="truncate text-sm font-medium" title={fileName}>
                  {fileName}
                </p>
              )}
              {fileSize ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground">{fileSize}</p>
              ) : null}
            </div>
          </div>
        </article>
      );
    }

    case "LINK": {
      const linkHost = linkUrl ? new URL(linkUrl).hostname : undefined;
      return (
        <article className="glass-board-item min-w-0 rounded-xl border p-3">
          {linkHost ? (
            <div className="mb-2 truncate font-mono text-xs text-muted-foreground">{linkHost}</div>
          ) : null}
          {linkUrl ? (
            <a
              className="inline-flex rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label}
              <ExternalLink className="ml-1 size-3.5" aria-hidden="true" />
            </a>
          ) : (
            <p className="text-sm font-medium">{label}</p>
          )}
          {description ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </article>
      );
    }

    case "TASK_LIST":
      return (
        <section className="glass-board-item min-w-0 rounded-xl border p-3">
          <header className="mb-2">
            <Heading depth={depth} className="text-sm font-semibold">
              {label}
            </Heading>
          </header>
          {children.length > 0 ? (
            <div className="grid gap-1">
              <Children children={children} depth={depth} />
            </div>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">No tasks</p>
          )}
        </section>
      );

    case "TASK": {
      const completed = isTaskComplete(node);
      const dueDate = getTaskDueDate(node);
      return (
        <div className="flex min-w-0 items-start gap-2 rounded px-1.5 py-2">
          <input
            className="mt-0.5 size-4 shrink-0 accent-primary"
            type="checkbox"
            checked={completed}
            disabled
            aria-label={completed ? `已完成：${label}` : `未完成：${label}`}
          />
          <span
            className={
              completed
                ? "min-w-0 break-words text-sm leading-5 text-muted-foreground line-through"
                : "min-w-0 break-words text-sm leading-5"
            }
          >
            {label}
          </span>
          {dueDate ? (
            <time
              className="ml-auto shrink-0 font-mono text-[0.6875rem] text-muted-foreground"
              dateTime={dueDate}
              title={dueDate}
            >
              {formatCompactDate(dueDate)}
            </time>
          ) : null}
        </div>
      );
    }

    case "TABLE": {
      const rows = getTableRows(node);
      return (
        <section className="glass-board-item min-w-0 overflow-hidden rounded-xl border">
          <header className="border-b p-3">
            <Heading depth={depth} className="text-sm font-semibold">
              {label}
            </Heading>
          </header>
          {rows.length > 0 ? (
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full border-collapse text-left text-xs">
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`${node.id}-row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${node.id}-cell-${rowIndex}-${cellIndex}`}
                          className="min-w-28 border-r border-b px-3 py-2 align-top last:border-r-0"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : children.length > 0 ? (
            <div className="grid gap-2 p-3">
              <Children children={children} depth={depth} />
            </div>
          ) : (
            <p className="p-3 text-xs text-muted-foreground">Empty table</p>
          )}
        </section>
      );
    }

    case "COMMENT_THREAD": {
      const comments = getComments(node);
      return (
        <aside
          className="glass-board-comment min-w-0 rounded-xl border border-l-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-describedby={interactiveCountDescriptionId}
          aria-label={label}
          tabIndex={0}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setHasFocusWithin(false);
            }
          }}
          onFocusCapture={() => setHasFocusWithin(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <header className="mb-2 flex items-center justify-between gap-3">
            <Heading
              depth={depth}
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {label}
            </Heading>
            <InteractiveCount
              accessibleLabel={`Comments: ${comments.length}`}
              count={comments.length}
              descriptionId={interactiveCountDescriptionId}
              visible={showInteractiveCount}
            />
          </header>
          {comments.length > 0 ? (
            <ol className="grid list-none gap-2">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg border bg-card/45 p-2.5 backdrop-blur">
                  {comment.author || comment.createdAt ? (
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-muted-foreground">
                      {comment.author ? (
                        <span className="font-medium">{comment.author}</span>
                      ) : null}
                      {comment.createdAt ? (
                        <time
                          className="font-mono"
                          dateTime={comment.createdAt}
                          title={comment.createdAt}
                        >
                          {formatCompactDate(comment.createdAt)}
                        </time>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-xs leading-5">
                    {comment.text}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">No comments</p>
          )}
          {children.length > 0 ? (
            <div className="mt-2 grid gap-2 border-t pt-2">
              <Children children={children} depth={depth} />
            </div>
          ) : null}
        </aside>
      );
    }

    case "SKELETON":
      return (
        <div className="glass-board-dashed min-w-0 rounded-xl border border-dashed px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">This item was not returned by the source.</p>
        </div>
      );

    case "UNKNOWN":
      return (
        <article className="glass-board-dashed min-w-0 rounded-xl border border-dashed p-3">
          <p className="break-words text-sm">{label}</p>
          <code className="mt-2 block max-w-full truncate font-mono text-[0.6875rem] text-muted-foreground">
            {node.id}
          </code>
          {children.length > 0 ? (
            <div className="mt-3 grid gap-2 border-t pt-3">
              <Children children={children} depth={depth} />
            </div>
          ) : null}
        </article>
      );

    default:
      return assertNever(node);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported normalized node: ${String(value)}`);
}
