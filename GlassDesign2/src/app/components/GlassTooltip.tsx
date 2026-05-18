import * as Tooltip from "@radix-ui/react-tooltip";
import { ReactNode } from "react";

interface GlassTooltipProps {
  children: ReactNode;
  content: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function GlassTooltip({ children, content, side = "top" }: GlassTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={5}
            className="
              backdrop-blur-[16px]
              bg-[var(--glass-background-active)]
              border border-[var(--glass-border)]
              rounded-lg
              px-3 py-2
              text-sm
              text-[var(--glass-text)]
              shadow-xl
              max-w-xs
              animate-in
              fade-in-0
              zoom-in-95
              data-[state=closed]:animate-out
              data-[state=closed]:fade-out-0
              data-[state=closed]:zoom-out-95
              data-[side=bottom]:slide-in-from-top-2
              data-[side=left]:slide-in-from-right-2
              data-[side=right]:slide-in-from-left-2
              data-[side=top]:slide-in-from-bottom-2
            "
          >
            {content}
            <Tooltip.Arrow className="fill-[var(--glass-border)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
