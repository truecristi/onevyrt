# Code Organization & Maintainability Setup Guide

## Overview

This guide walks through implementing the comprehensive code organization improvements for ONEVYRT:

1. Component organization
2. Shared hook library
3. Utilities consolidation
4. Code style enforcement
5. Git pre-commit hooks

## Prerequisites

- Node.js 18+ and pnpm installed
- Git repository initialized
- ESLint and TypeScript already configured

## Quick Start (5 minutes)

### 1. Enable Git Hooks

```bash
# Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
chmod +x .husky/commit-msg

# Test hooks
git hook run pre-commit  # Should pass
```

### 2. Verify ESLint Configuration

```bash
# Run linting
pnpm lint

# Should complete with no errors (warnings are OK)
```

### 3. Verify Type Checking

```bash
# Run type checking
pnpm typecheck

# Should complete with no errors
```

## Full Implementation (2-3 weeks)

### Week 1: Documentation & Setup

#### Phase 1: Review & Understand
- [ ] Read `docs/COMPONENT_ORGANIZATION.md` (20 min)
- [ ] Read `docs/CODE_STYLE_GUIDE.md` (30 min)
- [ ] Read `docs/UTILITIES_CONSOLIDATION.md` (20 min)
- [ ] Review current codebase structure (30 min)

#### Phase 2: Configure Tools
- [ ] Verify ESLint config: `apps/web/eslint.config.mjs`
- [ ] Enable git hooks in `.husky/`
- [ ] Verify `.editorconfig` for consistent formatting
- [ ] Update `.vscode/settings.json` for team consistency

**Deliverables:**
- [ ] All documentation reviewed
- [ ] Git hooks enabled and tested
- [ ] Linting & type checking passing

### Week 2: Hooks Consolidation

#### Phase 1: Audit Existing Hooks
```bash
# Find all hooks in codebase
find apps/web -name "*use*.ts" -o -name "*use*.tsx" | sort

# Document current locations and purposes
```

#### Phase 2: Centralize Hooks
- [ ] Create categorical subdirectories in `apps/web/lib/hooks/`:
  - [ ] `apps/web/lib/hooks/form/` (form-related hooks)
  - [ ] `apps/web/lib/hooks/data-fetching/` (data fetching)
  - [ ] `apps/web/lib/hooks/state-management/` (state)
  - [ ] `apps/web/lib/hooks/performance/` (debounce, throttle)
  - [ ] `apps/web/lib/hooks/accessibility/` (a11y)

- [ ] Move hooks to appropriate categories:
  ```bash
  # Example
  mv apps/web/components/programme/useEnrollment.ts \
      apps/web/lib/hooks/data-fetching/useEnrollment.ts
  ```

- [ ] Update category index exports:
  ```typescript
  // apps/web/lib/hooks/form/index.ts
  export { useFormState } from './useFormState';
  export { useValidation } from './useValidation';
  ```

#### Phase 3: Update Imports
- [ ] Update all imports across codebase:
  ```typescript
  // Before
  import { useEnrollment } from '@/components/programme/useEnrollment';
  
  // After
  import { useEnrollment } from '@/lib/hooks';
  ```

- [ ] Run linting to catch import errors:
  ```bash
  pnpm lint
  ```

**Deliverables:**
- [ ] All hooks centralized in `apps/web/lib/hooks/`
- [ ] Master index exports all hooks
- [ ] All imports updated
- [ ] Linting passes

### Week 3: Component Reorganization

#### Phase 1: Audit Components
```bash
# Count components by folder
find apps/web/components -name "*.tsx" | awk -F/ '{print $4}' | sort | uniq -c

# Identify orphaned/misplaced components
```

