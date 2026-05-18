import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";

interface GlassNavigationProps {
  logo?: ReactNode;
  children: ReactNode;
}

export function GlassNavigation({ logo, children }: GlassNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav
      className="
        backdrop-blur-[16px]
        bg-[var(--glass-background)]
        border-b border-[var(--glass-border)]
        sticky top-0 z-50
        shadow-lg
      "
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            {logo && (
              <div className="text-[var(--glass-text)] font-bold">
                {logo}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2">
              {children}
            </div>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="
              md:hidden
              p-2 rounded-lg
              text-[var(--glass-text)]
              hover:bg-[var(--glass-background-hover)]
              transition-colors duration-200
            "
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="
            md:hidden
            backdrop-blur-[16px]
            bg-[var(--glass-background-active)]
            border-t border-[var(--glass-border)]
            px-4 py-4
            flex flex-col gap-2
          "
        >
          {children}
        </div>
      )}
    </nav>
  );
}

export function GlassNavLink({ href, children, active = false }: { href: string; children: ReactNode; active?: boolean }) {
  return (
    <a
      href={href}
      className={`
        px-4 py-2
        rounded-xl
        text-[var(--glass-text)]
        transition-all duration-300
        ${active
          ? "bg-[var(--glass-background-active)] border border-[var(--glass-border)]"
          : "hover:bg-[var(--glass-background-hover)]"
        }
      `}
    >
      {children}
    </a>
  );
}
