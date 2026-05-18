import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ReactNode } from "react";

interface GlassScrollAreaProps {
  children: ReactNode;
  className?: string;
  height?: string;
}

export function GlassScrollArea({ children, className = "", height = "300px" }: GlassScrollAreaProps) {
  return (
    <ScrollArea.Root className={`overflow-hidden ${className}`} style={{ height }}>
      <ScrollArea.Viewport className="w-full h-full rounded-xl">
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="
          flex select-none touch-none p-0.5
          backdrop-blur-[8px]
          bg-[var(--glass-background)]
          border-l border-[var(--glass-border)]
          transition-colors duration-300
          hover:bg-[var(--glass-background-hover)]
          w-2.5
          rounded-full
          m-1
        "
      >
        <ScrollArea.Thumb
          className="
            flex-1
            bg-white/40
            rounded-full
            relative
            before:content-['']
            before:absolute
            before:top-1/2
            before:left-1/2
            before:-translate-x-1/2
            before:-translate-y-1/2
            before:w-full
            before:h-full
            before:min-w-[44px]
            before:min-h-[44px]
            hover:bg-white/60
            transition-colors duration-200
          "
        />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar
        orientation="horizontal"
        className="
          flex flex-col select-none touch-none p-0.5
          backdrop-blur-[8px]
          bg-[var(--glass-background)]
          border-t border-[var(--glass-border)]
          h-2.5
          rounded-full
          m-1
        "
      >
        <ScrollArea.Thumb
          className="
            flex-1
            bg-white/40
            rounded-full
            hover:bg-white/60
            transition-colors duration-200
          "
        />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner className="bg-transparent" />
    </ScrollArea.Root>
  );
}
