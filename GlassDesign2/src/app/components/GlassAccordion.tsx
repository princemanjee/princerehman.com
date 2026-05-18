import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";

interface GlassAccordionProps {
  children: ReactNode;
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  className?: string;
}

export function GlassAccordion({
  children,
  type = "single",
  defaultValue,
  className = ""
}: GlassAccordionProps) {
  return (
    <Accordion.Root
      type={type as any}
      defaultValue={defaultValue}
      className={`
        backdrop-blur-[12px]
        bg-[var(--glass-background)]
        border border-[var(--glass-border)]
        rounded-xl
        overflow-hidden
        ${className}
      `}
    >
      {children}
    </Accordion.Root>
  );
}

export function GlassAccordionItem({
  value,
  trigger,
  children
}: {
  value: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="border-b border-[var(--glass-border)] last:border-b-0">
      <Accordion.Header>
        <Accordion.Trigger
          className="
            w-full
            flex items-center justify-between
            px-6 py-4
            text-[var(--glass-text)]
            hover:bg-[var(--glass-background-hover)]
            transition-all duration-300
            group
            outline-none
          "
        >
          <span className="font-medium">{trigger}</span>
          <ChevronDown
            className="
              w-5 h-5
              transition-transform duration-300
              group-data-[state=open]:rotate-180
            "
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content
        className="
          overflow-hidden
          text-[var(--glass-text-muted)]
          data-[state=open]:animate-accordion-down
          data-[state=closed]:animate-accordion-up
        "
      >
        <div className="px-6 pb-4">
          {children}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
