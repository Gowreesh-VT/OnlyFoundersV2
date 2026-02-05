interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
}

export function NumberInput({
  value,
  onChange,
  suffix,
  min,
  max,
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    const withinMin = min === undefined || newValue >= min;
    const withinMax = max === undefined || newValue <= max;
    if (Number.isFinite(newValue) && withinMin && withinMax) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex w-fit items-center rounded-sm border border-border bg-surface px-2 py-1.5 sm:px-3 sm:py-2">
      <input
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        className="w-12 bg-surface text-center text-sm font-semibold text-white outline-none sm:w-16 sm:text-base"
      />
      {suffix ? (
        <span className="ml-1.5 text-sm font-semibold text-gray-400 sm:ml-2 sm:text-base">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

