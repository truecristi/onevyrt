import { useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

const fieldBase =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/** Label, hint and error are all wired to the input via id/aria - never colour alone (§12). */
export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-900">
        {label}
      </label>
      {hint && (
        <span id={hintId} className="text-xs text-gray-500">
          {hint}
        </span>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${fieldBase} ${error ? "border-red-600" : ""} ${className}`}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
