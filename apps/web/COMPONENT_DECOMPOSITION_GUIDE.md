# Component Decomposition & Refactoring Guide

## Overview

This guide documents the strategy for decomposing large monolithic React components into smaller, reusable, and maintainable modules. The ONEVYRT codebase contains several giant components (1600–4200 lines) that violate composition best practices and hurt maintainability, testing, and bundle optimization.

## Current State

### Largest Components (By Line Count)

| Component | Lines | Location | Status |
|-----------|-------|----------|--------|
| funnel-studio.tsx | 4,191 | `app/funnel-studio.tsx` | In progress |
| ProgramCentre.tsx | 1,657 | `components/ProgramCentre.tsx` | Planned |
| ProgrammeCentre.tsx | 908 | `components/ProgrammeCentre.tsx` | Planned |
| InspectorPanels.tsx | 699 | `components/studio/InspectorPanels.tsx` | **Partially refactored** |
| QualificationWizard.tsx | 647 | `components/qualify/QualificationWizard.tsx` | Planned |
| AccountSettingsModal.tsx | 591 | `components/AccountSettingsModal.tsx` | Planned |
| LessonGuide.tsx | 556 | `components/LessonGuide.tsx` | Planned |

## Refactoring Strategy

### Phase 1: Create Reusable Shared Component Library

**Status:** ✅ Complete

**Location:** `apps/web/components/shared/`

**Components Created:**
- `Button.tsx` - Reusable button with variants (primary, ghost, btn, danger)
- `Card.tsx` - Consistent card layout (default, glass, surface variants)
- `Tabs.tsx` - Tab switcher with compact and default modes
- `StatusBadge.tsx` - Status indicator with color coding
- `index.ts` - Barrel export for easy imports

**Usage Pattern:**
```typescript
import { Button, Card, Tabs, StatusBadge } from "@/components/shared";

export function MyComponent() {
  return (
    <Card variant="glass">
      <Button variant="primary">Click me</Button>
      <StatusBadge status="success" label="Active" />
    </Card>
  );
}
```

### Phase 2: Extract Studio Sub-Components

**Status:** ✅ Started (InspectorPanels partial)

**Location:** `apps/web/components/studio/inspector/`

**Components/Utilities Extracted:**
- `FormFields.tsx` - Form input components (Field, InspField, NumBox, StatBox)
- `utils.ts` - Calculation and helper functions (uiOf, activeVariants, weightedPrice, netPerSale)
- `index.ts` - Barrel export

**Pattern:**
1. Identify cohesive sub-sections of a large component
2. Extract into focused, single-responsibility files
3. Create utilities for calculations/transformations
4. Keep the parent component as an orchestrator
5. Re-export from parent for backward compatibility

**Benefits:**
- Easier to test individual functions
- Better code organization
- Enables tree-shaking of unused utilities
- Clearer data flow

### Phase 3: Extract Large Component Sections

**Planned Extractions:**

#### funnel-studio.tsx (4,191 → target ~1,200 lines)

**Header/Navigation Section:**
```
components/studio/funnel-studio/
├── FunnelStudioHeader.tsx         (Project name, undo/redo, nav)
├── LoopStepper.tsx                (Plan/Actual/Review/Simulate/Decide)
├── CoachBand.tsx                  ("Next move" coach hint)
├── ToolModeSwitcher.tsx           (Guide/Pro/Guided mode toggle)
└── ExampleNumbersBanner.tsx       (Starter project notice)
```

**Canvas Section:**
```
components/studio/funnel-studio/
├── FunnelCanvasContainer.tsx      (Canvas wrapper with toolbar)
├── CanvasToolbar.tsx              (Node operations, cut/copy/paste)
└── EmptyCanvasState.tsx           (Empty state + AI builder prompt)
```

**Inspector/Editor Panel:**
```
components/studio/funnel-studio/
├── InspectorContainer.tsx         (Resize handle, title, close)
├── NodeEditor.tsx                 (Block size, icon, note)
└── ModeSwitcher.tsx               (Tabs for inspector modes)
```

