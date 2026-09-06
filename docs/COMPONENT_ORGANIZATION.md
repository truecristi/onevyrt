# Component Organization & Architecture Guide

## Overview
This guide outlines the component folder structure, naming conventions, and organizational principles for ONEVYRT's React component library.

## Folder Structure

```
apps/web/components/
├── ui/                           # Reusable UI primitives (buttons, cards, badges, etc.)
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Button.test.tsx
│   └── index.ts                  # Barrel export
├── shared/                        # Shared components used across features
│   ├── AppNav.tsx
│   ├── PageShell.tsx
│   ├── StatusBadge.tsx
│   └── index.ts
├── programme/                     # Programme/curriculum-specific components
│   ├── ProgrammeJourney.tsx
│   ├── LessonGuide.tsx
│   ├── ChapterSubmissionReview.tsx
│   ├── useEnrollment.ts           # Feature-specific hook
│   └── index.ts
├── business/                      # My Business OS components
│   ├── BusinessDashboard.tsx
│   ├── FunnelBuilder.tsx
│   ├── ConstraintAnalysis.tsx
│   └── index.ts
├── coaching/                      # Coaching-specific components
│   ├── CoachCohortHub.tsx
│   ├── LearnerDetailDrawer.tsx
│   ├── ReachOutModal.tsx
│   └── index.ts
├── campaign/                      # Campaign Studio components
│   ├── BrandBrainSetup.tsx
│   ├── CopywritingEngine.tsx
│   ├── CreativeGenerator.tsx
│   └── index.ts
├── studio/                        # Canvas/Studio editor components
│   ├── FunnelCanvasBuilder.tsx
│   ├── useProjectComments.ts      # Feature-specific hook
│   ├── useWorkspaceMembers.ts
│   ├── useApiKeysAndWebhooks.ts
│   └── index.ts
├── community/                     # Community/template components
│   ├── TemplateBrowser.tsx
│   ├── CreativeSwipeFile.tsx
│   ├── AuthorProfile.tsx
│   └── index.ts
├── admin/                         # Admin-only components
│   ├── CurriculumEditor.tsx
│   ├── LearnerManagement.tsx
│   └── index.ts
├── illustrations/                 # Illustration & visual components
│   ├── Illustration.tsx
│   ├── MarketingSystemVisuals.tsx
│   └── index.ts
├── navigation/                    # Navigation components
│   ├── UnifiedNav.tsx
│   ├── ProgressIndicator.tsx
│   └── index.ts
└── index.ts                       # Main barrel export for component library

apps/web/lib/hooks/               # Centralized hooks library
├── index.ts                       # Master hooks export
├── useNavigation.ts               # Navigation-related
├── useTracking.ts                 # Analytics
├── useFeatureAccess.ts            # Feature flags
├── useCSRFToken.ts                # Security
├── useDialogA11y.ts               # Accessibility
├── form/                          # Form-related hooks
│   ├── useFormState.ts
│   ├── useValidation.ts
│   └── index.ts
├── data-fetching/                 # Data fetching hooks
│   ├── useFetch.ts
│   ├── useCache.ts
│   └── index.ts
├── state-management/              # State management hooks
│   ├── useLocalStorage.ts
│   ├── useSessionStorage.ts
│   └── index.ts
├── performance/                   # Performance hooks
│   ├── useDebounce.ts
│   ├── useThrottle.ts
│   ├── useMemo.ts
│   └── index.ts
└── accessibility/                 # Accessibility hooks
    ├── useKeyboardNavigation.ts
    ├── useFocusTrap.ts
    └── index.ts
```

## Component Naming Conventions

### File Names
- **PascalCase** for component files: `UserProfile.tsx`, `Button.tsx`
- **camelCase** for hook files: `useNavigation.ts`, `useTracking.ts`
- **kebab-case** for utility files: `string-helpers.ts`, `date-formatter.ts`
- **Test files**: Match component name with `.test.tsx` suffix: `Button.test.tsx`

### Component Export Pattern

```typescript
// components/ui/Button.tsx
import React, { ReactNode, CSSProperties } from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Button component - Primary UI control for user interactions
 * @see Button.stories.tsx for visual reference
 * @see Button.test.tsx for tests
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
}: ButtonProps) {
  // Implementation
}

// Export with proper typing
export type { ButtonProps };
```

