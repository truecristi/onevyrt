# Why & Creed Error Display Integration

## Overview

The `WhyAndCreedErrorDisplay` component reminds users of their purpose during friction moments (errors, failures, loading states). It displays their personal "Why" (purpose) and "Creed" (commitment) on error pages and fallback modals to provide emotional support and psychological continuity.

**Why it matters:** When users hit errors, they lose momentum. Showing their deeper purpose re-anchors them to *why they started* and makes recovery more likely.

---

## Architecture

### Component Structure

```
WhyAndCreedErrorDisplay (main export)
├── CompactErrorDisplay (default, ~20 KB visible area)
├── StandardErrorDisplay (full modal, ~100% width)
└── MinimalErrorDisplay (toast/notification, inline)
```

### Variants

| Variant | Use Case | Size | Visual Style |
|---------|----------|------|--------------|
| **compact** (default) | Modal footers, error cards, sidebar | ~100px tall | Gradient card, soft glow |
| **standard** | Dedicated error modals, error pages | ~200px tall | Full featured, hero-style |
| **minimal** | Toasts, notifications, inline errors | ~40px tall | Inline chip with hover tooltip |

---

## Usage Patterns

### 1. Error Modal (Standard Variant)

```tsx
// components/errors/ErrorModal.tsx
"use client";

import { useState, useEffect } from "react";
import { WhyAndCreedErrorDisplay } from "@/components/dashboard/WhyAndCreedErrorDisplay";
import { useRouter } from "next/navigation";

interface ErrorModalProps {
  title: string;
  message: string;
  workspaceId?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function ErrorModal({
  title,
  message,
  workspaceId,
  onRetry,
  onClose,
}: ErrorModalProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md space-y-4 shadow-2xl">
        {/* Error content */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {message}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Dismiss
          </button>
        </div>

        {/* Why & Creed reminder */}
        {workspaceId && (
          <WhyAndCreedErrorDisplay
            workspaceId={workspaceId}
            variant="standard"
            onRefocus={() => router.push("/command-center")}
            onClose={onClose}
            showClose={false}
          />
        )}
      </div>
    </div>
  );
}
```

**Usage in error boundary:**

```tsx
// Error caught in component tree
try {
  // async operation
} catch (error) {
  setErrorState({
    title: "Couldn't Save Your Changes",
    message: "The server encountered an error. Please try again.",
    workspaceId,
  });
}

return <ErrorModal {...errorState} onRetry={handleRetry} />;
```

### 2. Error Boundary Integration

```tsx
// components/errors/ErrorBoundary.tsx
"use client";

import { Component, ReactNode } from "react";
import { WhyAndCreedErrorDisplay } from "@/components/dashboard/WhyAndCreedErrorDisplay";

interface Props {
  children: ReactNode;
  workspaceId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("Error caught in boundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md space-y-6">
            {/* Error message */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Oops, something went wrong
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                We're having trouble loading this page. Let's get you back on track.
              </p>
            </div>

            {/* Why & Creed reminder */}
            <WhyAndCreedErrorDisplay
              workspaceId={this.props.workspaceId}
              variant="standard"
              onRefocus={() => window.location.href = "/command-center"}
              showClose={false}
            />

            {/* Action buttons */}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage:
// <ErrorBoundary workspaceId={workspaceId}>
//   <YourComponent />
// </ErrorBoundary>
```

### 3. Error Toast (Minimal Variant)

