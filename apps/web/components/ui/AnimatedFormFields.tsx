/**
 * ONEVYRT Animated Form Fields — Input fields with smooth animations.
 *
 * Features:
 * - Floating labels with animated transitions
 * - Focus state animations and highlights
 * - Error state with shaking animation
 * - Success checkmark animation on valid input
 * - Tooltip reveal animations
 * - Loading spinner for async validation
 * - Smooth transition between states
 * - Accessibility: ARIA labels, focus states, error messages
 *
 * Usage:
 *   <AnimatedTextInput
 *     label="Email"
 *     placeholder="Enter your email"
 *     error={errors.email}
 *     success={validated.email}
 *   />
 */

import { useState, useRef, useEffect } from "react";
import { STATUS_COLORS } from "@/lib/colors/chapter-tokens";

export interface AnimatedTextInputProps {
  /** Input label */
  label?: string;

  /** Input placeholder */
  placeholder?: string;

  /** Input type */
  type?: "text" | "email" | "password" | "number" | "url" | "tel";

  /** Current value */
  value?: string;

  /** Change handler */
  onChange?: (value: string) => void;

  /** Blur handler */
  onBlur?: () => void;

  /** Focus handler */
  onFocus?: () => void;

  /** Error message */
  error?: string;

  /** Success state */
  success?: boolean;

  /** Help text */
  help?: string;

  /** Loading state */
  isLoading?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Required indicator */
  required?: boolean;

  /** Input name */
  name?: string;

  /** CSS className */
  className?: string;
}

