import { Braces, CircleHelp } from "lucide-react";
import { Tooltip } from "radix-ui";
import { readFields } from "./model.ts";
import {
  chooseFieldMode,
  cleanFieldRules,
  fieldMode,
  fieldModes,
  rulesFor,
} from "./field-rules.ts";

const ruleHints = [
  {
    label: "通配符",
    description:
      "* 匹配一级字段，** 匹配任意层级。请搭配字段路径使用，单独的 * 或 ** 会被自动移除。",
  },
  {
    label: "board.*",
    description:
      "匹配 board 下的所有一级字段，例如 board.title、board.children。选中对象或数组时包含其内容。",
  },
  {
    label: "**.location",
    description: "匹配任意层级的 location 字段，包括根画板和嵌套节点的位置数据。",
  },
] as const;

function FieldRuleHints() {
  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="selector-hints" aria-label="字段路径说明">
        {ruleHints.map((hint) => (
          <Tooltip.Root key={hint.label}>
            <Tooltip.Trigger type="button" aria-label={`${hint.label}说明`}>
              {hint.label === "通配符" ? (
                <>
                  <CircleHelp size={12} />
                  通配符
                </>
              ) : (
                <code>{hint.label}</code>
              )}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="selector-tooltip"
                side="top"
                sideOffset={7}
                collisionPadding={12}
              >
                {hint.description}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
}

export function RequestFields({ raw, onChange }: { raw: string; onChange: (raw: string) => void }) {
  const body = readFields(raw);
  if (!body) return <div className="notice">JSON 草稿格式无效，请在 JSON 标签中修正。</div>;
  const mode = fieldMode(body);
  const change = (next: Record<string, unknown>) => onChange(JSON.stringify(next, null, 2));
  function updateRules(key: "include" | "exclude", values: string[]): void {
    if (!body) return;
    const next = { ...body, [key]: values };
    if (key === "include") {
      delete next.view;
      delete next.exclude;
    } else {
      delete next.include;
      next.view = "full";
    }
    change(next);
  }
  return (
    <div className="panel-scroll form-fields">
      <div className="field-heading">
        <Braces size={15} />
        <span>请求参数</span>
        <small>application/json</small>
      </div>
      <label className="field-label" htmlFor="share-url">
        Milanote 分享链接 <span className="required">必填</span>
      </label>
      <input
        id="share-url"
        type="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://app.milanote.com/…?p=…"
        value={typeof body.url === "string" ? body.url : ""}
        onChange={(event) => change({ ...body, url: event.target.value })}
      />
      <p className="field-help">从 Milanote 的分享菜单复制公开链接。</p>
      <fieldset className="field-options">
        <legend className="field-label">读取范围</legend>
        <div className="preset-buttons">
          {(
            [
              ["root", "根画板"],
              ["tree", "完整递归"],
            ] as const
          ).map(([scope, name]) => (
            <button
              key={scope}
              aria-pressed={(body.scope ?? "root") === scope}
              onClick={() => change({ ...body, scope })}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="field-help" aria-live="polite">
          {body.scope === "tree"
            ? "递归读取子画板，画板越多请求越多。"
            : "根画板通常只需 2 次上游请求，子画板保留入口。"}
        </p>
      </fieldset>
      <fieldset className="field-options">
        <legend className="field-label">返回字段</legend>
        <div className="preset-buttons">
          {fieldModes.map((option) => (
            <button
              key={option.id}
              aria-pressed={mode === option.id}
              onClick={() => change(chooseFieldMode(body, option.id))}
            >
              {option.name}
            </button>
          ))}
        </div>
        <p className="field-help" aria-live="polite">
          {fieldModes.find((option) => option.id === mode)?.description}
        </p>
      </fieldset>
      {(["exclude", ...(mode === "custom" ? ["include" as const] : [])] as const).map((key) => (
        <div className="rule-field" key={key}>
          <label className="field-label" htmlFor={`selectors-${key}`}>
            {key === "exclude" ? "排除字段" : "保留字段"}
            <span>每行一条路径</span>
          </label>
          <textarea
            id={`selectors-${key}`}
            rows={4}
            spellCheck={false}
            placeholder={key === "exclude" ? "**.location\n**.timestamps" : "board.id\nboard.title"}
            value={rulesFor(body, key)
              .filter((value): value is string => typeof value === "string")
              .join("\n")}
            onChange={(event) => updateRules(key, event.target.value.split("\n"))}
            onBlur={(event) => {
              const rules = cleanFieldRules(event.target.value.split("\n"));
              if (rules.join("\n") !== event.target.value) change({ ...body, [key]: rules });
            }}
          />
          <FieldRuleHints />
        </div>
      ))}
      {mode === "custom" && (
        <p className="field-help">保留字段与排除字段互斥，编辑一项会清空另一项。</p>
      )}
    </div>
  );
}
