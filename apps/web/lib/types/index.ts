/**
 * Centralized Type Definitions for ONEVYRT
 *
 * This module exports all shared types used across components, APIs, and business logic.
 * Importing from here ensures consistency and prevents type duplication.
 *
 * Usage:
 * ```typescript
 * import type { AsyncComponentProps, ApiResponse, ComponentSize } from '@/lib/types';
 * ```
 */

import type { CSSProperties, ReactNode } from "react";

// ════════════════════════════════════════════════════════════════════════════════
// React Component Props & Utilities
// ════════════════════════════════════════════════════════════════════════════════

/** Common size values for UI components */
export type ComponentSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Common color variants for UI components */
export type ColorVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "ghost";

/** Base props shared by most components */
export interface BaseComponentProps {
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
}

/** Props for components that can be disabled */
export interface DisableableProps {
  disabled?: boolean;
  ariaDisabled?: boolean;
}

/** Props for components that handle loading states */
export interface LoadableProps {
  isLoading?: boolean;
  loadingText?: string;
}

/** Props for components that can be read-only */
export interface ReadOnlyProps {
  readOnly?: boolean;
}

/** Props for async components (with error states) */
export interface AsyncComponentProps extends LoadableProps {
  error?: Error | null;
  onError?: (error: Error) => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// Button & Interactive Elements
// ════════════════════════════════════════════════════════════════════════════════

/** Button component variants */
export type ButtonVariant = ColorVariant | "outline" | "text" | "minimal";

/** Button HTML types */
export type ButtonType = "button" | "submit" | "reset";

/** Extended button props with standard attributes */
export interface ButtonProps
  extends BaseComponentProps,
    DisableableProps,
    ReadOnlyProps {
  variant?: ButtonVariant;
  size?: ComponentSize;
  type?: ButtonType;
  children: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  title?: string;
  ariaLabel?: string;
}

/** Icon button props (smaller, icon-only variant) */
export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  icon: ReactNode;
  ariaLabel: string; // Required for icon-only buttons
}

// ════════════════════════════════════════════════════════════════════════════════
// Card & Container Components
// ════════════════════════════════════════════════════════════════════════════════

/** Card layout variants */
export type CardVariant = "default" | "glass" | "surface" | "elevated" | "flat";

