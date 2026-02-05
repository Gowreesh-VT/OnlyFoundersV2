import { Check } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, disabled }: CheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-sm border-2 transition-colors ${
        checked ? "border-primary bg-primary" : "border-gray-500 bg-transparent"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      aria-label="Checkbox"
    >
      {checked ? (
        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-background" strokeWidth={3} />
      ) : null}
    </button>
  );
}

