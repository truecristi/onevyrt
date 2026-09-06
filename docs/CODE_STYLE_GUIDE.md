# ONEVYRT Code Style Guide

## Overview
This guide defines consistent coding standards for ONEVYRT's TypeScript, React, and Next.js codebase. All team members should follow these conventions to maintain code quality and readability.

## Table of Contents
1. [General Principles](#general-principles)
2. [TypeScript](#typescript)
3. [React Components](#react-components)
4. [Naming Conventions](#naming-conventions)
5. [Code Organization](#code-organization)
6. [Comments & Documentation](#comments--documentation)
7. [Formatting](#formatting)
8. [Error Handling](#error-handling)
9. [Testing](#testing)

## General Principles

### 1. Readability First
Code is read far more often than it is written. Optimize for clarity and maintainability.

```typescript
// ✅ Good - clear intent
const isUserEligible = user.age >= 18 && user.hasVerifiedEmail;

// ❌ Poor - cryptic
const ue = u.a >= 18 && u.ve;
```

### 2. DRY (Don't Repeat Yourself)
Extract repeated logic into reusable functions or utilities.

```typescript
// ✅ Good - reusable utility
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

const price = formatCurrency(99.99);
const total = formatCurrency(sum);

// ❌ Poor - repeated logic
const price = '$' + (99.99).toFixed(2);
const total = '$' + (sum).toFixed(2);
```

### 3. SOLID Principles
- Single Responsibility: One function = one purpose
- Open/Closed: Open for extension, closed for modification
- Liskov Substitution: Subtypes must be substitutable
- Interface Segregation: Many specific interfaces > one general
- Dependency Inversion: Depend on abstractions, not concrete implementations

### 4. Type Safety
Always use TypeScript's type system. Avoid `any` unless absolutely necessary.

```typescript
// ✅ Good - explicit types
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

function getUser(id: string): Promise<User> {
  // Implementation
}

// ❌ Poor - implicit any
function getUser(id) {
  // Implementation
}
```

## TypeScript

### Type Annotations

**Always annotate function signatures:**

```typescript
// ✅ Good
function calculateDiscount(price: number, percentage: number): number {
  return price * (1 - percentage / 100);
}

// ❌ Poor - return type missing
function calculateDiscount(price: number, percentage: number) {
  return price * (1 - percentage / 100);
}
```

**Use interfaces for complex types:**

```typescript
// ✅ Good
interface AuthRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

function authenticate(request: AuthRequest): Promise<AuthToken> {
  // Implementation
}

// ❌ Poor - inline object
function authenticate(request: { email: string; password: string }): Promise<any> {
  // Implementation
}
```

### Union Types & Type Guards

Use union types for multiple possible values:

```typescript
// ✅ Good - explicit union
type Status = 'idle' | 'loading' | 'success' | 'error';

function handleStatus(status: Status) {
  switch (status) {
    case 'idle':
    case 'loading':
      return <Spinner />;
    case 'success':
      return <Success />;
    case 'error':
      return <Error />;
  }
}

// ❌ Poor - using strings directly
function handleStatus(status: string) {
  // No type safety
}
```

### Optional vs Nullability

```typescript
// ✅ Good - clear intent
interface User {
  id: string;
  email: string;
  phone?: string;      // Optional: might not be provided
  avatar: string | null; // Nullable: explicitly can be null
}

// ❌ Poor - unclear
interface User {
  id: string | undefined;
  email: string | null;
  phone: string | null | undefined;
}
```

### Generic Types

Use generics for reusable, type-safe functions:

```typescript
// ✅ Good - generic function
function getById<T>(list: T[], id: string): T | undefined {
  return list.find(item => item.id === id);
}

const user = getById<User>(users, 'user-1');
const project = getById<Project>(projects, 'proj-1');

// ❌ Poor - repeated logic for each type
function getUserById(users: User[], id: string): User | undefined {
  return users.find(user => user.id === id);
}

function getProjectById(projects: Project[], id: string): Project | undefined {
  return projects.find(project => project.id === id);
}
```

### Avoid `any`

```typescript
// ✅ Good - specific type
const user: User = JSON.parse(userJson);

// Somewhat acceptable if you must
const data: unknown = JSON.parse(userJson);
if (isUser(data)) {
  // Now data is User
}

// ❌ Avoid - loses type safety
const user: any = JSON.parse(userJson);
```

## React Components

### Functional Components Only

Always use functional components with hooks. Class components are deprecated.

```typescript
// ✅ Good - functional component
function UserCard({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  
  if (!user) return <Loading />;
  return <div>{user.name}</div>;
}

// ❌ Avoid - class component
class UserCard extends React.Component {
  state = { user: null };
  componentDidMount() {
    fetchUser(this.props.userId).then(user => this.setState({ user }));
  }
  render() {
    return <div>{this.state.user?.name}</div>;
  }
}
```

### Component Structure

```typescript
// 1. Imports
import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { useUser } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import styles from './UserProfile.module.css';

// 2. Types
interface UserProfileProps {
  userId: string;
  onClose?: () => void;
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

// 3. Component
export function UserProfile({ userId, onClose }: UserProfileProps) {
  const [state, setState] = useState<UserState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // 4. Hooks
  const router = useRouter();
  const { trackEvent } = useTracking();

  // 5. Effects
  useEffect(() => {
    fetchUserData();
  }, [userId]);

  // 6. Handlers
  const fetchUserData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const user = await getUser(userId);
      setState({ user, isLoading: false, error: null });
      trackEvent('user_profile_loaded', { userId });
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, [userId, trackEvent]);

  const handleNavigate = useCallback(() => {
    router.push(`/users/${userId}`);
    onClose?.();
  }, [userId, router, onClose]);

  // 7. Render
  if (state.isLoading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} />;
  if (!state.user) return <EmptyState />;

  return (
    <div className={styles.container}>
      <Card>
        <h2>{state.user.name}</h2>
        <p>{state.user.email}</p>
        <Button onClick={handleNavigate}>View Profile</Button>
      </Card>
    </div>
  );
}

// 8. Exports
export type { UserProfileProps };
```

### Props

**Define props interfaces:**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={isLoading}
      {...rest}
    >
      {isLoading ? <Spinner /> : children}
    </button>
  );
}
```

### Hooks Usage

**Follow hooks rules:**

```typescript
// ✅ Good - hooks at top level
function Component() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  useEffect(() => {
    // Side effect logic
  }, [count, name]);
}

// ❌ Poor - conditional hooks
function Component({ show }: { show: boolean }) {
  if (show) {
    const [count, setCount] = useState(0); // ❌ Conditional hook!
  }
}

// ❌ Poor - hooks in loops
function Component() {
  const items = ['a', 'b', 'c'];
  items.forEach(() => {
    useEffect(() => {}); // ❌ Hook in loop!
  });
}
```

**Extract complex logic into custom hooks:**

```typescript
// ✅ Good - custom hook
function useUserProfile(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchUser(userId).then(user => {
      setUser(user);
      setIsLoading(false);
    });
  }, [userId]);
  
  return { user, isLoading };
}

function UserProfile({ userId }: { userId: string }) {
  const { user, isLoading } = useUserProfile(userId);
  if (isLoading) return <Loading />;
  return <div>{user?.name}</div>;
}
```

### Conditional Rendering

```typescript
// ✅ Good - explicit and readable
if (isLoading) return <LoadingState />;
if (error) return <ErrorState error={error} />;
if (!data?.length) return <EmptyState />;

return <DataList items={data} />;

// ✅ Acceptable - simple conditions
return status === 'success' ? <SuccessUI /> : <FailureUI />;

// ❌ Avoid - nested ternaries
return isLoading ? <Loading /> : error ? <Error /> : data?.length ? <List /> : <Empty />;

// ❌ Avoid - logical AND for rendering
return isVisible && <Component />; // Can render 'false' or '0'

// ✅ Better
return isVisible ? <Component /> : null;
```

### Keys in Lists

```typescript
// ✅ Good - unique stable ID
<ul>
  {items.map(item => (
    <li key={item.id}>{item.name}</li>
  ))}
</ul>

// ⚠️ Acceptable - when index is stable
<ul>
  {staticItems.map((item, index) => (
    <li key={`${category}-${index}`}>{item}</li>
  ))}
</ul>

// ❌ Poor - index as key with dynamic lists
{dynamicItems.map((item, index) => (
  <li key={index}>{item}</li> // Causes bugs when items reorder/add/remove
))}

// ❌ Poor - no key
{items.map(item => (
  <li>{item.name}</li>
))}
```

## Naming Conventions

### Variables & Functions

```typescript
// ✅ Good - descriptive names
const userCount = 42;
const isAuthenticated = true;
const cachedData = new Map();

function calculateUserAge(birthDate: Date): number {
  // Implementation
}

function formatCurrencyAmount(amount: number): string {
  // Implementation
}

// ❌ Poor - unclear or too short
const uc = 42;
const auth = true;
const c = new Map();

function calc(bd: Date): number {
  // Implementation
}

function fmt(a: number): string {
  // Implementation
}
```

### Constants

```typescript
// ✅ Good - UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ✅ Good - camelCase for config objects
const paginationConfig = {
  pageSize: 20,
  maxPages: 100,
};

// ❌ Poor - lowercase for constants
const max_retry_attempts = 3;
const maxRetryAttempts = 3; // Should be UPPER_SNAKE_CASE
```

### Booleans

Always prefix boolean variables with `is`, `has`, `should`, `can`, or `will`:

```typescript
// ✅ Good
const isLoading = true;
const hasError = false;
const shouldShowModal = true;
const canDelete = user.isAdmin;
const willRetry = attemptCount < MAX_ATTEMPTS;

// ❌ Poor
const loading = true;
const error = false;
const showModal = true;
```

### Exported Components

```typescript
// ✅ Good - PascalCase
export function UserProfile() { }
export function SettingsPage() { }
export const UserCard: React.FC<UserCardProps> = ({ user }) => { };

// ❌ Poor - camelCase
export function userProfile() { }
export const userCard: React.FC = ({ user }) => { };
```

## Code Organization

### File Size

Keep files focused and reasonably sized:

```
✅ Ideal: 200-400 lines per file
⚠️  Acceptable: up to 500 lines
❌ Refactor: > 500 lines (split into smaller files)
```

### Import Organization

```typescript
// 1. React and Next.js
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party libraries
import axios from 'axios';

// 3. Internal utilities and hooks
import { useTracking } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';

// 4. Internal components
import { Button, Card } from '@/components/ui';

// 5. Types and constants
import type { User } from '@/types';
import { API_ENDPOINT } from '@/constants';

// 6. Styles
import styles from './Component.module.css';
```

### Module Exports

```typescript
// ✅ Good - named exports
export function Button() { }
export function Card() { }

// For default exports, use named exports instead
export { Button as default } from './Button';

// ✅ Good - export types
export type { ButtonProps } from './Button';

// ❌ Avoid - default export for components
export default function Button() { }
```

## Comments & Documentation

### Component Documentation

```typescript
/**
 * UserCard - Displays a condensed user profile card
 * 
 * Features:
 * - Shows user avatar, name, and bio
 * - Links to full profile page
 * - Supports hover preview
 * 
 * @component
 * @example
 * // Basic usage
 * return <UserCard userId="user-123" />
 * 
 * @example
 * // With click handler
 * return <UserCard userId="user-123" onClick={handleClick} />
 * 
 * @param {UserCardProps} props - Component props
 * @returns {React.ReactElement} Rendered component
 * 
 * @see User profile page at /profile/[id]
 * @see UserAvatar component for avatar rendering
 */
export function UserCard({ userId, onClick }: UserCardProps) {
  // Implementation
}
```

### Function Documentation

```typescript
/**
 * Calculates the discount amount based on base price and percentage
 * 
 * @param {number} basePrice - The original price before discount
 * @param {number} discountPercent - Discount percentage (0-100)
 * @returns {number} The discount amount (not the final price)
 * 
 * @throws {RangeError} If discount percent is outside 0-100 range
 * 
 * @example
 * const discount = calculateDiscount(100, 20);
 * console.log(discount); // 20
 * 
 * @see calculateFinalPrice() - To get price after discount
 */
export function calculateDiscount(basePrice: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('Discount must be between 0 and 100');
  }
  return basePrice * (discountPercent / 100);
}
```

### Inline Comments

```typescript
// ✅ Good - explains the WHY
// We cache enrollments for 5 minutes to reduce database queries
// during rapid navigation between chapters
const enrollment = useMemo(() => fetchEnrollment(id), [enrollmentDuration]);

// Cache API responses to prevent redundant calls while user browses
const handleFetchData = useCallback(() => {
  if (cache.has(key)) return cache.get(key);
  // Implementation
}, [cache, key]);

// ❌ Poor - obvious from code
// Set user to null
setUser(null);

// Loop through items
items.forEach((item) => {
  // Increment count
  count++;
});
```

### TODO and FIXME Comments

```typescript
// ✅ Good - actionable and specific
// TODO: Implement real-time notifications (JIRA: TICKET-123)
// FIXME: Handle network timeouts better (currently silently fails)
// HACK: Temporary workaround for Safari bug, remove after v2.0

// ❌ Poor - vague
// TODO: fix this
// FIXME: doesn't work
```

## Formatting

### Indentation
- Use 2 spaces (configured in `.editorconfig`)
- Never use tabs

### Line Length
- Maximum 100 characters per line
- Long lines should be broken logically

```typescript
// ✅ Good - readable line breaks
const formattedDate = formatDate(
  user.lastLoginDate,
  'MMMM DD, YYYY',
  userLocale
);

// ❌ Poor - single long line
const formattedDate = formatDate(user.lastLoginDate, 'MMMM DD, YYYY', userLocale);
```

### Spacing

```typescript
// ✅ Good spacing
function calculateTotal(items: Item[]): number {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * TAX_RATE;
  
  return subtotal + tax;
}

// ❌ Poor spacing
function calculateTotal(items:Item[]):number{
const subtotal=items.reduce((sum,item)=>sum+item.price,0);const tax=subtotal*TAX_RATE;
return subtotal+tax;}
```

### Object Formatting

```typescript
// ✅ Good - multi-line for clarity
const user = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  isAdmin: false,
};

// ✅ Acceptable - single line for simple objects
const config = { pageSize: 20, maxRetries: 3 };

// ❌ Poor - inconsistent
const user = {id: 'user-123', name: 'John Doe', 
  email: 'john@example.com',
isAdmin: false};
```

## Error Handling

### Always Handle Errors

```typescript
// ✅ Good - comprehensive error handling
async function fetchUserData(userId: string) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as User;
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    
    if (error instanceof NetworkError) {
      throw new UserError('Network error. Please check your connection.');
    }
    
    if (error instanceof ValidationError) {
      throw new UserError('Invalid response from server.');
    }
    
    throw error;
  }
}

