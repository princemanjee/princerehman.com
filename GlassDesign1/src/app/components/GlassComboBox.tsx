import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";

interface ComboBoxOption {
  value: string;
  label: string;
}

interface GlassComboBoxProps {
  options: ComboBoxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function GlassComboBox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  label
}: GlassComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-[var(--glass-text)] font-medium px-1">
          {label}
        </label>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className="
              backdrop-blur-[12px]
              bg-[var(--glass-background)]
              border border-[var(--glass-border)]
              rounded-xl
              px-4 py-2.5
              text-[var(--glass-text)]
              hover:bg-[var(--glass-background-hover)]
              focus:outline-none
              focus:ring-2
              focus:ring-white/30
              transition-all duration-300
              flex items-center justify-between
              min-w-[200px]
            "
          >
            <span className={selectedOption ? "" : "text-[var(--glass-text-muted)]"}>
              {selectedOption?.label || placeholder}
            </span>
            <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="
              backdrop-blur-[16px]
              bg-[var(--glass-background-active)]
              border border-[var(--glass-border)]
              rounded-xl
              p-2
              shadow-2xl
              w-[var(--radix-popover-trigger-width)]
              max-h-[300px]
              overflow-auto
            "
            sideOffset={5}
            align="start"
          >
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="
                w-full
                backdrop-blur-[8px]
                bg-[var(--glass-background)]
                border border-[var(--glass-border)]
                rounded-lg
                px-3 py-2
                text-[var(--glass-text)]
                placeholder:text-[var(--glass-text-muted)]
                focus:outline-none
                focus:ring-2
                focus:ring-white/30
                mb-2
              "
            />
            <div className="flex flex-col gap-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-[var(--glass-text-muted)] text-center">
                  No results found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onValueChange?.(option.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="
                      px-3 py-2
                      rounded-lg
                      text-[var(--glass-text)]
                      hover:bg-[var(--glass-background-hover)]
                      cursor-pointer
                      flex items-center justify-between
                      outline-none
                      transition-colors duration-200
                      text-left
                    "
                  >
                    {option.label}
                    {value === option.value && (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
