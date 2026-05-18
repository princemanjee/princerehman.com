import * as Tabs from "@radix-ui/react-tabs";
import { ReactNode } from "react";

interface GlassTabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}

export function GlassTabs({ defaultValue, children, className = "" }: GlassTabsProps) {
  return (
    <Tabs.Root defaultValue={defaultValue} className={className}>
      {children}
    </Tabs.Root>
  );
}

export function GlassTabsList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Tabs.List
      className={`
        backdrop-blur-[12px]
        bg-[var(--glass-background)]
        border border-[var(--glass-border)]
        rounded-xl
        p-1.5
        inline-flex
        gap-1
        ${className}
      `}
    >
      {children}
    </Tabs.List>
  );
}

export function GlassTabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="
        px-4 py-2
        rounded-lg
        text-[var(--glass-text)]
        transition-all duration-300
        hover:bg-[var(--glass-background-hover)]
        data-[state=active]:bg-[var(--glass-background-active)]
        data-[state=active]:shadow-lg
        outline-none
        focus:ring-2
        focus:ring-white/30
      "
    >
      {children}
    </Tabs.Trigger>
  );
}

export function GlassTabsContent({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Tabs.Content
      value={value}
      className="
        mt-4
        outline-none
        focus:ring-2
        focus:ring-white/30
        rounded-xl
      "
    >
      {children}
    </Tabs.Content>
  );
}
