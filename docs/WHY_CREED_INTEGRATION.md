# Why & Creed System — Integration Guide

## Overview

The **Why & Creed** system is a motivational feature that displays a user's personal "Why" (purpose) and "Creed" (commitment) prominently on the dashboard. This creates emotional energy and keeps users connected to their deeper purpose while working on their business.

## User Experience

### Empty State
When a user first logs in without a why/creed set:
- Large, inviting prompt: "Why Are You Here?"
- Call-to-action button: "Set Your Why & Creed"
- Encourages reflection and articulation of purpose

### Filled State
Once set, every dashboard view shows:
- **Gradient background** (blue → purple → pink) for visual impact
- **🎯 Your Why** — The user's purpose statement (large, bold text)
- **⚡ Your Creed** — Their personal commitment/values
- **Subtle animations** (pulsing dots, background movement on hover)
- **Edit button** (appears on hover)

### Edit Mode
- Clean form with two textarea inputs
- Placeholder text guides user reflection
- Large preview of what their dashboard will look like
- Save/Cancel buttons

## Components

### WhyAndCreedSection.tsx
**Path:** `apps/web/components/dashboard/WhyAndCreedSection.tsx`

**Props:**
```typescript
interface WhyAndCreedSectionProps {
  workspaceId: string;
  data?: WhyAndCreedData | null;
  onUpdate?: (data: WhyAndCreedData) => void;
}
```

**Features:**
- Three states: empty, viewing, editing
- Auto-save via `/api/workspace/[id]/why-creed`
- Dark mode support
- Responsive design (mobile, tablet, desktop)
- Animated background with hover effects

### why-creed.ts
**Path:** `apps/web/lib/dashboard/why-creed.ts`

**Functions:**
- `getWhyAndCreed(workspaceId)` — Fetch user's why/creed
- `saveWhyAndCreed(workspaceId, why, creed)` — Save/update
- `deleteWhyAndCreed(workspaceId)` — Soft delete

### API Route
**Path:** `apps/web/app/api/workspace/[id]/why-creed/route.ts`

**Endpoints:**
- `GET /api/workspace/[id]/why-creed` — Retrieve why/creed
- `POST /api/workspace/[id]/why-creed` — Save why/creed

**Payload:**
```typescript
{
  why: string;
  creed: string;
}
```

## Integration into Command Center

### Step 1: Import the Component

```tsx
import { WhyAndCreedSection } from "../../components/dashboard/WhyAndCreedSection";
```

### Step 2: Fetch Why/Creed Data

In the command-center page, add a useEffect to load the why/creed:

```tsx
const [whyCreedData, setWhyCreedData] = useState<WhyAndCreedData | null>(null);

useEffect(() => {
  const loadWhyCreed = async () => {
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/why-creed`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setWhyCreedData(data);
      }
    } catch (error) {
      console.error("Failed to load why/creed:", error);
    }
  };

  if (workspaceId) {
    loadWhyCreed();
  }
}, [workspaceId]);
```

### Step 3: Render at Top of Dashboard

Place the component at the very top of the command-center page, before any other sections:

```tsx
<div className="space-y-8">
  <WhyAndCreedSection
    workspaceId={workspaceId}
    data={whyCreedData}
    onUpdate={setWhyCreedData}
  />

  {/* Rest of dashboard sections */}
  <MomentumSection />
  <NextMoveCard />
  {/* ... */}
</div>
```

## Design System Integration

### Colors
- **Primary Gradient:** Blue (#2563eb) → Purple (#a855f7) → Pink (#ec4899)
- **Dark Mode:** Darker blues/purples with maintained contrast
- **Accent:** White with 10% opacity for background elements

### Typography
- **Why text:** 2xl/3xl font-bold (scales on mobile)
- **Creed text:** lg/xl font-semibold
- **Labels:** sm font-bold uppercase tracking-wider

### Spacing
- **Container:** 8 (32px) padding
- **Sections:** 6 (24px) gap between why/creed
- **Divider:** 1px border with 20% white opacity

## Customization Options

### Visual Appearance

Change the gradient colors in `WhyAndCreedSection.tsx`:

```tsx
// Before
className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"

// After (e.g., for green/teal theme)
className="bg-gradient-to-br from-green-600 via-teal-600 to-cyan-600"
```

### Animation Speed

Modify the pulsing animation:

```tsx
// Change animation duration
className="animate-pulse" 
// style={{ animationDelay: `${i * 0.15}s` }} // Adjust multiplier
```

### Font Size

For even larger/smaller text, adjust in component:

```tsx
// Larger
className="text-3xl md:text-4xl" // Instead of text-2xl md:text-3xl

// Smaller
className="text-xl md:text-2xl" // Instead of text-2xl md:text-3xl
```

## Database Schema

```sql
CREATE TABLE workspace_why_creed (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  why text NOT NULL DEFAULT '',
  creed text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  UNIQUE(workspace_id)
);

CREATE INDEX idx_workspace_why_creed_id ON workspace_why_creed(workspace_id);
CREATE INDEX idx_workspace_why_creed_deleted ON workspace_why_creed(deleted_at);
```

## User Journey

1. **First Login** → Empty state displayed
2. **Set Why/Creed** → User fills in both fields and saves
3. **Dashboard View** → Gradient card displays at top
4. **Daily Inspiration** → Each login shows their why/creed
5. **Edit Anytime** → Users can click edit button to update

## Accessibility

- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation (Tab through edit form)
- ✅ Focus indicators (blue ring on inputs)
- ✅ High contrast text (white on gradient)
- ✅ Dark mode support with proper contrast ratios
- ✅ Semantic HTML structure

## Performance

- Fetched on-demand (not in initial page load)
- Cached in React state
- API request debounced on save
- No unnecessary re-renders
- Mobile-optimized rendering

## Next Steps

1. Run migration: `node-pg-migrate up`
2. Import component in command-center
3. Add useEffect to fetch why/creed data
4. Render component at top of dashboard
5. Test on mobile/desktop/dark mode
6. Optional: customize colors to match brand

## Troubleshooting

### Why/Creed not saving?
- Check API endpoint is accessible
- Verify workspace ID is correct
- Check browser console for errors
- Ensure user is authenticated

### Styling looks off?
- Ensure Tailwind CSS is properly configured
- Check dark mode is enabled in next.config.js
- Verify lucide-react icons are installed

### Performance issues?
- Consider moving fetch outside of useEffect dependency array
- Use SWR or React Query for better caching
- Profile with React DevTools
