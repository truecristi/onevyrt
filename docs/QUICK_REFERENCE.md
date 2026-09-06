# Code Organization Quick Reference

A quick reference guide for daily development in ONEVYRT.

## Project Structure

```
apps/web/
├── components/           # React components (organized by feature)
│   ├── ui/              # Reusable UI primitives
│   ├── shared/          # Shared across features
│   ├── programme/       # Curriculum/learning
│   ├── business/        # My Business OS
│   ├── coaching/        # Coaching features
│   └── ...
├── lib/
│   ├── hooks/           # Centralized custom hooks
│   ├── utils/           # Utility functions (organized by category)
│   ├── types/           # Shared TypeScript types
│   └── ...
├── app/                 # Next.js App Router pages
├── public/              # Static assets
└── package.json
```

## Import Guide

### Correct Imports

```typescript
// Hooks - from centralized library
import { useNavigation, useTracking } from '@/lib/hooks';

// UI Components - via barrel export
import { Button, Card, Badge } from '@/components/ui';

// Feature components - via barrel export
import { ProgrammeJourney } from '@/components/programme';

// Utilities - from centralized library
import { truncate, formatDate, isEmail } from '@/lib/utils';

// Types
import type { User, Project } from '@/types';

// Constants
import { API_ENDPOINTS } from '@/constants';
```

### Wrong Imports (Avoid!)

```typescript
// ❌ Importing from deep paths
import { Button } from '@/components/ui/Button';
import { useTracking } from '@/lib/tracking/hooks/useTracking';
import { truncate } from '@/lib/campaign/helpers/string-utils';
```

## Component Patterns

### Create a New Component

```bash
# 1. Create file
touch apps/web/components/ui/MyComponent.tsx

# 2. Use this structure
```

```typescript
// apps/web/components/ui/MyComponent.tsx
import React from 'react';
import styles from './MyComponent.module.css';

interface MyComponentProps {
  title: string;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * MyComponent - Brief description
 * @see MyComponent.test.tsx for tests
 */
export function MyComponent({
  title,
  isActive = false,
  onClick,
}: MyComponentProps) {
  return (
    <div className={styles.container}>
      {title}
    </div>
  );
}

export type { MyComponentProps };
```

```bash
# 3. Update index
# Edit apps/web/components/ui/index.ts
# Add: export { MyComponent, type MyComponentProps } from './MyComponent';

# 4. Test it
# touch apps/web/components/ui/MyComponent.test.tsx
```

### Create a New Hook

```bash
# 1. Determine category (form, data-fetching, etc)
# 2. Create file
touch apps/web/lib/hooks/{category}/useMyHook.ts
```

```typescript
// apps/web/lib/hooks/data-fetching/useMyHook.ts
import { useState, useEffect } from 'react';

/**
 * useMyHook - Handles [specific behavior]
 * @example
 * const { data, isLoading } = useMyHook(id);
 */
export function useMyHook(id: string) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Implementation
  }, [id]);

  return { data, isLoading };
}
```

```bash
# 3. Update category index
# Edit apps/web/lib/hooks/{category}/index.ts
# Add: export { useMyHook } from './useMyHook';
```

### Create a New Utility

```bash
# 1. Determine category (string, date, array, etc)
# 2. Create file
touch apps/web/lib/utils/{category}/myUtility.ts
```

```typescript
// apps/web/lib/utils/string/myUtility.ts
/**
 * myUtility - Transforms [input] to [output]
 * @param input - Description
 * @returns Description
 * @example
 * myUtility('hello') // 'HELLO'
 */
export function myUtility(input: string): string {
  // Implementation
  return input;
}
```

```bash
# 3. Update category index
# Edit apps/web/lib/utils/{category}/index.ts
# Add: export { myUtility } from './myUtility';
```

## Naming Conventions

| Item | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Hooks | useX camelCase | `useNavigation.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Types | PascalCase | `interface UserProps` |
| Folders | kebab-case | `date-utilities/` |
| Booleans | is/has/should prefix | `isActive`, `hasError` |
| Test files | Match component + .test | `Button.test.tsx` |

## Code Quality Checks

### Before Committing

```bash
# Check formatting
pnpm lint --fix

# Check types
pnpm typecheck

# Run tests (if added/modified tests)
pnpm test

# Git will run hooks automatically:
# - Linting on staged files
# - Type checking
# - Commit message validation
```

### Before Pushing

```bash
# Run all tests
pnpm test

# Build for production
pnpm build

# Git will run hooks automatically:
# - Full test suite
# - Production build verification
```

## Git Workflow

### Commit Message Format

```
type(scope): subject

body

footer
```

**Valid types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style
- `refactor:` Code refactoring
- `perf:` Performance
- `test:` Tests
- `chore:` Maintenance
- `ci:` CI/CD

**Examples:**
```bash
# Good
git commit -m "feat(hooks): add useEnrollment hook"
git commit -m "fix: correct ESLint configuration"
git commit -m "docs(setup): update SETUP_GUIDE.md"
git commit -m "refactor(utils): consolidate string helpers"

