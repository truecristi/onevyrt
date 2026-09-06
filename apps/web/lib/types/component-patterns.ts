/**
 * Advanced TypeScript Patterns for Type-Safe Components
 *
 * This module provides patterns and utilities for building components
 * with maximum type safety, including generics, discriminated unions,
 * and advanced prop typing.
 */

import type {
  ReactNode,
  ForwardedRef,
  ComponentType,
} from "react";

// ════════════════════════════════════════════════════════════════════════════════
// Ref Forwarding with Type Safety
// ════════════════════════════════════════════════════════════════════════════════

/** Props for a component that forwards a ref */
export interface WithRefProps<RefType extends HTMLElement = HTMLDivElement> {
  ref?: ForwardedRef<RefType>;
}

/** Generic component props with proper ref forwarding.
 *  An intersection type, not `interface ... extends P` — P is an
 *  unconstrained generic, and TypeScript rejects an interface extending a
 *  generic type parameter that could redeclare `ref` incompatibly. `&`
 *  doesn't have that restriction. */
export type ComponentWithRef<
  P extends Record<string, unknown> = Record<string, unknown>,
  RefType extends HTMLElement = HTMLElement
> = P & {
  ref?: ForwardedRef<RefType>;
};

// ════════════════════════════════════════════════════════════════════════════════
// State Management Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Callback signature for state updates */
export type StateUpdater<T> = (prevState: T) => T;

/** Callback signature for state update operations */
export type SetStateAction<T> = T | StateUpdater<T>;

