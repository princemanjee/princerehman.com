interface GlassSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GlassSpinner({ size = "md", className = "" }: GlassSpinnerProps) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4"
  };

  return (
    <div
      className={`
        ${sizes[size]}
        border-[var(--glass-border)]
        border-t-white
        rounded-full
        animate-spin
        ${className}
      `}
    />
  );
}

export function GlassSkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`
        backdrop-blur-[12px]
        bg-[var(--glass-background)]
        border border-[var(--glass-border)]
        rounded-2xl
        p-6
        ${className}
      `}
    >
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-white/20 rounded-full w-3/4" />
        <div className="h-4 bg-white/20 rounded-full w-1/2" />
        <div className="h-4 bg-white/20 rounded-full w-5/6" />
      </div>
    </div>
  );
}