#### Phase 2: Reorganize Structure
- [ ] Review current structure against `docs/COMPONENT_ORGANIZATION.md`
- [ ] Create any missing category folders:
  - [ ] `apps/web/components/ui/` - UI primitives
  - [ ] `apps/web/components/shared/` - Shared components
  - [ ] `apps/web/components/programme/` - Programme/curriculum
  - [ ] `apps/web/components/business/` - My Business OS
  - [ ] `apps/web/components/coaching/` - Coaching
  - [ ] `apps/web/components/campaign/` - Campaign Studio
  - [ ] `apps/web/components/studio/` - Canvas editor
  - [ ] `apps/web/components/community/` - Community
  - [ ] `apps/web/components/admin/` - Admin
  - [ ] `apps/web/components/navigation/` - Navigation
  - [ ] `apps/web/components/illustrations/` - Illustrations

#### Phase 3: Add Barrel Exports
- [ ] Create `index.ts` in each category:
  ```typescript
  // apps/web/components/ui/index.ts
  export { Button, type ButtonProps } from './Button';
  export { Card, type CardProps } from './Card';
  export { Badge, type BadgeProps } from './Badge';
  ```

#### Phase 4: Update Imports
- [ ] Update imports to use barrel exports:
  ```typescript
  // Before
  import { Button } from '@/components/ui/Button';
  import { Card } from '@/components/ui/Card';
  
  // After
  import { Button, Card } from '@/components/ui';
  ```

**Deliverables:**
- [ ] Components organized by feature/category
- [ ] Barrel exports in place
- [ ] Imports updated
- [ ] No orphaned components

### Week 4: Utilities Consolidation

#### Phase 1: Audit Utilities
```bash
# Find scattered utility functions
find apps/web/lib -name "*util*" -o -name "*helper*" | sort
grep -r "^export function" apps/web/lib --include="*.ts" | head -50
```

#### Phase 2: Create Utils Structure
- [ ] Create `apps/web/lib/utils/` directory
- [ ] Create category subdirectories:
  - [ ] `string/` - String manipulation
  - [ ] `date/` - Date operations
  - [ ] `array/` - Array operations
  - [ ] `object/` - Object operations
  - [ ] `math/` - Math operations
  - [ ] `validation/` - Input validation
  - [ ] `format/` - Formatting utilities
  - [ ] `async/` - Async/promise helpers
  - [ ] `dom/` - DOM operations

#### Phase 3: Consolidate Utilities
```bash
# Move and consolidate utilities
# Example: consolidate string helpers
mv apps/web/lib/campaign/string-helpers.ts apps/web/lib/utils/string/
```

#### Phase 4: Create Master Index
```typescript
// apps/web/lib/utils/index.ts
export * from './string';
export * from './date';
export * from './array';
export * from './object';
export * from './math';
export * from './validation';
export * from './format';
export * from './async';
export * from './dom';
```

#### Phase 5: Update Imports
```typescript
// Before
import { truncate } from '@/lib/campaign/helpers';
import { formatDate } from '@/lib/acquisition/utils';

// After
import { truncate, formatDate } from '@/lib/utils';
```

**Deliverables:**
- [ ] `apps/web/lib/utils/` fully structured
- [ ] All utilities consolidated
- [ ] No duplicate implementations
- [ ] Master index in place
- [ ] All imports updated

### Week 5: Verification & Polish

#### Phase 1: Linting & Type Checking
```bash
# Run full checks
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

#### Phase 2: Documentation
- [ ] Review all documentation files
- [ ] Add team-specific notes
- [ ] Create quick-reference guide for developers

#### Phase 3: Testing
- [ ] Run full test suite
- [ ] Check test coverage
- [ ] Add tests for new utilities/hooks

#### Phase 4: Team Alignment
- [ ] Share documentation with team
- [ ] Schedule training session
- [ ] Create onboarding guide for new team members

**Deliverables:**
- [ ] All checks passing
- [ ] Updated documentation
- [ ] Team training completed
- [ ] Onboarding guide created

## Configuration Files

### .editorconfig

Ensure consistent formatting across IDEs:

```
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{ts,tsx,js,jsx}]
indent_style = space
indent_size = 2