### Barrel Exports (index.ts)

Each feature folder should have an `index.ts` that re-exports its components:

```typescript
// components/ui/index.ts
export { Button, type ButtonProps } from './Button';
export { Card, type CardProps } from './Card';
export { Badge, type BadgeProps } from './Badge';
export { Label, type LabelProps } from './Label';
```

**Usage:**
```typescript
import { Button, Card, Badge } from '@/components/ui';
```

## Component Types & Patterns

### 1. Presentational Components (Pure UI)
- No data fetching or external dependencies
- Only receive data via props
- Location: `components/ui/`

```typescript
interface CardProps {
  title: string;
  children: ReactNode;
  variant?: 'default' | 'elevated';
}

export function Card({ title, children, variant = 'default' }: CardProps) {
  return <div className={`card card--${variant}`}>{children}</div>;
}
```

### 2. Container Components (Smart/Connected)
- Handle data fetching and state management
- May use hooks
- Location: Feature-specific folders (`components/programme/`, etc.)

```typescript
export function ProgrammeDashboard() {
  const { enrollments, isLoading } = useEnrollment();
  
  if (isLoading) return <SkeletonState />;
  return <div>{/* Render enrollment data */}</div>;
}
```

### 3. Hooks (Logic)
- Extract and reuse component logic
- Location: `apps/web/lib/hooks/` (categorized by purpose)
- Must follow naming convention: `use*`

```typescript
// apps/web/lib/hooks/useNavigation.ts
export function useNavigation() {
  const [activeSection, setActiveSection] = useState('home');
  // Navigation logic
  return { activeSection, setActiveSection };
}
```

### 4. Utility Functions (Pure Functions)
- No side effects
- Location: `apps/web/lib/utils/` (create this if needed)
- Test with unit tests

```typescript
// apps/web/lib/utils/string-helpers.ts
export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str;
}
```

## Feature Folder Principles

Each feature folder (e.g., `components/programme/`, `components/business/`) should contain:

### ✅ Included
- Feature-specific components
- Feature-specific hooks (if any)
- Feature-specific types (`types.ts`)
- Barrel export (`index.ts`)
- Test files (`.test.tsx`)

### ❌ Excluded
- Global utilities (use `lib/` instead)
- Global hooks (use `lib/hooks/` instead)
- Shared UI components (use `components/ui/` instead)

## Props Pattern & TypeScript

### Props Interface
```typescript
interface ComponentNameProps {
  // Required props
  id: string;
  title: string;
  
  // Optional props with defaults
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  
  // Callback props
  onAction?: (value: string) => void;
  
  // Spread props for native HTML attributes
  className?: string;
  'aria-label'?: string;
}
```

### Children Handling
```typescript
interface LayoutProps {
  children: React.ReactNode;  // Single or multiple elements
  fallback?: React.ReactNode; // For Suspense boundaries
}
```

## Hook Organization

All hooks should be centralized in `apps/web/lib/hooks/` with the following structure:

### Master Index Export
```typescript
// apps/web/lib/hooks/index.ts
// Navigation
export { useNavigation } from './useNavigation';
export { useRoute } from './useRoute';

// Forms
export { useFormState } from './form/useFormState';
export { useValidation } from './form/useValidation';

// Data Fetching
export { useFetch } from './data-fetching/useFetch';
export { useCache } from './data-fetching/useCache';

// Accessibility
export { useKeyboardNavigation } from './accessibility/useKeyboardNavigation';
export { useFocusTrap } from './accessibility/useFocusTrap';
```

### Usage
```typescript
// Before (scattered imports)
import { useNavigation } from '@/hooks/useNavigation';
import { useFormState } from '@/lib/hooks/form/useFormState';
import { useValidation } from '@/components/studio/useValidation';

// After (centralized)
import { useNavigation, useFormState, useValidation } from '@/lib/hooks';
```

## Utilities Consolidation

### Structure
```
apps/web/lib/utils/
├── index.ts                      # Master export
├── string/
│   ├── truncate.ts
│   ├── capitalize.ts
│   ├── slugify.ts
│   └── index.ts
├── date/
│   ├── formatDate.ts
│   ├── parseDate.ts
│   ├── getDaysDifference.ts
│   └── index.ts
├── array/
│   ├── groupBy.ts
│   ├── unique.ts
│   ├── flatten.ts
│   └── index.ts
├── math/
│   ├── clamp.ts
│   ├── round.ts
│   ├── percentage.ts
│   └── index.ts
└── validation/
    ├── isEmail.ts
    ├── isPhone.ts
    ├── isUrl.ts
    └── index.ts
```

