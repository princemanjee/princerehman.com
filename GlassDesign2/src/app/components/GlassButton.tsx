import { ButtonHTMLAttributes, ReactNode } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export function GlassButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: GlassButtonProps) {
  const variants = {
    primary: `
      backdrop-blur-[12px]
      bg-[var(--glass-background-active)]
      border-[var(--glass-border)]
      text-[var(--glass-text)]
      hover:bg-[var(--glass-background-hover)]
      hover:scale-105
      active:scale-95
    `,
    secondary: `
      backdrop-blur-[12px]
      bg-[var(--glass-background)]
      border-[var(--glass-border)]
      text-[var(--glass-text)]
      hover:bg-[var(--glass-background-hover)]
      hover:scale-105
      active:scale-95
    `,
    ghost: `
      backdrop-blur-[8px]
      bg-transparent
      border-transparent
      text-[var(--glass-text)]
      hover:bg-[var(--glass-background)]
      hover:border-[var(--glass-border)]
    `,
    destructive: `
      backdrop-blur-[12px]
      bg-red-500/30
      border-red-400/30
      text-white
      hover:bg-red-500/40
      hover:scale-105
      active:scale-95
    `
  };

  const sizes = {
    sm: "px-3 py-1.5 rounded-lg",
    md: "px-6 py-2.5 rounded-xl",
    lg: "px-8 py-3.5 rounded-2xl"
  };

  return (
    <button
      className={`
        ${variants[variant]}
        ${sizes[size]}
        border
        transition-all duration-300
        font-medium
        shadow-lg
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
