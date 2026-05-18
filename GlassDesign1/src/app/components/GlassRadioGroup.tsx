import * as RadioGroup from "@radix-ui/react-radio-group";

interface RadioOption {
  value: string;
  label: string;
}

interface GlassRadioGroupProps {
  options: RadioOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  label?: string;
}

export function GlassRadioGroup({ options, value, onValueChange, label }: GlassRadioGroupProps) {
  return (
    <div className="flex flex-col gap-3">
      {label && (
        <label className="text-[var(--glass-text)] font-medium">
          {label}
        </label>
      )}
      <RadioGroup.Root value={value} onValueChange={onValueChange} className="flex flex-col gap-2">
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-3">
            <RadioGroup.Item
              value={option.value}
              id={option.value}
              className="
                w-6 h-6
                backdrop-blur-[12px]
                bg-[var(--glass-background)]
                border-2 border-[var(--glass-border)]
                rounded-full
                hover:bg-[var(--glass-background-hover)]
                focus:outline-none
                focus:ring-2
                focus:ring-white/30
                transition-all duration-300
              "
            >
              <RadioGroup.Indicator
                className="
                  flex items-center justify-center
                  w-full h-full
                  relative
                  after:content-['']
                  after:block
                  after:w-3
                  after:h-3
                  after:rounded-full
                  after:bg-white
                "
              />
            </RadioGroup.Item>
            <label
              htmlFor={option.value}
              className="text-[var(--glass-text)] cursor-pointer"
            >
              {option.label}
            </label>
          </div>
        ))}
      </RadioGroup.Root>
    </div>
  );
}
