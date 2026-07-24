import type { MilanoteNode } from "@milanote-api/parser";

import { BoardElement } from "./BoardElement.tsx";

type BoardNode = Extract<MilanoteNode, { type: "BOARD" }>;

export function BoardCanvas({ board }: { board: BoardNode }) {
  const hasColumns = board.children.some((node) => node.type === "COLUMN");

  return (
    <section className="h-full min-h-[32rem] overflow-auto p-4 sm:p-5" aria-label="画板内容">
      <div
        className={
          hasColumns
            ? "board-grid-columns grid items-start gap-4"
            : "grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-start gap-4"
        }
      >
        {board.children.map((node) => (
          <BoardElement key={node.id} node={node} />
        ))}
      </div>
    </section>
  );
}
