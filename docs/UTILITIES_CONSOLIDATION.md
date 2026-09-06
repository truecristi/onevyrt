# Utilities Consolidation Guide

## Overview

This guide explains the utilities consolidation strategy for ONEVYRT, which organizes reusable utility functions into a cohesive library structure for better maintainability and discoverability.

## Current State

Utilities are scattered across the codebase in various locations:
```
apps/web/lib/
├── campaign/          # Campaign-specific utilities
├── community/         # Community-specific utilities
├── acquisition/       # Lead/funnel utilities
├── design/           # Design-related utilities
├── studio/           # Canvas/studio utilities
├── ... (domain-specific)
```

## Target State

Consolidate into a organized `apps/web/lib/utils/` structure:

```
apps/web/lib/utils/
├── index.ts                      # Master export file
├── README.md                      # Usage guide
├── types.ts                       # Shared utility types
├── string/
│   ├── index.ts
│   ├── truncate.ts
│   ├── capitalize.ts
│   ├── slugify.ts
│   ├── camelToKebab.ts
│   └── kebabToCamel.ts
├── date/
│   ├── index.ts
│   ├── formatDate.ts
│   ├── parseDate.ts
│   ├── getDaysDifference.ts
│   ├── addDays.ts
│   ├── isValidDate.ts
│   └── getDateRange.ts
├── array/
│   ├── index.ts
│   ├── groupBy.ts
│   ├── unique.ts
│   ├── flatten.ts
│   ├── chunk.ts
│   ├── compact.ts
│   └── findDuplicates.ts
├── object/
│   ├── index.ts
│   ├── deepMerge.ts
│   ├── pick.ts
│   ├── omit.ts
│   ├── getNestedValue.ts
│   └── setNestedValue.ts
├── math/
│   ├── index.ts
│   ├── clamp.ts
│   ├── round.ts
│   ├── percentage.ts
│   ├── lerp.ts
│   └── normalize.ts
├── validation/
│   ├── index.ts
│   ├── isEmail.ts
│   ├── isPhone.ts
│   ├── isUrl.ts
│   ├── isStrongPassword.ts
│   └── isValidZipCode.ts
├── format/
│   ├── index.ts
│   ├── formatCurrency.ts
│   ├── formatPercentage.ts
│   ├── formatBytes.ts
│   └── formatPhone.ts
├── async/
│   ├── index.ts
│   ├── delay.ts
│   ├── retry.ts
│   ├── timeout.ts
│   ├── queue.ts
│   └── parallel.ts
└── dom/
    ├── index.ts
    ├── getScrollPosition.ts
    ├── smoothScroll.ts
    ├── copyToClipboard.ts
    ├── downloadFile.ts
    └── isElementInViewport.ts
```

## Utilities by Category

### String Utilities (`lib/utils/string/`)

```typescript
// truncate.ts
export function truncate(str: string, length: number, suffix: string = '...'): string;

// capitalize.ts
export function capitalize(str: string): string;

// slugify.ts
export function slugify(str: string): string;

// camelToKebab.ts
export function camelToKebab(str: string): string;

// kebabToCamel.ts
export function kebabToCamel(str: string): string;
```

### Date Utilities (`lib/utils/date/`)

```typescript
// formatDate.ts
export function formatDate(date: Date, format: string, locale?: string): string;

// parseDate.ts
export function parseDate(dateString: string, format?: string): Date | null;

// getDaysDifference.ts
export function getDaysDifference(date1: Date, date2: Date): number;

// addDays.ts
export function addDays(date: Date, days: number): Date;

// isValidDate.ts
export function isValidDate(date: unknown): boolean;

// getDateRange.ts
export function getDateRange(start: Date, end: Date): Date[];
```

### Array Utilities (`lib/utils/array/`)

```typescript
// groupBy.ts
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]>;

// unique.ts
export function unique<T>(array: T[], keyFn?: (item: T) => unknown): T[];

// flatten.ts
export function flatten<T>(array: (T | T[])[]): T[];

// chunk.ts
export function chunk<T>(array: T[], size: number): T[][];

// compact.ts
export function compact<T>(array: (T | null | undefined)[]): T[];

// findDuplicates.ts
export function findDuplicates<T>(array: T[]): T[];
```

