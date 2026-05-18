import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface GlassDropdownProps {
  trigger: ReactNode;
  children: ReactNode;
}

export function GlassDropdown({ trigger, children }: GlassDropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="
            backdrop-blur-[16px]
            bg-[var(--glass-background-active)]
            border border-[var(--glass-border)]
            rounded-xl
            p-2
            shadow-2xl
            min-w-[200px]
            animate-in
            fade-in-0
            zoom-in-95
          "
          sideOffset={5}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function GlassDropdownItem({
  children,
  onSelect,
  disabled = false
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className="
        px-3 py-2
        rounded-lg
        text-[var(--glass-text)]
        hover:bg-[var(--glass-background-hover)]
        cursor-pointer
        outline-none
        transition-colors duration-200
        data-[disabled]:opacity-50
        data-[disabled]:cursor-not-allowed
      "
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function GlassDropdownSeparator() {
  return (
    <DropdownMenu.Separator className="h-px bg-[var(--glass-border)] my-1" />
  );
}

export function GlassDropdownSub({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        className="
          px-3 py-2
          rounded-lg
          text-[var(--glass-text)]
          hover:bg-[var(--glass-background-hover)]
          cursor-pointer
          outline-none
          transition-colors duration-200
          flex items-center justify-between
        "
      >
        {trigger}
        <ChevronRight className="w-4 h-4 ml-2" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          className="
            backdrop-blur-[16px]
            bg-[var(--glass-background-active)]
            border border-[var(--glass-border)]
            rounded-xl
            p-2
            shadow-2xl
            min-w-[200px]
          "
          sideOffset={8}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}
