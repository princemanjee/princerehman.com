import * as Progress from "@radix-ui/react-progress";

interface GlassProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function GlassProgress({
  value,
  max = 100,
  label,
  showValue = true,
  className = ""
}: GlassProgressProps) {
  const percentage = (value / max) * 100;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-[var(--glass-text)] font-medium">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-[var(--glass-text-muted)]">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <Progress.Root
        value={value}
        max={max}
        className="
          relative
          overflow-hidden
          backdrop-blur-[12px]
          bg-[var(--glass-background)]
          border border-[var(--glass-border)]
          rounded-full
          w-full
          h-3
        "
      >
        <Progress.Indicator
          className="
            bg-gradient-to-r from-white/60 to-white/80
            w-full h-full
            transition-transform duration-500 ease-out
            rounded-full
          "
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </Progress.Root>
    </div>
  );
}