**Modals & Overlays:**
```
components/studio/funnel-studio/modals/
├── TemplateGalleryModal.tsx
├── SetupWizardModal.tsx
├── AccountSettingsModal.tsx
├── SubscriptionModal.tsx
├── ProgrammeEnrollmentModal.tsx
└── AiFunnelBuilderModal.tsx
```

**Analysis Panels:**
```
components/studio/funnel-studio/panels/
├── VariancePanel.tsx              (Review profit leaks)
├── CalibratePanel.tsx             (Propose→apply)
├── DecisionPanel.tsx              (Decision log)
├── ReportPanel.tsx                (Full scoreboard)
├── SimulatePanel.tsx              (Test a fix)
└── GoalSolverPanel.tsx            (Solve for goals)
```

#### ProgramCentre.tsx (1,657 → target ~500 lines)

**Tab Containers:**
```
components/programme-centre/
├── DefineTab.tsx                  (Business definition)
├── StoryTab.tsx                   (Business story)
├── SevenSystemsTab.tsx            (Force actions)
├── MoneyMachineTab.tsx            (Money machine config)
├── ProfitDriversTab.tsx           (Profit drivers)
├── ObjectionsTab.tsx              (Objections/hooks)
├── PromisesTab.tsx                (Client promises)
├── GoalsTab.tsx                   (Goals/outcomes)
├── AssumptionsTab.tsx             (Assumptions/risks)
├── ExperimentsTab.tsx             (Experiments/decisions)
└── ReportTab.tsx                  (Business report)
```

## Refactoring Workflow

### Step 1: Identify Extraction Boundaries

- Look for logical UI sections that could stand alone
- Find groups of related state variables
- Identify components that could be reused elsewhere
- Find calculations that should be utilities

### Step 2: Extract Utilities First

**Before:**
```typescript
// In huge component
function someCalculation(a: number, b: number): number {
  // 10+ lines of math
}
```

**After:**
```typescript
// In utils.ts
export function someCalculation(a: number, b: number): number {
  // Same logic
}

// In component
import { someCalculation } from "./utils";
```

### Step 3: Extract Components

**Before:**
```typescript
export function HugeComponent({ state, setState, ...props }) {
  return (
    <>
      <Section1>...</Section1>
      <Section2>...</Section2>
      <Section3>...</Section3>
    </>
  );
}
```

**After:**
```typescript
// HugeComponent.tsx
import Section1 from "./Section1";
import Section2 from "./Section2";
import Section3 from "./Section3";

export function HugeComponent({ state, setState, ...props }) {
  return (
    <>
      <Section1 state={state.section1} setState={setState} />
      <Section2 state={state.section2} setState={setState} />
      <Section3 state={state.section3} setState={setState} />
    </>
  );
}

// Section1.tsx
export function Section1({ state, setState }: Props) {
  return <div>{/* UI */}</div>;
}
```

### Step 4: Create Barrel Exports

**Pattern:**
```typescript
// components/feature/index.ts
export { Component1 } from "./Component1";
export { Component2 } from "./Component2";
export * from "./utils";

// Usage
import { Component1, Component2, helperFunction } from "@/components/feature";
```

### Step 5: Test & Validate

```bash
# Run tests to ensure no regressions
npm run test

# Build and check bundle size
npm run build
npm run analyze  # if available
```

## Key Principles

### 1. State Management Strategy

**Keep state at the top level** (parent component) to avoid excessive prop drilling.

**Don't:** Create new state in every extracted component.
```typescript
// BAD - nested state management
function Parent() {
  const [expanded, setExpanded] = useState(false);
  return <Child />;
}
function Child() {
  const [selected, setSelected] = useState(null);
  return <div />;
}
```

**Do:** Lift state to the component that needs to manage it.
```typescript
// GOOD - centralized state
function Parent() {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  return <Child expanded={expanded} selected={selected} onSelect={setSelected} />;
}
```

### 2. Type Safety

Create shared type definitions for cross-component props:

