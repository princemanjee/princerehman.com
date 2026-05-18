import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "hover" | "elevated";
}

export function GlassCard({ children, className = "", variant = "default" }: GlassCardProps) {
  const variants = {
    default: "backdrop-blur-[12px] bg-[var(--glass-background)]",
    hover: "backdrop-blur-[12px] bg-[var(--glass-background)] hover:bg-[var(--glass-background-hover)] transition-all duration-300",
    elevated: "backdrop-blur-[16px] bg-[var(--glass-background-active)]"
  };

  return (
    <div
      className={`
        ${variants[variant]}
        border border-[var(--glass-border)]
        rounded-2xl
        shadow-[var(--glass-shadow)]
        ${className}
      `}
      style={{
        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)"
      }}
    >
      {children}
    </div>
  );
}

export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`
        backdrop-blur-[12px]
        bg-[var(--glass-background)]
        border border-[var(--glass-border)]
        rounded-3xl
        p-8
        ${className}
      `}
      style={{
        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)"
      }}
    >
      {children}
    </div>
  );
}
