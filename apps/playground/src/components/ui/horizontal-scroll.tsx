import type { ReactNode } from "react";
import { ScrollArea } from "radix-ui";

/** Overlay scrollbars never change the tab row's height when overflow appears. */
export function HorizontalScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollArea.Root className="horizontal-scroll" type="hover" scrollHideDelay={300}>
      <ScrollArea.Viewport className="horizontal-viewport">{children}</ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="horizontal-scrollbar" orientation="horizontal">
        <ScrollArea.Thumb className="horizontal-thumb" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