export function AnimatedTextInput({
  label,
  placeholder,
  type = "text",
  value = "",
  onChange,
  onBlur,
  onFocus,
  error,
  success = false,
  help,
  isLoading = false,
  disabled = false,
  required = false,
  name,
  className = "",
}: AnimatedTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger shake animation on error
  const triggerError = () => {
    if (!inputRef.current) return;
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  useEffect(() => {
    if (error) triggerError();
    // Only re-trigger when the error message itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const hasValue = value.length > 0;
  const showLabel = isFocused || hasValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")}>
      <div className="relative">
        {/* Floating label */}
        {label && (
          <label
            htmlFor={name}
            className={`absolute left-0 text-sm font-medium transition-all duration-200 pointer-events-none ${
              showLabel ? "translate-y-0 text-xs" : "translate-y-4"
            }`}
            style={{
              color: error ? STATUS_COLORS.rejected : isFocused ? "#088057" : "#475569",
              top: showLabel ? "2px" : "auto",
              transform: showLabel ? "translateY(-1.5rem)" : "translateY(0)",
            }}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Input field */}
        <div className="relative">
          <input
            ref={inputRef}
            type={type}
            name={name}
            value={value}
            placeholder={placeholder}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            className={[
              "w-full px-4 py-2 rounded-md border-2 transition-all duration-200",
              "bg-ds-surface",
              isFocused ? "ring-2 ring-offset-0" : "",
              isShaking ? "animate-shake" : "",
              disabled ? "opacity-50 cursor-not-allowed" : "",
              error ? "border-red-500" : success ? "border-green-500" : "border-ds-border-default",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              borderColor: error
                ? STATUS_COLORS.rejected
                : success
                  ? STATUS_COLORS.approved
                  : isFocused
                    ? "#088057"
                    : "var(--ds-border-default)",
              boxShadow: isFocused
                ? `0 0 0 3px ${error ? "#fca5a520" : success ? "#d1fae520" : "#e7f6f020"}`
                : "none",
              paddingTop: label ? "1.5rem" : "0.5rem",
            }}
            aria-label={label || placeholder}
            aria-invalid={!!error}
            aria-describedby={error ? `error-${name}` : help ? `help-${name}` : undefined}
          />

          {/* Right icons (loading, success, error) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isLoading && (
              <div
                className="w-4 h-4 border-2 border-transparent rounded-full animate-spin"
                style={{
                  borderTopColor: "#088057",
                  borderRightColor: "#088057",
                }}
              />
            )}
            {!isLoading && success && (
              <div className="text-lg animate-scaleIn" style={{ color: STATUS_COLORS.approved }}>
                ✓
              </div>
            )}
            {error && !isLoading && (
              <div className="text-lg" style={{ color: STATUS_COLORS.rejected }}>
                ⚠
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p
          id={`error-${name}`}
          className="text-sm font-medium mt-1 animate-slideUp"
          style={{ color: STATUS_COLORS.rejected }}
        >
          {error}
        </p>
      )}

      {/* Help text */}
      {help && !error && (
        <p
          id={`help-${name}`}
          className="text-sm text-ds-text-tertiary mt-1 animate-slideUp"
        >
          {help}
        </p>
      )}
    </div>
  );
}

/**
 * Animated Select Input — Dropdown with smooth animations.
 */
export interface AnimatedSelectProps {
  label?: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export function AnimatedSelect({
  label,
  options,
  value = "",
  onChange,
  error,
  disabled = false,
  className = "",
  name,
}: AnimatedSelectProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")}>
      {label && (
        <label className="ds-label" htmlFor={name}>
          {label}
        </label>
      )}

      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className={[
            "w-full px-4 py-2 rounded-md border-2 transition-all duration-200 appearance-none",
            "bg-ds-surface",
            disabled ? "opacity-50 cursor-not-allowed" : "",
            error ? "border-red-500" : "border-ds-border-default",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            borderColor: error
              ? STATUS_COLORS.rejected
              : isFocused
                ? "#088057"
                : "var(--ds-border-default)",
            boxShadow: isFocused
              ? `0 0 0 3px ${error ? "#fca5a520" : "#e7f6f020"}`
              : "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23475569' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 1rem center",
            paddingRight: "2.5rem",
          }}
          aria-invalid={!!error}
        >
          <option value="">Select an option...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm font-medium mt-1 animate-slideUp" style={{ color: STATUS_COLORS.rejected }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Animated Text Area — Multi-line input with smooth animations.
 */
export interface AnimatedTextAreaProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  help?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  name?: string;
  maxLength?: number;
}

export function AnimatedTextArea({
  label,
  placeholder,
  value = "",
  onChange,
  error,
  help,
  disabled = false,
  rows = 4,
  className = "",
  name,
  maxLength,
}: AnimatedTextAreaProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")}>
      {label && (
        <label className="ds-label" htmlFor={name}>
          {label}
        </label>
      )}

      <div className="relative">
        <textarea
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={[
            "w-full px-4 py-2 rounded-md border-2 transition-all duration-200 resize-none",
            "bg-ds-surface",
            disabled ? "opacity-50 cursor-not-allowed" : "",
            error ? "border-red-500" : "border-ds-border-default",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            borderColor: error
              ? STATUS_COLORS.rejected
              : isFocused
                ? "#088057"
                : "var(--ds-border-default)",
            boxShadow: isFocused
              ? `0 0 0 3px ${error ? "#fca5a520" : "#e7f6f020"}`
              : "none",
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `error-${name}` : help ? `help-${name}` : undefined}
        />

        {maxLength && (
          <span className="absolute right-3 bottom-2 text-xs text-ds-text-tertiary">
            {value.length} / {maxLength}
          </span>
        )}
      </div>

      {error && (
        <p
          id={`error-${name}`}
          className="text-sm font-medium mt-1 animate-slideUp"
          style={{ color: STATUS_COLORS.rejected }}
        >
          {error}
        </p>
      )}

      {help && !error && (
        <p
          id={`help-${name}`}
          className="text-sm text-ds-text-tertiary mt-1 animate-slideUp"
        >
          {help}
        </p>
      )}
    </div>
  );
}

/**
 * Animated Form Wrapper — Container for animated form fields with consistent styling.
 */
export function AnimatedForm({
  children,
  onSubmit,
  className = "",
}: {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={["space-y-4", className].filter(Boolean).join(" ")}
    >
      {children}
    </form>
  );
}
