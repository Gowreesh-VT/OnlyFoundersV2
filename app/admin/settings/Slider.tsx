interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const mid = (min + max) / 2;

  return (
    <div className="space-y-3 sm:space-y-4">
      {label ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 sm:text-sm">{label}</span>
          <span className="text-sm font-semibold text-primary sm:text-base">{value}h</span>
        </div>
      ) : null}
      <div className="relative flex items-center pt-2">
        <input
          id="slider-native"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-700 sm:h-3 accent-primary"
          style={{
            background: `linear-gradient(to right, #EAB308 0%, #EAB308 ${percentage}%, #374151 ${percentage}%, #374151 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute -translate-y-[11px] h-7 w-7 rounded-full bg-primary sm:h-8 sm:w-8"
          style={{ left: `calc(${percentage}% - 12px)` }}
        />
      </div>
      <div className="flex justify-between pt-2 text-xs text-gray-500 sm:text-sm">
        <span>{min}h</span>
        <span>{mid}h</span>
        <span>{max}h</span>
      </div>
      <style jsx global>{`
        input#slider-native::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
          border: none;
          background: transparent;
        }
        input#slider-native::-moz-range-thumb {
          width: 0;
          height: 0;
          border: none;
          background: transparent;
        }
        input#slider-native::-ms-thumb {
          width: 0;
          height: 0;
          border: none;
          background: transparent;
        }
      `}</style>
    </div>
  );
}