# Bad
git commit -m "fix stuff"
git commit -m "update"
git commit -m "changes"
```

## Common Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Testing
pnpm test             # Run all tests
pnpm test:watch      # Watch mode

# Linting & Type Checking
pnpm lint            # Run ESLint
pnpm lint --fix      # Auto-fix issues
pnpm typecheck       # Type checking

# Database (if applicable)
pnpm migrate:up      # Run migrations
pnpm migrate:down    # Rollback

# Git Hooks
git hook run pre-commit  # Test pre-commit hook
git hook run pre-push    # Test pre-push hook
```

## File Size Guidelines

| Type | Ideal | Max |
|------|-------|-----|
| Component | 200-300 lines | 400 lines |
| Hook | 100-150 lines | 250 lines |
| Utility | 50-100 lines | 150 lines |
| Test | Match component | No limit |

**Too large? Split into smaller files!**

## TypeScript Best Practices

```typescript
// ✅ Good - explicit types
function getUserAge(user: User): number {
  return new Date().getFullYear() - user.birthYear;
}

// ✅ Good - interfaces for complex types
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

// ❌ Avoid - implicit any
function getUser(id) { }

// ❌ Avoid - unclear types
function process(data: any): any { }
```

## React Best Practices

```typescript
// ✅ Good - hooks at top level
function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => { }, [count]);
}

// ✅ Good - descriptive names
const isUserAuthenticated = user && user.token && !user.token.expired;

// ❌ Avoid - conditional hooks
if (condition) {
  useEffect(() => { }); // ERROR!
}

// ❌ Avoid - prop drilling
<Component user={user} theme={theme} isLoading={isLoading} />
```

## Conditional Rendering

```typescript
// ✅ Good
if (isLoading) return <Spinner />;
if (error) return <ErrorMsg />;
if (!data) return null;

return <Content data={data} />;

// ✅ Acceptable for simple conditions
return isVisible ? <Component /> : null;

// ❌ Avoid - nested ternaries
return isLoading ? <A /> : error ? <B /> : data ? <C /> : <D />;
```

## Documentation Requirements

### For Components
- [ ] JSDoc comment explaining purpose
- [ ] Parameter descriptions
- [ ] Example usage
- [ ] @see references to related components

### For Hooks
- [ ] JSDoc comment explaining behavior
- [ ] Parameter descriptions
- [ ] Return type descriptions
- [ ] Usage example

### For Utilities
- [ ] JSDoc comment explaining transformation
- [ ] Parameter descriptions
- [ ] Return type description
- [ ] Usage example
- [ ] Edge cases documented

## Debugging Tips

### Check Imports
```bash
# Find undefined imports
pnpm typecheck

# Find unused imports
pnpm lint
```

### Component Rendering Issues
```typescript
// Check if component renders
console.log('Rendering MyComponent');

// Check props
console.log('Props:', props);

// Use React DevTools browser extension
```

### Hook Issues
```typescript
// Check hook dependencies
useEffect(() => {
  // ...
}, [dependency]); // Verify all dependencies listed

// Check hook order (must be top-level)
// Not in loops, conditions, or nested functions
```

## Performance Tips

1. **Lazy load large components**
   ```typescript
   const HeavyComponent = dynamic(() => import('./Heavy'));
   ```

2. **Memoize expensive calculations**
   ```typescript
   const result = useMemo(() => expensive(data), [data]);
   ```

3. **Debounce rapid updates**
   ```typescript
   import { useDebounce } from '@/lib/hooks';
   const debouncedValue = useDebounce(value, 300);
   ```

4. **Split large bundles**
   - Use route-based code splitting
   - Use dynamic imports for heavy libraries

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Hooks in conditions | Move to top level |
| Deep prop drilling | Use Context or state management |
| Mutating state | Use spread operator or copy |
| Missing dependencies | Add all dependencies to useEffect |
| Over-nesting ternaries | Use if statements |
| Scattered utilities | Use centralized `@/lib/utils` |
| Scattered hooks | Use centralized `@/lib/hooks` |
| Wrong import paths | Use barrel exports from index.ts |

## Help & Resources

- **Component patterns**: `docs/COMPONENT_ORGANIZATION.md`
- **Code style**: `docs/CODE_STYLE_GUIDE.md`
- **Utilities**: `docs/UTILITIES_CONSOLIDATION.md`
- **Setup guide**: `docs/SETUP_GUIDE.md`
- **ESLint rules**: Run `pnpm lint --help`
- **React docs**: https://react.dev
- **TypeScript docs**: https://www.typescriptlang.org/docs

## Team Standards Summary

1. **Organization**: Feature-based folder structure
2. **Imports**: Use barrel exports and centralized locations
3. **Types**: Always use TypeScript, avoid `any`
4. **Naming**: PascalCase for components, camelCase for functions
5. **Documentation**: JSDoc comments for all exports
6. **Testing**: Unit tests for utilities, integration tests for features
7. **Quality**: ESLint + TypeScript must pass before commit
8. **Commits**: Follow Conventional Commits format
9. **Reviews**: Check against code review checklist
10. **Performance**: Keep files focused and reasonably sized

---

**Quick Links**
- Project docs: `docs/`
- Issue tracker: GitHub Issues
- Code review: GitHub Pull Requests
- Questions: Team Slack channel