### Master Index
```typescript
// apps/web/lib/utils/index.ts
export * from './string';
export * from './date';
export * from './array';
export * from './math';
export * from './validation';
```

## File Organization Rules

### Rule 1: Co-locate Related Code
Keep related files close together:
- Component + its tests
- Component + its specific hooks
- Component + its types

### Rule 2: One Component Per File
One React component per file (with few exceptions for very small components).

### Rule 3: Avoid Deep Nesting
Maximum 3 levels deep:
```
✅ components/business/dashboard/
❌ components/business/dashboard/sections/metrics/cards/performance/
```

### Rule 4: Barrel Exports
Use `index.ts` files to create clean import paths:
```typescript
// ✅ Clean
import { Button, Card } from '@/components/ui';

// ❌ Verbose
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
```

## Import Order Convention

Imports should follow this order:

```typescript
// 1. React and Next.js
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party libraries
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

// 3. Internal imports - libs and utilities
import { useNavigation, useTracking } from '@/lib/hooks';
import { formatDate, truncate } from '@/lib/utils';

// 4. Internal imports - components
import { Button, Card } from '@/components/ui';
import { AppNav } from '@/components/shared';

// 5. Types and constants
import { type UserProps } from '@/types';
import { API_ENDPOINTS } from '@/constants';

// 6. Styles
import styles from './Component.module.css';
```

## Testing Structure

### Test Files
- Place `.test.tsx` files adjacent to the component
- Use descriptive test names
- Follow Arrange-Act-Assert pattern

```typescript
// components/ui/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    // Arrange
    const label = 'Click me';
    
    // Act
    render(<Button>{label}</Button>);
    
    // Assert
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
```

## Documentation & Comments

### Component Documentation
```typescript
/**
 * ProgrammeJourney - Displays user's curriculum progress
 * 
 * Features:
 * - Shows all chapters and current stage
 * - Indicates locked/available/completed states
 * - Links to chapter pages
 * 
 * @component
 * @example
 * return <ProgrammeJourney enrollmentId="123" />
 */
export function ProgrammeJourney({ enrollmentId }: ProgrammeJourneyProps) {
  // Implementation
}
```

### Inline Comments
- Comment the "why", not the "what"
- Keep comments up-to-date with code changes

```typescript
// ✅ Good - explains reasoning
// We cache this for 5 minutes to reduce API calls during rapid clicks
const cachedData = useMemo(() => fetchData(), [fiveMinutes]);

// ❌ Bad - obvious from code
// Create a new array
const newArray = [];
```

## Maintenance & Refactoring

### Regular Tasks
- [ ] Review unused components annually
- [ ] Consolidate similar utilities
- [ ] Update documentation as structure changes
- [ ] Run linting on all components
- [ ] Check for prop drilling (consider Context API or state management)

### Refactoring Checklist
- [ ] Update barrel exports
- [ ] Update import paths in all files
- [ ] Update tests
- [ ] Update documentation
- [ ] Run type checking: `pnpm typecheck`
- [ ] Run linting: `pnpm lint`

## Common Patterns

### Conditional Rendering
```typescript
// ✅ Good - explicit and readable
if (isLoading) return <Skeleton />;
if (error) return <ErrorState error={error} />;
if (!data) return <EmptyState />;

return <Content data={data} />;

// ❌ Avoid - harder to follow
return isLoading ? <Skeleton /> : error ? <ErrorState /> : <Content />;
```

### Separating Concerns
```typescript
// Container component
export function UserProfile({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId);
  return <UserProfileUI user={user} isLoading={isLoading} />;
}

// Presentational component
function UserProfileUI({ user, isLoading }: { user: User; isLoading: boolean }) {
  if (isLoading) return <Skeleton />;
  return <div>{/* Render user data */}</div>;
}
```

## Related Documentation
- Code Style Guide: `docs/CODE_STYLE_GUIDE.md`
- ESLint Configuration: `.eslintrc` and `eslint.config.mjs`
- Type Conventions: `apps/web/lib/types/`
