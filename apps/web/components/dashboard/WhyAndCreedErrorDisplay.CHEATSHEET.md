# WhyAndCreedErrorDisplay - Quick Reference

## Import

```tsx
import { WhyAndCreedErrorDisplay } from "@/components/dashboard/WhyAndCreedErrorDisplay";
```

## Three Variants

### 1. Compact (Default) - Modal Footers & Inline

```tsx
<WhyAndCreedErrorDisplay
  workspaceId={workspaceId}
  variant="compact"
  onRefocus={() => router.push("/command-center")}
/>
```

**Best for:** Error modals, sidebar cards, embedded displays
**Size:** ~100px tall
**Features:** Auto-fetches data, shows why + creed preview

### 2. Standard - Full Error Pages & Dedicated Modals

```tsx
<WhyAndCreedErrorDisplay
  workspaceId={workspaceId}
  variant="standard"
  onRefocus={() => router.push("/command-center")}
  onClose={closeHandler}
  showClose={true}
/>
```

**Best for:** Full error pages, dedicated error modals
**Size:** ~200px tall
**Features:** Hero design, full content, close button

### 3. Minimal - Toasts & Notifications

```tsx
<WhyAndCreedErrorDisplay
  workspaceId={workspaceId}
  variant="minimal"
  onClose={dismissHandler}
/>
```

**Best for:** Toast notifications, error banners
**Size:** ~40px tall
**Features:** Inline chip, hover tooltip

---

## Common Patterns

### Error Modal

```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md space-y-4">
    <h2 className="text-xl font-bold">Error Title</h2>
    <p className="text-slate-600 dark:text-slate-400">Error message</p>

    <div className="flex gap-3">
      <button>Retry</button>
      <button>Dismiss</button>
    </div>

    <WhyAndCreedErrorDisplay
      workspaceId={id}
      variant="standard"
      onRefocus={() => router.push("/command-center")}
      showClose={false}
    />
  </div>
</div>
```

### Error Boundary

```tsx
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";

export default function Page() {
  return (
    <ErrorBoundary workspaceId={workspaceId}>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### Toast Hook

```tsx
const { error, showError, dismiss } = useErrorToast();

return (
  <>
    {error && (
      <div className="fixed bottom-4 right-4 space-y-2">
        <div className="bg-red-50 p-4 rounded-lg">{error.message}</div>
        <WhyAndCreedErrorDisplay
          workspaceId={error.workspaceId}
          variant="minimal"
          onClose={dismiss}
        />
      </div>
    )}
  </>
);
```

---

## Props Cheatsheet

| Prop | Type | Default | Required? | Purpose |
|------|------|---------|-----------|---------|
| `data` | `WhyAndCreedData` | - | Optional | Pre-fetched why/creed data |
| `workspaceId` | `string` | - | Optional | Triggers auto-fetch if data not provided |
| `variant` | `"compact" \| "standard" \| "minimal"` | `"compact"` | Optional | Visual size variant |
| `onRefocus` | `() => void` | Navigates to `/command-center` | Optional | Callback on "Refocus on Why" click |
| `onClose` | `() => void` | - | Optional | Callback on close/dismiss |
| `showClose` | `boolean` | `true` | Optional | Show close button (standard variant only) |

---

## When to Use Each Variant

### Use `compact` when:
- Embedded in existing error modal/card
- Space is limited (modal footer, sidebar)
- You want to keep error UI focused on the error itself
- Most common use case

### Use `standard` when:
- Full error page (entire screen)
- Dedicated error modal (nothing else in modal)
- You want hero/featured display of why/creed
- User needs emotional reset before retrying

### Use `minimal` when:
- Toast/notification context
- Error banner at top/bottom of page
- Space is very constrained
- User should glance and move on

---

## Style Variants by Context

### Error Modal with Why/Creed (Best Pattern)

```
┌─────────────────────────┐
│  Error Title            │
│                         │
│  Error message...       │
│                         │
│  [Retry] [Dismiss]      │
│  ─────────────────────  │ ← separator
│  ┌───────────────────┐  │
│  │ 🎯 Your Why       │  │ ← WhyAndCreedErrorDisplay
│  │ Help entrepreneurs... │ (compact or standard)
│  │ ⚡ Your Creed    │  │
│  │ Always prioritize...  │
│  │ [Refocus on Why]  │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

### Error Boundary (Full Page)

```
┌────────────────────────────┐
│ Min-height: 100vh          │
│ Background: gradient       │
│                            │
│      Oops, something...    │
│      Let's refocus...      │
│                            │
│  ┌──────────────────────┐  │
│  │ Hero Why/Creed       │  │ ← WhyAndCreedErrorDisplay
│  │ (standard variant)   │  │ (takes most space)
│  │                      │  │
│  │ [Try Again]          │  │
│  └──────────────────────┘  │
│                            │
└────────────────────────────┘
```

