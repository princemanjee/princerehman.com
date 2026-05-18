import { ReactNode } from "react";

interface GlassBadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

export function GlassBadge({ children, variant = "default", className = "" }: GlassBadgeProps) {
  const variants = {
    default: "bg-[var(--glass-background-active)] border-[var(--glass-border)]",
    success: "bg-[#10b981]/30 border-[#10b981]/40 text-[#10b981]",
    warning: "bg-[#f97316]/30 border-[#f97316]/40 text-[#f97316]",
    error: "bg-red-500/30 border-red-400/30 text-red-100",
    info: "bg-blue-500/30 border-blue-400/30 text-blue-100"
  };

  return (
    <span
      className={`
        inline-flex items-center
        backdrop-blur-[12px]
        ${variants[variant]}
        border
        rounded-full
        px-3 py-1
        text-xs
        font-medium
        text-[var(--glass-text)]
        ${className}
      `}
    >
      {children}
    </span>
  );
}
