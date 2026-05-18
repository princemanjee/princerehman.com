import { InputHTMLAttributes, forwardRef } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[var(--glass-text)] font-medium px-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            backdrop-blur-[12px]
            bg-[var(--glass-background)]
            border border-[var(--glass-border)]
            rounded-xl
            px-4 py-2.5
            text-[var(--glass-text)]
            placeholder:text-[var(--glass-text-muted)]
            focus:bg-[var(--glass-background-hover)]
            focus:outline-none
            focus:ring-2
            focus:ring-white/30
            transition-all duration-300
            ${className}
          `}
          {...props}
        />
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";
