import * as SwitchPrimitive from "@radix-ui/react-switch";

interface GlassSwitchProps {
  label?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
}

export function GlassSwitch({ label, checked, onCheckedChange, id }: GlassSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="
          w-11 h-6
          backdrop-blur-[12px]
          bg-[var(--glass-background)]
          border border-[var(--glass-border)]
          rounded-full
          relative
          cursor-pointer
          transition-all duration-300
          data-[state=checked]:bg-[var(--glass-background-active)]
          hover:bg-[var(--glass-background-hover)]
          focus:outline-none
          focus:ring-2
          focus:ring-white/30
        "
      >
        <SwitchPrimitive.Thumb
          className="
            block w-4 h-4
            bg-white
            rounded-full
            shadow-lg
            transition-transform duration-300
            translate-x-1
            data-[state=checked]:translate-x-6
          "
        />
      </SwitchPrimitive.Root>
      {label && (
        <label htmlFor={id} className="text-[var(--glass-text)] cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
}
