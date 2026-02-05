import { useRef } from "react";
import { Clock } from "lucide-react";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimeInput({ value, onChange }: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (inputRef.current) {
      // Prefer native picker when available
      if (typeof inputRef.current.showPicker === "function") {
        inputRef.current.showPicker();
      } else {
        inputRef.current.click();
      }
    }
  };

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-label="Select time"
      />
      <button
        type="button"
        onClick={openPicker}
        className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface text-gray-300 transition-colors hover:border-primary hover:text-primary"
        aria-label="Open time picker"
      >
        <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </div>
  );
}