### Object Utilities (`lib/utils/object/`)

```typescript
// deepMerge.ts
export function deepMerge<T>(target: T, ...sources: Partial<T>[]): T;

// pick.ts
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;

// omit.ts
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;

// getNestedValue.ts
export function getNestedValue<T>(obj: T, path: string): unknown;

// setNestedValue.ts
export function setNestedValue<T>(obj: T, path: string, value: unknown): T;
```

### Math Utilities (`lib/utils/math/`)

```typescript
// clamp.ts
export function clamp(value: number, min: number, max: number): number;

// round.ts
export function round(value: number, decimals?: number): number;

// percentage.ts
export function percentage(value: number, total: number, decimals?: number): number;

// lerp.ts
export function lerp(a: number, b: number, t: number): number;

// normalize.ts
export function normalize(value: number, min: number, max: number): number;
```

### Validation Utilities (`lib/utils/validation/`)

```typescript
// isEmail.ts
export function isEmail(email: string): boolean;

// isPhone.ts
export function isPhone(phone: string, country?: string): boolean;

// isUrl.ts
export function isUrl(url: string): boolean;

// isStrongPassword.ts
export interface PasswordStrengthOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}
export function isStrongPassword(password: string, options?: PasswordStrengthOptions): boolean;

// isValidZipCode.ts
export function isValidZipCode(zipCode: string, country?: string): boolean;
```

### Format Utilities (`lib/utils/format/`)

```typescript
// formatCurrency.ts
export function formatCurrency(amount: number, currency?: string, locale?: string): string;

// formatPercentage.ts
export function formatPercentage(value: number, decimals?: number): string;

// formatBytes.ts
export function formatBytes(bytes: number, decimals?: number): string;

// formatPhone.ts
export function formatPhone(phone: string, country?: string): string;
```

### Async Utilities (`lib/utils/async/`)

```typescript
// delay.ts
export function delay(ms: number): Promise<void>;

// retry.ts
interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number) => void;
}
export function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;

// timeout.ts
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T>;

// queue.ts
export function queue<T>(items: T[], concurrency: number): Promise<T[]>;

// parallel.ts
export function parallel<T>(fns: (() => Promise<T>)[]): Promise<T[]>;
```

### DOM Utilities (`lib/utils/dom/`)

```typescript
// getScrollPosition.ts
export function getScrollPosition(): { x: number; y: number };

// smoothScroll.ts
export function smoothScroll(element: HTMLElement, duration?: number): Promise<void>;

// copyToClipboard.ts
export function copyToClipboard(text: string): Promise<void>;

// downloadFile.ts
export function downloadFile(url: string, filename: string): void;

// isElementInViewport.ts
export function isElementInViewport(element: HTMLElement): boolean;
```

## Master Index Export

The root `apps/web/lib/utils/index.ts` exports all utilities:

```typescript
// String utilities
export * from './string';

// Date utilities
export * from './date';

// Array utilities
export * from './array';

// Object utilities
export * from './object';

// Math utilities
export * from './math';

// Validation utilities
export * from './validation';

// Format utilities
export * from './format';

// Async utilities
export * from './async';

// DOM utilities
export * from './dom';

// Types
export * from './types';
```

## Usage Examples

### Before (Scattered Imports)
```typescript
import { truncate } from '@/lib/campaign/helpers';
import { formatDate } from '@/lib/acquisition/utils';
import { isEmail } from '@/lib/auth/validators';
import { retry } from '@/lib/jobs/async-helpers';
```

### After (Centralized)
```typescript
import { 
  truncate, 
  formatDate, 
  isEmail, 
  retry 
} from '@/lib/utils';
```

## Migration Strategy

### Phase 1: Create Core Structure (Week 1)
- [ ] Create `apps/web/lib/utils/` directory structure
- [ ] Implement core utility functions
- [ ] Create comprehensive tests for utilities

### Phase 2: Audit & Identify Duplicates (Week 2)
- [ ] Audit existing utilities across codebase
- [ ] Identify duplicate implementations
- [ ] Document utility locations

### Phase 3: Consolidation (Week 3-4)
- [ ] Move utilities to central location
- [ ] Update imports across codebase
- [ ] Remove duplicate implementations