```tsx
// hooks/useErrorToast.ts
import { useState, useCallback } from "react";

export function useErrorToast() {
  const [error, setError] = useState<{ message: string; workspaceId?: string } | null>(null);

  const showError = useCallback((message: string, workspaceId?: string) => {
    setError({ message, workspaceId });
    setTimeout(() => setError(null), 5000); // Auto-dismiss after 5s
  }, []);

  const dismiss = useCallback(() => setError(null), []);

  return { error, showError, dismiss };
}

// Usage in component:
export function MyComponent() {
  const { error, showError, dismiss } = useErrorToast();
  const workspaceId = useWorkspaceId();

  const handleSave = async () => {
    try {
      // API call
    } catch (err) {
      showError("Failed to save. Please try again.", workspaceId);
    }
  };

  return (
    <div>
      {error && (
        <div className="fixed bottom-4 right-4 space-y-2">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-900 dark:text-red-100">
            {error.message}
          </div>

          {/* Optional: Show why/creed in toast footer */}
          <WhyAndCreedErrorDisplay
            workspaceId={error.workspaceId}
            variant="minimal"
            onClose={dismiss}
          />
        </div>
      )}
    </div>
  );
}
```

### 4. API Error Response Handler

```tsx
// lib/api-error-handler.ts
import { WhyAndCreedErrorDisplay } from "@/components/dashboard/WhyAndCreedErrorDisplay";

interface ErrorContext {
  workspaceId?: string;
  message: string;
  status: number;
  url: string;
}

export function handleApiError(context: ErrorContext) {
  const { message, status, workspaceId } = context;

  // Determine error type
  if (status === 401) {
    // Redirect to login (don't show why/creed)
    window.location.href = "/login";
    return;
  }

  if (status === 403) {
    // Permission error with why/creed reminder
    showPermissionError(workspaceId);
    return;
  }

  if (status >= 500) {
    // Server error with why/creed reminder
    showServerError(message, workspaceId);
    return;
  }

  // Generic client error
  showGenericError(message, workspaceId);
}

function showPermissionError(workspaceId?: string) {
  // Render modal with WhyAndCreedErrorDisplay (standard variant)
  // "You don't have permission to do that."
}

function showServerError(message: string, workspaceId?: string) {
  // Render modal with WhyAndCreedErrorDisplay (standard variant)
  // "Something went wrong on our end. Please try again."
}

function showGenericError(message: string, workspaceId?: string) {
  // Render toast with WhyAndCreedErrorDisplay (minimal variant)
}
```

### 5. Offline Error Page

```tsx
// app/errors/offline/page.tsx
"use client";

import { WhyAndCreedErrorDisplay } from "@/components/dashboard/WhyAndCreedErrorDisplay";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OfflineErrorPage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string>();

  useEffect(() => {
    // Get workspace ID from session
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((user) => setWorkspaceId(user.workspaceId));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl mb-4">📡</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            No Connection
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            You're currently offline. Let's remind you why this matters while you reconnect.
          </p>
        </div>

        {workspaceId && (
          <WhyAndCreedErrorDisplay
            workspaceId={workspaceId}
            variant="standard"
            onRefocus={() => router.push("/command-center")}
          />
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Try Reconnecting
        </button>
      </div>
    </div>
  );
}
```

---

## Component API Reference

### Props

```typescript
interface WhyAndCreedErrorDisplayProps {
  // Optional why/creed data (if pre-fetched)
  data?: WhyAndCreedData | null;

  // Workspace ID (required to auto-fetch data if not provided)
  workspaceId?: string;

  // Callback when user clicks "Refocus on Why"
  // Default: navigate to /command-center
  onRefocus?: () => void;

  // Callback when user closes the component
  onClose?: () => void;

  // Size variant
  // @default "compact"
  variant?: "compact" | "standard" | "minimal";

  // Show close button (standard variant only)
  // @default true
  showClose?: boolean;
}
```

### Variants Detailed

#### Compact (Default)
- **Visual:** Gradient card with soft glow
- **Height:** ~100px
- **Best for:** Modal footers, sidebar error cards, embedded displays
- **Auto-fetches:** Yes
- **Close button:** No

```tsx
<WhyAndCreedErrorDisplay
  workspaceId={id}
  variant="compact"
/>
```

