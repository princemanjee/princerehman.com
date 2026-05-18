import * as Dialog from "@radix-ui/react-dialog";
import { ReactNode } from "react";
import { X } from "lucide-react";
import { GlassButton } from "./GlassButton";

interface GlassModalProps {
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GlassModal({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange
}: GlassModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <Dialog.Trigger asChild>
          {trigger}
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed inset-0
            bg-black/40
            backdrop-blur-sm
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0
            data-[state=open]:fade-in-0
            z-50
          "
        />
        <Dialog.Content
          className="
            fixed
            left-1/2 top-1/2
            -translate-x-1/2 -translate-y-1/2
            backdrop-blur-[16px]
            bg-[var(--glass-background-active)]
            border border-[var(--glass-border)]
            rounded-2xl
            p-6
            shadow-2xl
            w-full max-w-md
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0
            data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:zoom-in-95
            data-[state=closed]:slide-out-to-left-1/2
            data-[state=closed]:slide-out-to-top-[48%]
            data-[state=open]:slide-in-from-left-1/2
            data-[state=open]:slide-in-from-top-[48%]
            z-50
          "
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-xl font-semibold text-[var(--glass-text)]">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-[var(--glass-text-muted)] mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                className="
                  rounded-lg
                  p-1.5
                  text-[var(--glass-text)]
                  hover:bg-[var(--glass-background-hover)]
                  transition-colors duration-200
                  outline-none
                  focus:ring-2
                  focus:ring-white/30
                "
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          <div className="text-[var(--glass-text)]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function GlassModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--glass-border)]">
      {children}
    </div>
  );
}