### Toast Stack (Bottom Right)

```
┌──────────────────┐
│ ❌ Upload failed │
│ File too large   │
│                  │
│ [Remember Why]   │ ← WhyAndCreedErrorDisplay
│ (minimal variant)│
└──────────────────┘
```

---

## Data Flow

### With Pre-fetched Data (Recommended)

```tsx
// Fetch in server component or earlier
const whyCreedData = await getWhyAndCreed(workspaceId);

// Pass directly (no second fetch)
<WhyAndCreedErrorDisplay
  data={whyCreedData}
  variant="compact"
/>
```

**Benefit:** No loading state, instant render

### With Auto-fetch (Fallback)

```tsx
// Component fetches automatically
<WhyAndCreedErrorDisplay
  workspaceId={workspaceId}
  variant="compact"
/>
```

**Benefit:** Simple, no parent coordination needed
**Tradeoff:** Brief loading pulse while fetching

### Both Provided (Data takes precedence)

```tsx
<WhyAndCreedErrorDisplay
  data={preloadedData}
  workspaceId={workspaceId}
  // Uses data, ignores workspaceId
/>
```

---

## Common Mistakes

❌ **No workspaceId or data**
```tsx
<WhyAndCreedErrorDisplay variant="compact" />  // Renders nothing!
```

✅ **Pass one of them**
```tsx
<WhyAndCreedErrorDisplay workspaceId={id} variant="compact" />
```

---

❌ **Forgetting to handle onRefocus**
```tsx
<WhyAndCreedErrorDisplay workspaceId={id} />  // Navigates to /command-center
// May not exist in your app!
```

✅ **Always provide callback**
```tsx
<WhyAndCreedErrorDisplay
  workspaceId={id}
  onRefocus={() => router.push("/dashboard")}
/>
```

---

❌ **Overusing in error messages**
```tsx
// Every tiny error shows this
Every validation error → modal with why/creed
Every API 400 → modal with why/creed
// → Emotional numbing
```

✅ **Reserve for critical errors**
```tsx
// Only show for:
Server errors (500+)
Auth/permission issues (401/403)
Lost work/data scenarios
Network offline
```

---

## Testing

### Snapshot Test

```tsx
import { WhyAndCreedErrorDisplay } from "@/components/dashboard/WhyAndCreedErrorDisplay";

test("renders compact variant", () => {
  const { container } = render(
    <WhyAndCreedErrorDisplay
      data={{
        workspaceId: "ws-1",
        why: "Test why",
        creed: "Test creed",
      }}
    />
  );
  expect(container).toMatchSnapshot();
});
```

### Interaction Test

```tsx
test("calls onRefocus when button clicked", () => {
  const onRefocus = jest.fn();
  render(
    <WhyAndCreedErrorDisplay
      data={{ workspaceId: "ws-1", why: "Test", creed: "Test" }}
      onRefocus={onRefocus}
    />
  );

  fireEvent.click(screen.getByText("Refocus on Why"));
  expect(onRefocus).toHaveBeenCalled();
});
```

### Full Examples

See `WhyAndCreedErrorDisplay.examples.tsx` and `__tests__/WhyAndCreedErrorDisplay.test.tsx`

---

## Performance

- **Bundle size:** ~3 KB (gzipped)
- **Icons:** Tree-shakeable from lucide-react
- **API calls:** Single fetch on mount (only if workspaceId provided)
- **Re-renders:** Only on prop changes (not parent re-renders)

---

## Styling Customization

### Adjust colors (edit component source):

```tsx
// Change from blue/purple gradient to your brand
className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"
// → your-primary via-your-secondary to-your-accent
```

### Adjust sizing:

- `compact`: ~100px tall → remove `pb-6` to shrink
- `standard`: ~200px tall → adjust padding
- `minimal`: ~40px inline → already minimal

### Disable animations:

```tsx
// Remove .animate-pulse from loading skeletons
// Remove .group-hover:scale-110 from background glow
// Remove .animate-pulse from energy dots
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Nothing renders | Pass `workspaceId` or `data` prop |
| Data not loading | Check `/api/workspace/[id]/why-creed` API exists |
| Styles broken in dark mode | Ensure `dark:` classes enabled on parent |
| Button doesn't navigate | Provide `onRefocus` callback |
| Loading forever | API failing silently (check console) |

---

## Resources

- **Full docs:** `docs/WHY_CREED_ERROR_INTEGRATION.md`
- **Examples:** `WhyAndCreedErrorDisplay.examples.tsx`
- **Tests:** `__tests__/WhyAndCreedErrorDisplay.test.tsx`
- **Main component:** `WhyAndCreedErrorDisplay.tsx`
- **Related:** `WhyAndCreedSection.tsx` (dashboard version)
