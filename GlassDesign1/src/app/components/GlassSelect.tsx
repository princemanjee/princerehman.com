import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { ReactNode } from "react";

interface GlassSelectProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export function GlassSelect({ label, placeholder, value, onValueChange, children }: GlassSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-[var(--glass-text)] font-medium px-1">
          {label}
        </label>
      )}
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger
          className="
            backdrop-blur-[12px]
            bg-[var(--glass-background)]
            border border-[var(--glass-border)]
            rounded-xl
            px-4 py-2.5
            text-[var(--glass-text)]
            hover:bg-[var(--glass-background-hover)]
            focus:outline-none
            focus:ring-2
            focus:ring-white/30
            transition-all duration-300
            flex items-center justify-between
            min-w-[200px]
          "
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="w-4 h-4" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="
              backdrop-blur-[16px]
              bg-[var(--glass-background-active)]
              border border-[var(--glass-border)]
              rounded-xl
              p-2
              shadow-2xl
              overflow-hidden
            "
            position="popper"
            sideOffset={5}
          >
            <Select.Viewport>
              {children}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

export function GlassSelectItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Select.Item
      value={value}
      className="
        px-3 py-2
        rounded-lg
        text-[var(--glass-text)]
        hover:bg-[var(--glass-background-hover)]
        cursor-pointer
        flex items-center justify-between
        outline-none
        transition-colors duration-200
      "
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator>
        <Check className="w-4 h-4" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
