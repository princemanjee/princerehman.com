interface GlassDividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  label?: string;
}

export function GlassDivider({ orientation = "horizontal", className = "", label }: GlassDividerProps) {
  if (label) {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <div className="flex-1 h-px bg-[var(--glass-border)]" />
        <span className="text-sm text-[var(--glass-text-muted)]">{label}</span>
        <div className="flex-1 h-px bg-[var(--glass-border)]" />
      </div>
    );
  }

  if (orientation === "vertical") {
    return (
      <div className={`w-px bg-[var(--glass-border)] ${className}`} />
    );
  }

  return (
    <div className={`h-px bg-[var(--glass-border)] ${className}`} />
  );
}