#### Standard
- **Visual:** Hero-style display with full content
- **Height:** ~200px
- **Best for:** Dedicated error modals, full error pages
- **Auto-fetches:** Yes
- **Close button:** Optional (controlled via `showClose` prop)

```tsx
<WhyAndCreedErrorDisplay
  workspaceId={id}
  variant="standard"
  onRefocus={() => router.push("/command-center")}
  showClose={true}
/>
```

#### Minimal
- **Visual:** Inline chip with hover tooltip
- **Height:** ~40px
- **Best for:** Toasts, notifications, error banners
- **Auto-fetches:** Yes
- **Close button:** No (use `onClose` for dismiss)

```tsx
<WhyAndCreedErrorDisplay
  workspaceId={id}
  variant="minimal"
  onClose={() => setErrorShown(false)}
/>
```

---

## Design Details

### Colors & Theming

- **Primary gradient:** Blue (#2563eb) → Purple (#a855f7)
- **Background cards:** Gradient from `from-blue-50 to-purple-50` (light), `from-blue-950/40 to-purple-950/40` (dark)
- **Text:** Slate-900 (light), white (dark)
- **Borders:** Blue-200/60 (light), Blue-800/40 (dark)
- **Accents:** Blue-600 heart icon, purple dividers

### Animations

1. **Loading state:** Subtle pulse (`animate-pulse`)
2. **Background glow:** `group-hover:scale-110` (smooth 700ms transition)
3. **Energy dots:** Staggered pulse with 150ms delays
4. **Button hover:** Shadow + scale (active state: `active:scale-95`)

### Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support (Tab to focus, Enter to activate)
- Color contrast: WCAG AA compliant (min 4.5:1)
- Semantic HTML (buttons, headings)
- No autoplay animations (only triggered by hover/interaction)

---

## Dark Mode

Full dark mode support via Tailwind CSS `dark:` variants:

- Text colors adapt (white text in dark mode)
- Backgrounds use dark slate + color-specific overlays
- Borders use darker, softer variants
- Icons scale appropriately

---

## Performance Considerations

### Bundle Size
- Component: ~3 KB (gzipped)
- Icons: Imported from `lucide-react` (tree-shakeable)
- No external dependencies beyond React

### Loading & Fetching
- Lazy-loads why/creed only if `workspaceId` provided
- Fetch request debounced (single request per mount)
- Falls back gracefully if fetch fails (returns null)
- No re-renders on error

### Rendering
- Memoization via state management (not re-fetching on parent re-renders)
- Conditional rendering: null if no data
- Three optimized render paths (compact/standard/minimal)

---

## Integration Checklist

- [ ] Import `WhyAndCreedErrorDisplay` in error component
- [ ] Pass `workspaceId` from user context
- [ ] Choose appropriate variant (`compact`, `standard`, or `minimal`)
- [ ] Implement `onRefocus` callback (or use default `/command-center`)
- [ ] Implement `onClose` callback if needed
- [ ] Test in light & dark modes
- [ ] Verify API fetch succeeds (check `/api/workspace/[id]/why-creed` route)
- [ ] Test fallback behavior when why/creed not set

---

## Testing

### Unit Tests (Jest)

```typescript
import { render, screen } from "@testing-library/react";
import { WhyAndCreedErrorDisplay } from "@/components/dashboard/WhyAndCreedErrorDisplay";

describe("WhyAndCreedErrorDisplay", () => {
  it("renders compact variant by default", () => {
    const { container } = render(
      <WhyAndCreedErrorDisplay data={{ workspaceId: "ws-1", why: "Test why", creed: "Test creed" }} />
    );
    expect(container.firstChild).toHaveClass("space-y-2");
  });

  it("renders standard variant correctly", () => {
    const { container } = render(
      <WhyAndCreedErrorDisplay
        data={{ workspaceId: "ws-1", why: "Test why", creed: "Test creed" }}
        variant="standard"
      />
    );
    expect(container.firstChild).toHaveClass("group", "relative");
  });

  it("returns null when no data and no workspaceId", () => {
    const { container } = render(<WhyAndCreedErrorDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onRefocus when button clicked", async () => {
    const onRefocus = jest.fn();
    const { getByText } = render(
      <WhyAndCreedErrorDisplay
        data={{ workspaceId: "ws-1", why: "Test why", creed: "Test creed" }}
        onRefocus={onRefocus}
      />
    );
    getByText("Refocus on Why").click();
    expect(onRefocus).toHaveBeenCalled();
  });
});
```

### Visual Testing
- Screenshot tests in Storybook or Chromatic
- Dark mode toggle verification
- Responsive design check (mobile, tablet, desktop)

### Manual Testing
1. Trigger an error page / open error modal
2. Verify why/creed displays correctly
3. Click "Refocus on Why" → should navigate to `/command-center`
4. Test in dark mode
5. Test offline (network throttle) → should still show after fetch timeout

---

## Troubleshooting

### Component returns null / nothing displays

**Cause:** No data and no workspaceId provided
**Fix:** Pass either `data` prop or `workspaceId` to enable fetching

### Why/creed not loading

**Cause:** Workspace ID incorrect, user not authenticated, or API route not found
**Fix:** Verify `/api/workspace/[id]/why-creed` exists and returns data
**Debug:** Check browser console for fetch errors

### Styling looks broken in dark mode

**Cause:** Tailwind dark mode not enabled in parent layout
**Fix:** Ensure `dark:` class is on root HTML element or parent container

### Button doesn't navigate

**Cause:** No `onRefocus` callback and `/command-center` doesn't exist
**Fix:** Provide `onRefocus` callback that navigates to valid route

---

## Files Modified / Created

- `apps/web/components/dashboard/WhyAndCreedErrorDisplay.tsx` (NEW) — Main component
- `docs/WHY_CREED_ERROR_INTEGRATION.md` (NEW) — This documentation
- `apps/web/components/errors/ErrorModal.tsx` (Example) — Reference implementation
- `apps/web/components/errors/ErrorBoundary.tsx` (Example) — Reference implementation

---

## Related Components

- `WhyAndCreedSection` — Dashboard display of why/creed (primary context)
- `WhyAndCreedReflection` — Guided reflection for setting why/creed
- `WhyAndCreedMetrics` — Metrics tracking related to why/creed alignment
- `Toast` — Generic toast notification component

---

## Future Enhancements

- [ ] Sharing why/creed with coach (social feature)
- [ ] Why/creed history tracking (version control)
- [ ] Reminders to re-read why/creed (scheduled notifications)
- [ ] Progress tracking relative to why/creed (alignment metrics)
- [ ] Animated transitions between error states
- [ ] Multiple why/creed variants per workspace (context-specific purpose)

---

## Q&A

**Q: Should I show why/creed on all error pages?**
A: Only on user-facing errors (auth, permission, server errors). Not on 404s (user in wrong place), 401s (redirect to login), or system maintenance.

**Q: Can I pre-fetch why/creed data to avoid latency?**
A: Yes, pass the `data` prop directly. Useful for server-side rendering or if fetched in parent component.

**Q: What if the user hasn't set their why/creed yet?**
A: Component returns null gracefully. No why/creed reminder shown. Consider adding a CTA to set it in the error message itself.

**Q: Should I use this in API error handlers?**
A: Only for client-side presentation errors. For API-level errors (validation, business logic), show the error message first, then optionally add why/creed as secondary motivation.

**Q: Does this work with API route errors?**
A: Yes, implement in error boundaries or catch blocks that render UI. The component fetches on mount, so timing shouldn't be an issue.

---

## Support

For questions or issues:
1. Check error console for fetch/rendering errors
2. Verify workspace_why_creed table has data for the workspace
3. Ensure `/api/workspace/[id]/why-creed` API route exists
4. Review CLAUDE.md "Why & Creed" section for context