/** Props for a component managing internal state */
export interface StatefulComponentProps<T> {
  initialState: T;
  onChange?: (state: T) => void;
  onStateChange?: (state: T, prevState: T) => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// Data Transformation Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Callback for updating a specific field in a typed object */
export type FieldUpdater<T, K extends keyof T = keyof T> = (
  field: K,
  value: T[K]
) => void;

/** Callback for updating nested field in a typed object */
export type NestedFieldUpdater = (
  path: string,
  value: unknown
) => void;

/** Props for editable entity components */
export interface EditableEntityProps<T extends Record<string, unknown>> {
  entity: T;
  onUpdate: FieldUpdater<T>;
  onReset?: () => void;
  readOnly?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════════
// Async Operations & Loading States
// ════════════════════════════════════════════════════════════════════════════════

/** Status of an async operation */
export type AsyncStatus = "idle" | "loading" | "success" | "error";

/** Result of an async operation */
export interface AsyncState<T, E = Error> {
  status: AsyncStatus;
  data: T | null;
  error: E | null;
  isLoading: boolean;
}

/** Props for async operations */
export interface AsyncOperationProps<T, E = Error> extends AsyncState<T, E> {
  execute: () => Promise<T>;
  reset: () => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// Discriminated Union Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Discriminated union for form states */
export type FormState<T> =
  | { type: "idle" }
  | { type: "validating"; data: Partial<T> }
  | { type: "valid"; data: T }
  | { type: "invalid"; data: Partial<T>; errors: Record<keyof T, string> }
  | { type: "submitting"; data: T }
  | { type: "submitted"; data: T }
  | { type: "error"; error: Error };

/** Discriminated union for view modes */
export type ViewMode<T> =
  | { mode: "view"; data: T }
  | { mode: "edit"; data: T; onSave: (data: T) => void }
  | { mode: "create"; onSave: (data: T) => void };

// ════════════════════════════════════════════════════════════════════════════════
// Generic List & Collection Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Props for a generic list renderer */
export interface ListRendererProps<T extends { id: string | number }> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
  loading?: boolean;
  error?: Error | null;
  keyExtractor?: (item: T, index: number) => string | number;
}

/** Props for a filterable list */
export interface FilterableListProps<T extends Record<string, unknown> & { id: string | number }>
  extends ListRendererProps<T> {
  filter?: (item: T) => boolean;
  search?: string;
  searchKeys?: (keyof T)[];
}

/** Props for a sortable list */
export interface SortableListProps<T extends Record<string, unknown> & { id: string | number }>
  extends ListRendererProps<T> {
  sortBy?: keyof T;
  sortOrder?: "asc" | "desc";
  onSort?: (key: keyof T, order: "asc" | "desc") => void;
}

/** Props for a paginated list */
export interface PaginatedListProps<T extends { id: string | number }>
  extends ListRendererProps<T> {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// Render Props & Compound Component Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Children as render function */
export type RenderFunction<P = Record<string, unknown>> = (props: P) => ReactNode;

/** Props for render-prop components */
export interface RenderPropProps<P> {
  children: RenderFunction<P>;
}

/** Props for compound components with context */
export interface CompoundComponentContext<T> {
  state: T;
  dispatch: (action: unknown) => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// Event & Action Handling Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Action dispatched by a component */
export interface ComponentAction<T extends string = string, P = unknown> {
  type: T;
  payload?: P;
  timestamp: number;
  sourceId?: string;
}

/** Handler for component actions */
export type ActionHandler<T extends string = string, P = unknown> = (
  action: ComponentAction<T, P>
) => void | Promise<void>;

/** Reducer function for managing component state */
export type ComponentReducer<S, A extends ComponentAction> = (
  state: S,
  action: A
) => S;

// ════════════════════════════════════════════════════════════════════════════════
// Validation & Type Guards
// ════════════════════════════════════════════════════════════════════════════════

/** Validator function */
export type Validator<T> = (value: T) => { valid: true } | { valid: false; error: string };

/** Async validator function */
export type AsyncValidator<T> = (value: T) => Promise<{ valid: true } | { valid: false; error: string }>;

/** Props for validated input components */
export interface ValidatedInputProps<T> {
  value: T;
  onChange: (value: T) => void;
  validate?: Validator<T>;
  asyncValidate?: AsyncValidator<T>;
  error?: string | null;
}

// ════════════════════════════════════════════════════════════════════════════════
// HOC & Wrapper Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Type for a Higher-Order Component */
export type HOC<P = Record<string, unknown>, Q = Record<string, unknown>> = (
  Component: ComponentType<P>
) => ComponentType<P & Q>;

/** Props injected by withAsync HOC */
export interface WithAsyncProps<T, E = Error> {
  async: AsyncState<T, E>;
  execute: () => Promise<T>;
}

/** Props injected by withForm HOC */
export interface WithFormProps<T extends Record<string, unknown>> {
  form: T;
  setForm: (form: T) => void;
  updateField: FieldUpdater<T>;
  resetForm: () => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// Plugin & Extension Patterns
// ════════════════════════════════════════════════════════════════════════════════

/** Base plugin interface */
export interface ComponentPlugin<PluginConfig = Record<string, unknown>> {
  name: string;
  version: string;
  configure?: (config: PluginConfig) => void;
  install?: (context: PluginContext) => void;
  uninstall?: () => void;
}

/** Plugin context provided to components */
export interface PluginContext {
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// Utility Functions for Type Safety
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Creates a type-safe object from entries
 * @example
 * const obj = createObject([['key1', 'value1']] as const);
 */
export function createObject<const T extends readonly (readonly [string, unknown])[]>(
  entries: T
): Record<T[number][0], T[number][1]> {
  return Object.fromEntries(entries) as Record<T[number][0], T[number][1]>;
}

/**
 * Type-safe field updater factory
 * @example
 * const updateField = createFieldUpdater(form, setForm);
 */
export function createFieldUpdater<T extends Record<string, unknown>>(
  object: T,
  setObject: (obj: T) => void
): FieldUpdater<T> {
  return (field: keyof T, value: T[typeof field]) => {
    setObject({ ...object, [field]: value });
  };
}

/**
 * Creates a type-safe async handler
 * @example
 * const handler = createAsyncHandler(async (data) => { ... });
 */
export function createAsyncHandler<T, R>(
  handler: (data: T) => Promise<R>
): (data: T) => Promise<R | undefined> {
  return async (data: T) => {
    try {
      return await handler(data);
    } catch (error) {
      console.error("Async handler error:", error);
      return undefined;
    }
  };
}

/**
 * Creates a discriminated union handler
 * @example
 * const handle = createUnionHandler({
 *   idle: () => { ... },
 *   loading: () => { ... },
 * });
 */
export function createUnionHandler<T extends Record<string, (...args: any[]) => any>>(
  handlers: T
): (state: { type: keyof T } & any) => ReturnType<T[keyof T]> {
  return (state) => {
    const handler = handlers[state.type];
    return handler ? handler(state) : undefined;
  };
}

export default {
  createObject,
  createFieldUpdater,
  createAsyncHandler,
  createUnionHandler,
};