```typescript
// types.ts
export interface InspectorProps {
  nodeId: string;
  data: NodeData;
  onUpdate: (id: string, data: Partial<NodeData>) => void;
}

// Section1.tsx
import type { InspectorProps } from "./types";
export function Section1({ nodeId, data, onUpdate }: InspectorProps) {
  // ...
}
```

### 3. Memoization

Use `React.memo()` on extracted components to prevent unnecessary re-renders:

```typescript
export const Card = React.memo(function Card({ title, children }: Props) {
  return (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  );
});
```

### 4. Backward Compatibility

Always re-export extracted components/functions from the original file:

```typescript
// InspectorPanels.tsx
import { Field, NumBox } from "./inspector";

// Re-export for backward compatibility
export { Field, NumBox };
```

This ensures existing imports don't break.

### 5. Performance Considerations

- **Code Splitting:** Large modal/panel components should be lazy-loaded
- **Bundle Size:** Tree-shaking unused utilities when components are decomposed
- **Re-render Optimization:** Use callbacks and memoization strategically

## Testing

### Unit Testing Extracted Components

```typescript
// Component1.test.tsx
import { render, screen } from "@testing-library/react";
import { Component1 } from "./Component1";

describe("Component1", () => {
  it("renders correctly", () => {
    render(<Component1 />);
    expect(screen.getByText("Expected text")).toBeInTheDocument();
  });
});
```

### Integration Testing

Ensure parent components still work after extraction:

```typescript
// HugeComponent.test.tsx
import { render } from "@testing-library/react";
import { HugeComponent } from "./HugeComponent";

describe("HugeComponent", () => {
  it("integrates sub-components correctly", () => {
    const { getByTestId } = render(<HugeComponent />);
    expect(getByTestId("section1")).toBeInTheDocument();
    expect(getByTestId("section2")).toBeInTheDocument();
  });
});
```

## Progress Tracking

### Completed

- ✅ Shared component library (Button, Card, Tabs, StatusBadge)
- ✅ Inspector sub-components & utilities (FormFields.tsx, utils.ts)

### In Progress

- 🟡 funnel-studio.tsx decomposition
- 🟡 ProgramCentre.tsx decomposition

### Planned

- 🔵 ProgrammeCentre.tsx decomposition
- 🔵 QualificationWizard.tsx decomposition
- 🔵 AccountSettingsModal.tsx decomposition
- 🔵 LessonGuide.tsx decomposition

## Performance Impact

**Expected Bundle Size Reduction:**
- Tree-shaking of unused utilities: 10–20KB
- Lazy-loading of modals/panels: 30–50KB
- Better code organization: 5–10KB smaller gzip size

**Development Experience:**
- Faster component lookup (no 4000+ line files)
- Easier to test individual sections
- Better IDE performance (smaller files)
- Clearer code ownership boundaries

## Troubleshooting

### Issue: "Cannot find module" after extraction

**Solution:** Verify barrel exports are in place:
```typescript
// components/feature/index.ts
export { Component1 } from "./Component1";
export { Component2 } from "./Component2";
```

### Issue: Props drilling becomes excessive

**Solution:** Consider using Context API for deeply nested data:
```typescript
export const ComponentContext = createContext();

// Parent
<ComponentContext.Provider value={{ state, setState }}>
  <Child1 />
</ComponentContext.Provider>

// Deep child
const { state } = useContext(ComponentContext);
```

### Issue: Component not updating after extraction

**Solution:** Ensure state updates are properly passed down:
```typescript
// Parent passes handler
<Child value={state.value} onChange={(v) => setState({...state, value: v})} />

// Child uses handler
<input value={value} onChange={(e) => onChange(e.target.value)} />
```

## Further Reading

- [React Component Composition](https://react.dev/learn/extracting-state-logic-into-a-reducer)
- [Component Patterns](https://www.patterns.dev/posts/component-composition-pattern/)
- [File Organization](https://stackoverflow.com/questions/23374212/confused-about-directory-and-file-structure-of-large-apps-in-javascript-spa-frame)

## Questions or Feedback?

Contact the maintainers or create a discussion in the repository.