/** Card component props */
export interface CardProps extends BaseComponentProps {
  variant?: CardVariant;
  children: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  title?: ReactNode;
  footer?: ReactNode;
  bordered?: boolean;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

// ════════════════════════════════════════════════════════════════════════════════
// Form Elements
// ════════════════════════════════════════════════════════════════════════════════

/** Input types supported */
export type InputType =
  | "text"
  | "password"
  | "email"
  | "number"
  | "tel"
  | "date"
  | "time"
  | "search"
  | "url";

/** Base input props */
export interface InputProps extends BaseComponentProps, DisableableProps {
  type?: InputType;
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
  autoComplete?: string;
}

/** Select/Dropdown option */
export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Select component props */
export interface SelectProps<T = string | number>
  extends BaseComponentProps,
    DisableableProps {
  value?: T;
  onChange?: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  multiple?: boolean;
  ariaLabel?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// Business Domain Types
// ════════════════════════════════════════════════════════════════════════════════

/** Funnel stage in sales funnel */
export interface FunnelStage {
  id: string;
  name: string;
  visitors: number;
  conversions: number;
}

/** Editable funnel stage with conversion rate */
export interface EditableFunnelStage extends FunnelStage {
  conversionRate: number;
}

/** Funnel metrics derived from stages */
export interface FunnelMetrics {
  totalVisitors: number;
  totalConversions: number;
  overallConversionRate: number;
  stages: Array<FunnelStage & { conversionRate: number }>;
}

/** Status type for programme/chapter states */
export type StatusType =
  | "locked"
  | "available"
  | "in-progress"
  | "completed"
  | "awaiting-review"
  | "approved"
  | "rejected"
  | "skipped";

/** Enrollment stage */
export type EnrollmentStage = 1 | 2 | 3 | 4 | 5;

// ════════════════════════════════════════════════════════════════════════════════
// API & Network Types
// ════════════════════════════════════════════════════════════════════════════════

/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

/** Paginated API response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** HTTP error details */
export interface HttpError extends Error {
  status: number;
  statusText: string;
  url: string;
  responseBody?: unknown;
}

// ════════════════════════════════════════════════════════════════════════════════
// Event Handler Types
// ════════════════════════════════════════════════════════════════════════════════

/** Generic event handler */
export type EventHandler<E extends React.SyntheticEvent> = (
  event: E
) => void | Promise<void>;

/** Mouse event handler */
export type MouseEventHandler = EventHandler<React.MouseEvent<HTMLElement>>;

/** Keyboard event handler */
export type KeyboardEventHandler = EventHandler<React.KeyboardEvent<HTMLElement>>;

/** Change event handler for inputs */
export type ChangeEventHandler<T extends HTMLElement = HTMLInputElement> =
  EventHandler<React.ChangeEvent<T>>;

/** Callback function that returns void */
export type VoidCallback = () => void;

/** Callback function that returns a promise */
export type AsyncCallback<T = void> = () => Promise<T>;

// ════════════════════════════════════════════════════════════════════════════════
// Data Structure Types
// ════════════════════════════════════════════════════════════════════════════════

/** Partial object with all properties optional */
export type Partial<T> = {
  [K in keyof T]?: T[K];
};

/** Result type for operations that can fail */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/** Maybe/Optional type */
export type Maybe<T> = T | null | undefined;

// ════════════════════════════════════════════════════════════════════════════════
// Generic Component Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Props for a generic list component */
export interface ListProps<T> extends BaseComponentProps {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  empty?: ReactNode;
}

/** Props for a generic modal/dialog */
export interface DialogProps extends BaseComponentProps {
  open: boolean;
  onClose: VoidCallback;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

/** Props for a generic notification/toast */
export interface ToastProps extends BaseComponentProps {
  type?: "success" | "error" | "warning" | "info";
  message: ReactNode;
  duration?: number;
  onClose?: VoidCallback;
  action?: {
    label: string;
    onClick: VoidCallback;
  };
}

/** Props for a generic badge/label */
export interface BadgeProps extends BaseComponentProps {
  variant?: ColorVariant;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  icon?: ReactNode;
}

// ════════════════════════════════════════════════════════════════════════════════
// Type Guards & Utility Types
// ════════════════════════════════════════════════════════════════════════════════

/** Narrows a union type to exclude null and undefined */
export type NonNullable<T> = T extends null | undefined ? never : T;

/** Extracts the async return type of a promise */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/** Deeply readonly version of a type */
export type DeepReadonly<T> = T extends object
  ? {
      readonly [K in keyof T]: DeepReadonly<T[K]>;
    }
  : T;

// ════════════════════════════════════════════════════════════════════════════════
// Type Assertion Helpers
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Type guard to check if a value is not null or undefined
 * Usage: `values.filter(isDefined)` → values are narrowed to non-null type
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if an object is a specific type
 * Usage: `if (isObjectWithProperty(obj, 'property')) { ... }`
 */
export function isObjectWithProperty<T extends object>(
  value: unknown,
  property: keyof T
): value is T {
  return (
    typeof value === "object" &&
    value !== null &&
    property in value
  );
}

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if a value is an ApiResponse with data
 */
export function isSuccessResponse<T>(
  value: unknown
): value is ApiResponse<T> & { data: T } {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    (value as ApiResponse<T>).success === true &&
    "data" in value
  );
}

/**
 * Assert that a value is defined (non-null/undefined)
 * Useful in strict mode to narrow types
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || "Value is not defined");
  }
}

export default {
  isDefined,
  isObjectWithProperty,
  isError,
  isSuccessResponse,
  assertDefined,
};
