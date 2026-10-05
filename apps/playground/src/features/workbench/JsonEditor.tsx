import { lazy, Suspense, type ComponentProps } from "react";

const CodeMirrorEditor = lazy(() =>
  import("./CodeMirrorEditor.tsx").then((module) => ({ default: module.JsonEditor })),
);
export function JsonEditor(props: ComponentProps<typeof CodeMirrorEditor>) {
  return (
    <Suspense
      fallback={
        <div className="json-editor notice" role="status">
          正在载入编辑器…
        </div>
      }
    >
      <CodeMirrorEditor {...props} />
    </Suspense>
  );
}
