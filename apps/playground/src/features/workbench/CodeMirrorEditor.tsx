import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";

export function JsonEditor({
  value,
  onChange,
  dark,
  readOnly = false,
  label = "JSON 请求体",
}: {
  value: string;
  onChange?: (value: string) => void;
  dark: boolean;
  readOnly?: boolean;
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView>(undefined);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      doc: value,
      extensions: [
        basicSetup,
        json(),
        ...(readOnly ? [] : [linter(jsonParseLinter())]),
        ...(dark ? [oneDark] : []),
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
        EditorView.contentAttributes.of({
          "aria-label": label,
          role: "textbox",
          "aria-multiline": "true",
          ...(readOnly ? { tabindex: "0" } : {}),
        }),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": { height: "100%", fontSize: "12px", backgroundColor: "transparent" },
          ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-mono)" },
          ".cm-gutters": { backgroundColor: "transparent", border: "none" },
          ".cm-content": { padding: "16px 0" },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callback.current?.(update.state.doc.toString());
        }),
      ],
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = undefined;
    };
    // Value is synchronized separately to preserve selection while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, label, readOnly]);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);
  return <div className="json-editor" ref={host} />;
}