### Phase 4: Documentation & Polish (Week 5)
- [ ] Update documentation
- [ ] Add usage examples
- [ ] Run comprehensive tests
- [ ] Update linting rules if needed

## Adding New Utilities

When creating a new utility function:

1. **Determine Category**: String, date, array, object, math, validation, format, async, or dom?

2. **Create File**: Place in appropriate category folder
   ```typescript
   // apps/web/lib/utils/string/pascalCase.ts
   export function pascalCase(str: string): string {
     return str
       .replace(/([a-z])([A-Z])/g, '$1-$2')
       .split(/[-_\s]+/)
       .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
       .join('');
   }
   ```

3. **Update Category Index**:
   ```typescript
   // apps/web/lib/utils/string/index.ts
   export { truncate } from './truncate';
   export { capitalize } from './capitalize';
   export { pascalCase } from './pascalCase'; // New
   ```

4. **Update Root Index**:
   Ensure `apps/web/lib/utils/index.ts` includes the category

5. **Add Tests**:
   ```typescript
   // apps/web/lib/utils/string/pascalCase.test.ts
   import { pascalCase } from './pascalCase';
   
   describe('pascalCase', () => {
     it('converts camelCase to PascalCase', () => {
       expect(pascalCase('helloWorld')).toBe('HelloWorld');
     });
   });
   ```

6. **Document**: Add JSDoc comments with examples

## Testing Utilities

Create a test file for each utility:

```typescript
// apps/web/lib/utils/string/truncate.test.ts
import { truncate } from './truncate';

describe('truncate', () => {
  it('truncates strings longer than specified length', () => {
    const result = truncate('Hello World', 5);
    expect(result).toBe('Hello...');
  });

  it('does not truncate strings shorter than length', () => {
    const result = truncate('Hi', 5);
    expect(result).toBe('Hi');
  });

  it('uses custom suffix when provided', () => {
    const result = truncate('Hello World', 5, '→');
    expect(result).toBe('Hello→');
  });
});
```

Target: **80%+ coverage** for all utilities

## Documentation Template

Each utility category should have a README:

```markdown
# String Utilities

Collection of string manipulation functions.

## Functions

### truncate(str, length, suffix?)
Truncates a string to a maximum length and appends a suffix.

**Parameters:**
- `str` (string): The string to truncate
- `length` (number): Maximum length
- `suffix` (string, optional): Suffix to append (default: '...')

**Returns:** (string) Truncated string

**Example:**
\`\`\`typescript
truncate('Hello World', 5); // 'Hello...'
truncate('Hello World', 5, '→'); // 'Hello→'
\`\`\`

**See also:**
- `capitalize()` - Capitalize first letter
- `slugify()` - Convert to URL-safe string
```

## Best Practices

1. **Pure Functions**: Utilities should be pure (no side effects)
2. **Error Handling**: Throw meaningful errors for invalid inputs
3. **Types**: Use TypeScript interfaces for complex return types
4. **Documentation**: Include JSDoc with examples
5. **Tests**: Write comprehensive tests
6. **Performance**: Optimize for common use cases
7. **Immutability**: Don't mutate input parameters

## Performance Considerations

### Memoization
For expensive operations, consider memoization:

```typescript
import memoize from 'lodash/memoize';

const expensiveCalculation = memoize((input: string) => {
  // Complex logic
});
```

### Lazy Loading
For rarely-used utilities, consider dynamic imports:

```typescript
const { retryWithBackoff } = await import('@/lib/utils/async/retry');
```

## Common Utility Patterns

### Validation Pattern
```typescript
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) return { valid: false, error: 'Email is required' };
  if (!isValidEmail(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}
```

### Transformation Pattern
```typescript
export function transform<T, U>(
  item: T,
  transformFn: (item: T) => U
): U {
  return transformFn(item);
}

export function transformArray<T, U>(
  items: T[],
  transformFn: (item: T) => U
): U[] {
  return items.map(transformFn);
}
```

## Related Documentation

- Component Organization: `docs/COMPONENT_ORGANIZATION.md`
- Code Style Guide: `docs/CODE_STYLE_GUIDE.md`
- Hooks Library: `apps/web/lib/hooks/index.ts`
