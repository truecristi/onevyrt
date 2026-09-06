# TypeScript Strict Mode & Type Safety Guide

## Overview

ONEVYRT has been upgraded to **100% TypeScript strict mode** with comprehensive type safety across all components, business logic, and API integrations. This guide documents the standards and patterns for maintaining type safety.

## Table of Contents

1. [Configuration](#configuration)
2. [Core Principles](#core-principles)
3. [Component Type Patterns](#component-type-patterns)
4. [Business Logic Types](#business-logic-types)
5. [API Type Safety](#api-type-safety)
6. [Event Handlers](#event-handlers)
7. [Async Operations](#async-operations)
8. [Type Guards & Assertions](#type-guards--assertions)
9. [Common Patterns](#common-patterns)
10. [Migration Guide](#migration-guide)
11. [Troubleshooting](#troubleshooting)

---

## Configuration

### TypeScript Compiler Options

**File:** `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "useUnknownInCatchVariables": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Type Checking

Run type checking with:

```bash
# Check all files
pnpm typecheck

# Watch mode for development
pnpm typecheck --watch

# Strict checks on build
pnpm build  # TypeScript check runs before webpack
```

---

## Core Principles

### 1. Never Use `any`

❌ **Bad:**
```typescript
const updateField = (id: string, field: string, value: any) => {
  // 'any' defeats type safety
  setState({ ...state, [field]: value });
};
```

✅ **Good:**
```typescript
const updateField = <K extends keyof State>(
  field: K,
  value: State[K]
) => {
  setState({ ...state, [field]: value });
};
```

### 2. Explicit Types on Functions

❌ **Bad:**
```typescript
const handler = (event) => {
  // Implicit 'any' on event parameter
  console.log(event.target.value);
};
```

✅ **Good:**
```typescript
const handler = (event: React.ChangeEvent<HTMLInputElement>) => {
  console.log(event.target.value);
};
```

### 3. Null/Undefined Safety

❌ **Bad:**
```typescript
const name = user.profile.name; // Could throw if user or profile is null

const value = config.settings[key].value; // No bounds checking
```

✅ **Good:**
```typescript
const name = user?.profile?.name; // Optional chaining

const value = config?.settings?.[key]?.value; // Safe nested access

const fallback = user.name ?? "Anonymous"; // Nullish coalescing
```

### 4. Discriminated Unions Over `any`

❌ **Bad:**
```typescript
type State = {
  status: string;
  data: any; // Could be anything
};
```

✅ **Good:**
```typescript
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: UserData }
  | { status: "error"; error: Error };
```

---

## Component Type Patterns

### Basic Component Props

**Pattern:** Define a typed `Props` interface for every component.

```typescript
import type { ReactNode, CSSProperties } from "react";
import type { ButtonProps as BaseButtonProps } from "@/lib/types";

interface CustomButtonProps extends BaseButtonProps {
  icon?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  children,
  icon,
  isLoading,
  loadingText,
  ...rest
}) => {
  return (
    <button {...rest}>
      {isLoading ? loadingText : children}
    </button>
  );
};
```

### Generic Components

**Pattern:** Use generics for reusable components that work with any data type.

```typescript
interface ListProps<T extends { id: string | number }> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
}

export function List<T extends { id: string | number }>({
  items,
  renderItem,
  empty,
}: ListProps<T>) {
  return (
    <>
      {items.length === 0 ? (
        empty
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={item.id}>{renderItem(item, i)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

// Usage
const users: User[] = [...];
<List items={users} renderItem={(user) => user.name} />
```

### Ref Forwarding

**Pattern:** Properly type ref forwarding with `React.forwardRef`.

```typescript
import { forwardRef } from "react";
import type { InputProps } from "@/lib/types";

interface CustomInputProps extends InputProps {
  label?: string;
}

export const CustomInput = forwardRef<
  HTMLInputElement,
  CustomInputProps
>(({ label, ...props }, ref) => {
  return (
    <div>
      {label && <label>{label}</label>}
      <input ref={ref} {...props} />
    </div>
  );
});

CustomInput.displayName = "CustomInput";
```

---

## Business Logic Types

### Funnel Stages

```typescript
import type { EditableFunnelStage, FunnelMetrics } from "@/lib/types";

const stages: EditableFunnelStage[] = [
  {
    id: "1",
    name: "Awareness",
    visitors: 10000,
    conversions: 500,
    conversionRate: 5,
  },
  // ...
];

// Type-safe updates
const updateStage = <K extends keyof EditableFunnelStage>(
  id: string,
  field: K,
  value: EditableFunnelStage[K]
) => {
  setStages((prev) =>
    prev.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    )
  );
};

updateStage("1", "visitors", 20000); // ✅ Type-safe
updateStage("1", "unknownField", 100); // ❌ TypeScript error
```

### Status Types

```typescript
import type { StatusType, EnrollmentStage } from "@/lib/types";

function getStatusColor(status: StatusType): string {
  switch (status) {
    case "locked":
      return "#6b7280";
    case "available":
      return "#3b82f6";
    case "in-progress":
      return "#f59e0b";
    case "completed":
      return "#10b981";
    case "awaiting-review":
      return "#f59e0b";
    case "approved":
      return "#10b981";
    case "rejected":
      return "#ef4444";
    case "skipped":
      return "#d1d5db";
  }
}

const currentStage: EnrollmentStage = 3;
```

---

## API Type Safety

### Response Types

```typescript
import type { ApiResponse, PaginatedResponse } from "@/lib/types";

// Typed API call
async function fetchUser(id: string): Promise<ApiResponse<UserData>> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// Usage with type guard
const response = await fetchUser("123");

if (response.success && response.data) {
  // response.data is narrowed to UserData
  console.log(response.data.email);
} else {
  // response.error is narrowed to ErrorDetails
  console.error(response.error?.message);
}
```

### Paginated Responses

```typescript
import type { PaginatedResponse } from "@/lib/types";

async function fetchUsers(page: number = 1): Promise<
  PaginatedResponse<UserData>
> {
  const res = await fetch(`/api/users?page=${page}`);
  const data: PaginatedResponse<UserData> = await res.json();
  return data;
}

// Usage
const { items, page, total, hasMore } = await fetchUsers(1);
items.forEach((user) => {
  // user is typed as UserData
  console.log(user.email);
});
```

### Error Handling

```typescript
import type { ApiResponse } from "@/lib/types";
import { isSuccessResponse } from "@/lib/types";

async function handleApiCall() {
  const response = await fetch("/api/endpoint");
  const data: ApiResponse<ResultData> = await response.json();

  if (isSuccessResponse(data)) {
    // data.data is guaranteed to be defined
    return data.data;
  } else {
    throw new Error(data.error?.message ?? "Unknown error");
  }
}
```

---

## Event Handlers

### Properly Typed Event Handlers

```typescript
import type { MouseEventHandler, KeyboardEventHandler } from "@/lib/types";

interface FormProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function MyForm({ onSubmit, onChange }: FormProps) {
  const handleClick: MouseEventHandler = (event) => {
    event.preventDefault();
    console.log(event.button);
  };

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (event.key === "Enter") {
      console.log("Enter pressed");
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input onChange={onChange} onKeyDown={handleKeyDown} />
      <button onClick={handleClick}>Submit</button>
    </form>
  );
}
```

### useCallback with Proper Types

```typescript
import { useCallback } from "react";

interface FormData {
  email: string;
  password: string;
}

// ✅ Good: types explicitly stated
const handleChange = useCallback<
  (field: keyof FormData, value: string) => void
>((field, value) => {
  setFormData((prev) => ({ ...prev, [field]: value }));
}, []);

// ✅ Also good: inferred from context
const handleSubmit = useCallback(
  (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // ...
  },
  []
);
```

---

## Async Operations

### Async State Pattern

```typescript
import type { AsyncState, AsyncComponentProps } from "@/lib/types";

function useFetchData<T>(url: string): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: "idle",
    data: null,
    error: null,
    isLoading: false,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setState((s) => ({ ...s, status: "loading", isLoading: true }));

      try {
        const res = await fetch(url);
        const data: T = await res.json();

        if (!cancelled) {
          setState({
            status: "success",
            data,
            error: null,
            isLoading: false,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            isLoading: false,
          });
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
```

### Result Type for Operations

```typescript
import type { Result } from "@/lib/types";

async function validateEmail(email: string): Promise<Result<boolean>> {
  try {
    const res = await fetch(`/api/validate-email?email=${email}`);
    const data = await res.json();

    if (data.valid) {
      return { ok: true, value: true };
    } else {
      return { ok: false, error: new Error("Invalid email") };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Network error"),
    };
  }
}

// Usage
const result = await validateEmail("user@example.com");

if (result.ok) {
  console.log("Email is valid:", result.value);
} else {
  console.error("Validation failed:", result.error.message);
}
```

---

## Type Guards & Assertions

### Built-in Type Guards

```typescript
import {
  isDefined,
  isError,
  isSuccessResponse,
  isObjectWithProperty,
  assertDefined,
} from "@/lib/types";

// Filter out null/undefined
const values = [1, null, 2, undefined, 3];
const defined = values.filter(isDefined); // [1, 2, 3]

// Check if value is Error
try {
  // ...
} catch (error) {
  if (isError(error)) {
    console.error(error.message);
  }
}

// Check API response
const response = await fetchData();
if (isSuccessResponse(response)) {
  console.log(response.data); // data is guaranteed to exist
}

// Assert at runtime
function processUser(user: User | null) {
  assertDefined(user, "User must be defined");
  // user is now narrowed to User (non-null)
  console.log(user.name);
}
```

### Custom Type Guards

```typescript
// Custom discriminated union guard
function isSuccessState(
  state: AsyncState<unknown>
): state is AsyncState<unknown> & { status: "success"; data: unknown } {
  return state.status === "success" && state.data !== null;
}

// Custom property check
function hasEmail<T>(
  obj: T
): obj is T & { email: string } {
  return typeof obj === "object" && obj !== null && "email" in obj;
}

// Usage
if (isSuccessState(asyncState)) {
  console.log(asyncState.data); // narrowed to non-null
}

if (hasEmail(user)) {
  console.log(user.email); // email property is guaranteed
}
```

---

## Common Patterns

### Field Updater Pattern

```typescript
import type { FieldUpdater } from "@/lib/types";

interface UserForm {
  name: string;
  email: string;
  age: number;
}

const updateField: FieldUpdater<UserForm> = (field, value) => {
  setForm((prev) => ({ ...prev, [field]: value }));
};

// Type-safe usage
updateField("name", "John"); // ✅
updateField("age", 30); // ✅
updateField("email", "john@example.com"); // ✅
updateField("invalid", "value"); // ❌ TypeScript error
```

### Render Props Pattern

```typescript
import type { RenderFunction, RenderPropProps } from "@/lib/types";

interface UserListProps extends RenderPropProps<{ user: User }> {
  users: User[];
}

export function UserList({ users, children }: UserListProps) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{children({ user })}</li>
      ))}
    </ul>
  );
}

// Usage
<UserList users={users}>
  {({ user }) => <div>{user.name}</div>}
</UserList>
```

### Compound Component Pattern

```typescript
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

interface TabContextType {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function Tabs({
  children,
  defaultTab,
}: {
  children: ReactNode;
  defaultTab: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabContext.Provider value={{ activeTab, onTabChange: setActiveTab }}>
      {children}
    </TabContext.Provider>
  );
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("Tab must be used within Tabs");
  }

  return (
    context.activeTab === id && <div>{children}</div>
  );
}
```

---

## Migration Guide

### Migrating Existing Components

#### Step 1: Add Props Interface

```typescript
// Before
export function Button({ variant, size, children, ...props }) {
  // ...
}

// After
import type { ButtonProps } from "@/lib/types";

interface CustomButtonProps extends ButtonProps {
  icon?: ReactNode;
}

export function Button({ variant, size, children, icon, ...props }: CustomButtonProps) {
  // ...
}
```

#### Step 2: Type Event Handlers

```typescript
// Before
const handleClick = (e) => {
  console.log(e.target);
};

// After
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log(e.currentTarget);
};
```

#### Step 3: Replace `any` with Specific Types

```typescript
// Before
const updateValue = (value: any) => {
  setState(value);
};

// After
const updateValue = (value: string | number) => {
  setState(value);
};

// Or better with generics
const updateValue = <T extends string | number>(value: T) => {
  setState(value);
};
```

#### Step 4: Add Type Guards

```typescript
// Before
if (response.success) {
  console.log(response.data); // Could be undefined
}

// After
if (response.success && response.data) {
  console.log(response.data); // Guaranteed to exist
}
```

---

## Troubleshooting

### Common TypeScript Errors

#### Error: `Parameter 'x' implicitly has an 'any' type`

**Solution:** Explicitly type the parameter.

```typescript
// ❌ Error
const handler = (e) => { ... };

// ✅ Fix
const handler = (e: React.MouseEvent<HTMLElement>) => { ... };
```

#### Error: `Cannot find name 'x'` or `'x' does not exist`

**Solution:** Import from the correct types module.

```typescript
// ✅ Correct
import type { ButtonProps } from "@/lib/types";

// ✅ Or from component patterns
import type { FieldUpdater } from "@/lib/types/component-patterns";
```

#### Error: `Property 'x' is missing in type 'Y' but required in type 'Z'`

**Solution:** Ensure all required props are provided.

```typescript
// ✅ Correct
<Button variant="primary" disabled={false}>Click</Button>

// With optional props
<Button variant="primary">Click</Button>
```

#### Error: `Object is possibly 'null' or 'undefined'`

**Solution:** Use optional chaining or explicit null checks.

```typescript
// ✅ Safe
const value = obj?.property?.nested?.value;

// ✅ With guard
if (obj && obj.property) {
  console.log(obj.property.value);
}

// ✅ With assertion (use carefully)
const value = obj!.property!.value; // Asserts obj is defined
```

### Type Checking Best Practices

1. **Run typecheck before committing:**
   ```bash
   pnpm typecheck
   ```

2. **Enable IDE type checking:**
   - VSCode: TypeScript extension is built-in
   - Ensure workspace version uses project TypeScript

3. **Review type errors in CI:**
   - TypeScript check runs on `pnpm build`
   - PR build status reflects type safety

4. **Document complex types:**
   ```typescript
   /**
    * Discriminated union for state management
    * - idle: Initial state, no operation running
    * - loading: Operation in progress
    * - success: Operation completed successfully, data available
    * - error: Operation failed, error details available
    */
   type AsyncState = ...
   ```

---

## References

- [TypeScript Handbook - Type Checking](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html)
- [TypeScript Handbook - Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Type Safety at Airbnb](https://www.typescriptlang.org/case-studies/airbnb)

---

## Questions or Issues?

For questions about type safety patterns or to report type-related issues:

1. Check this guide and `lib/types/index.ts`
2. Review similar components for patterns
3. Ask in the #engineering-typescript channel
4. Create an issue with "type-safety" label

Last Updated: 2026-09-03
