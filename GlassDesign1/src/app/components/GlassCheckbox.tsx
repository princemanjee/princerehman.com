import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

interface GlassCheckboxProps {
  label?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
}

export function GlassCheckbox({ label, checked, onCheckedChange, id }: GlassCheckboxProps) {
  return (
    <div className="flex items-center gap-3">
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="
          backdrop-blur-[12px]
          bg-[var(--glass-background)]
          border-2 border-[var(--glass-border)]
          rounded-lg
          w-6 h-6
          flex items-center justify-center
          hover:bg-[var(--glass-background-hover)]
          focus:outline-none
          focus:ring-2
          focus:ring-white/30
          transition-all duration-300
          data-[state=checked]:bg-[var(--glass-background-active)]
          data-[state=checked]:border-white/40
        "
      >
        <CheckboxPrimitive.Indicator>
          <Check className="w-4 h-4 text-[var(--glass-text)]" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <label htmlFor={id} className="text-[var(--glass-text)] cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
}
