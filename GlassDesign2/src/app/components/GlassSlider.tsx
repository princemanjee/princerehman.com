import * as SliderPrimitive from "@radix-ui/react-slider";

interface GlassSliderProps {
  label?: string;
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function GlassSlider({
  label,
  value = [50],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = ""
}: GlassSliderProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[var(--glass-text)] font-medium">
            {label}
          </label>
          <span className="text-[var(--glass-text-muted)]">
            {value[0]}
          </span>
        </div>
      )}
      <SliderPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        className="relative flex items-center w-full h-6 cursor-pointer"
      >
        <SliderPrimitive.Track
          className="
            relative h-2 w-full rounded-full
            backdrop-blur-[12px]
            bg-[var(--glass-background)]
            border border-[var(--glass-border)]
            overflow-hidden
          "
        >
          <SliderPrimitive.Range
            className="
              absolute h-full
              bg-gradient-to-r from-white/40 to-white/60
              rounded-full
            "
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="
            block w-5 h-5 rounded-full
            backdrop-blur-[12px]
            bg-[var(--glass-background-active)]
            border-2 border-white/60
            shadow-lg
            hover:scale-110
            focus:outline-none
            focus:ring-2
            focus:ring-white/30
            transition-transform duration-200
          "
        />
      </SliderPrimitive.Root>
    </div>
  );
}
