import { milanoteDocumentSchema } from "@milanote-api/parser";
import { BoardCanvas } from "@/components/board/BoardCanvas.tsx";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Projected data stays partial. Never manufacture missing model fields to pass validation.
function ValuePreview({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (depth >= 12) return <pre className="preview-text">{JSON.stringify(value, null, 2)}</pre>;
  if (Array.isArray(value))
    return value.length ? (
      <ol className="preview-array">
        {value.map((item, index) => (
          <li key={index}>
            <ValuePreview value={item} depth={depth + 1} />
          </li>
        ))}
      </ol>
    ) : (
      <span className="preview-empty">[]</span>
    );
  if (record(value))
    return Object.keys(value).length ? (
      <dl className="preview-properties">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>
              <ValuePreview value={item} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    ) : (
      <span className="preview-empty">{"{}"}</span>
    );
  return (
    <span className="preview-value">
      {typeof value === "string" && value !== "" ? value : JSON.stringify(value)}
    </span>
  );
}

function ProjectedBoard({ node, depth = 0 }: { node: Record<string, unknown>; depth?: number }) {
  const { title, type, children, ...fields } = node;
  return (
    <article className="projected-node">
      <header>
        {typeof type === "string" && <span className="preview-type">{type}</span>}
        <h3>{typeof title === "string" && title ? title : "未返回标题"}</h3>
      </header>
      {Object.keys(fields).length > 0 && <ValuePreview value={fields} />}
      {Array.isArray(children) && children.length > 0 && (
        <div className="projected-children">
          {children.map((child, index) =>
            record(child) && depth < 12 ? (
              <ProjectedBoard key={index} node={child} depth={depth + 1} />
            ) : (
              <ValuePreview key={index} value={child} />
            ),
          )}
        </div>
      )}
      {children === undefined && <p className="preview-empty">此结果未包含子内容字段。</p>}
      {Array.isArray(children) && children.length === 0 && (
        <p className="preview-empty">子内容列表为空。</p>
      )}
    </article>
  );
}

export function ResponsePreview({
  parsed,
  text,
  unloadedBoardIds = [],
}: {
  parsed: unknown;
  text: string;
  unloadedBoardIds?: readonly string[];
}) {
  const data = record(parsed) && parsed.ok === true && "data" in parsed ? parsed.data : parsed;
  const full = milanoteDocumentSchema.safeParse(data);
  if (full.success)
    return (
      <>
        <div className="preview-board-title">{full.data.board.title || "未命名画板"}</div>
        <BoardCanvas board={full.data.board} unloadedBoardIds={unloadedBoardIds} />
      </>
    );
  if (record(data) && record(data.board))
    return (
      <div className="projection-preview">
        <p className="preview-hint">按实际返回字段预览，未返回的字段不会补全。</p>
        <ProjectedBoard node={data.board} />
      </div>
    );
  return (
    <div className="projection-preview">
      {parsed === undefined ? (
        <pre className="preview-text">{text || "响应正文为空"}</pre>
      ) : (
        <ValuePreview value={data} />
      )}
    </div>
  );
}