// ✅ Good - component error handling
function UserProfile({ userId }: { userId: string }) {
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    fetchUserData(userId).catch(err => {
      setError(err instanceof UserError ? err : new UserError('Failed to load profile'));
    });
  }, [userId]);
  
  if (error) return <ErrorState message={error.message} />;
  // Render component
}

// ❌ Poor - no error handling
const user = await fetch(`/api/users/${userId}`).then(r => r.json());

// ❌ Poor - generic error message
catch (error) {
  throw new Error('Something went wrong'); // Useless for debugging
}
```

### Custom Error Classes

```typescript
// ✅ Good - specific error types
class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}
```

## Testing

### Test Naming

```typescript
// ✅ Good - describes what is being tested and expected outcome
describe('Button', () => {
  it('renders with correct text', () => { });
  it('calls onClick handler when clicked', () => { });
  it('disables button when isLoading prop is true', () => { });
  it('throws error if children prop is missing', () => { });
});

// ❌ Poor - unclear or too brief
describe('Button', () => {
  it('works', () => { });
  it('button test', () => { });
  it('test click', () => { });
});
```

### Test Structure (AAA Pattern)

```typescript
// ✅ Good - Arrange, Act, Assert pattern
it('calculates discount correctly', () => {
  // Arrange
  const basePrice = 100;
  const discountPercent = 20;
  
  // Act
  const discount = calculateDiscount(basePrice, discountPercent);
  
  // Assert
  expect(discount).toBe(20);
});
```

### Test Coverage

Aim for:
- **Utilities**: 90%+ coverage
- **Hooks**: 80%+ coverage
- **Components**: 70%+ coverage (UI testing is harder)
- **Critical paths**: 100% coverage

## Pre-commit Checks

All code should pass these checks before commit:

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test

# Build
pnpm build
```

See `.husky/pre-commit` for automated checks.

## Quick Reference

| Pattern | Good | Avoid |
|---------|------|-------|
| Variables | `isLoading`, `userData` | `loading`, `data` |
| Constants | `MAX_RETRIES`, `API_URL` | `maxRetries`, `api_url` |
| Functions | `calculateAge()`, `fetchUser()` | `calc()`, `get()` |
| Booleans | `isActive`, `hasError` | `active`, `error` |
| Conditionals | Explicit if statements | Nested ternaries |
| Components | Named exports | Default exports |
| Imports | Organized by type | Random order |
| Files | < 400 lines | > 500 lines |
| Comments | Why, not what | Obvious statements |
| Errors | Custom error types | Generic Error |

## Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- See `docs/COMPONENT_ORGANIZATION.md` for component structure