[*.md]
max_line_length = off
trim_trailing_whitespace = false
```

### .vscode/settings.json

Configure VSCode for the team:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "eslint.enable": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Validation Checklist

### Pre-Commit Checklist
- [ ] All files lint without errors
- [ ] Type checking passes
- [ ] Tests pass (if modified)
- [ ] Commit message follows conventions

### Pre-Push Checklist
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Code coverage maintained
- [ ] No console errors

### Code Review Checklist
- [ ] Follows component organization principles
- [ ] Uses centralized hooks from `@/lib/hooks`
- [ ] Uses utilities from `@/lib/utils`
- [ ] Has JSDoc comments for complex functions
- [ ] Includes tests for new functionality
- [ ] Import order follows conventions
- [ ] No unused imports or variables

## Common Tasks

### Add a New Component

```bash
# 1. Create component file
mkdir -p apps/web/components/business/NewComponent
touch apps/web/components/business/NewComponent.tsx
touch apps/web/components/business/NewComponent.test.tsx

# 2. Implement component
# See docs/COMPONENT_ORGANIZATION.md for structure

# 3. Update barrel export
# Edit apps/web/components/business/index.ts
# export { NewComponent, type NewComponentProps } from './NewComponent';

# 4. Test
pnpm test
```

### Add a New Hook

```bash
# 1. Determine category (form, data-fetching, etc)

# 2. Create hook file
touch apps/web/lib/hooks/{category}/useNewHook.ts

# 3. Implement hook with JSDoc

# 4. Update category index
# Edit apps/web/lib/hooks/{category}/index.ts
# export { useNewHook } from './useNewHook';

# 5. Master index auto-exports via category export

# 6. Test
pnpm test
```

### Add a New Utility

```bash
# 1. Determine category (string, date, array, etc)

# 2. Create utility file
touch apps/web/lib/utils/{category}/newUtility.ts

# 3. Implement utility with JSDoc and tests

# 4. Update category index
# Edit apps/web/lib/utils/{category}/index.ts
# export { newUtility } from './newUtility';

# 5. Master index auto-exports via category export

# 6. Test
pnpm test -- lib/utils/{category}/newUtility.test.ts
```

## Troubleshooting

### Git Hooks Not Running

```bash
# Check hook permissions
ls -la .husky/

# Make executable if needed
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
chmod +x .husky/commit-msg

# Test hook
git hook run pre-commit
```

### Import Errors After Reorganization

```bash
# Run type checking to find issues
pnpm typecheck

# Run linting to catch import problems
pnpm lint --fix

# Search for old import paths
grep -r "from '@/components/programme/useEnrollment'" apps/web/
```

### Linting Failures

```bash
# Run linting with auto-fix
pnpm lint --fix

# Check specific file
pnpm eslint apps/web/components/MyComponent.tsx

# View specific rule
pnpm eslint --debug apps/web/components/MyComponent.tsx
```

## Resources

- TypeScript Handbook: https://www.typescriptlang.org/docs/
- React Documentation: https://react.dev/
- ESLint Documentation: https://eslint.org/docs/
- Conventional Commits: https://www.conventionalcommits.org/
- Git Hooks Documentation: https://git-scm.com/docs/githooks

## Getting Help

For questions about:
- **Component organization**: See `docs/COMPONENT_ORGANIZATION.md`
- **Code style**: See `docs/CODE_STYLE_GUIDE.md`
- **Utilities**: See `docs/UTILITIES_CONSOLIDATION.md`
- **Git hooks**: Run `git hook run --help`
- **ESLint**: Run `pnpm eslint --help`

## Maintenance

### Monthly Review
- [ ] Check for new utilities that could be consolidated
- [ ] Review and update documentation
- [ ] Audit component organization
- [ ] Check hook usage patterns

### Quarterly Review
- [ ] Assess linting rule effectiveness
- [ ] Review code coverage trends
- [ ] Update style guide based on learnings
- [ ] Plan next organizational improvements

## Next Steps

After completing implementation:

1. **Team Training**: Hold a 1-hour session on new structure
2. **Documentation**: Ensure all team members have access
3. **Code Review**: Update review checklist to enforce new standards
4. **Monitoring**: Track metrics on code quality and development velocity
5. **Iteration**: Gather feedback and refine as needed
