# Accessible Tabs: Quick Start Guide

## Installation

The `AccessibleTabs` component is available in the shared components library.

```typescript
import { AccessibleTabs } from '@/components/shared';
```

## Basic Example

```typescript
'use client';

import { AccessibleTabs } from '@/components/shared';
import { useState } from 'react';

export function MyTabs() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <AccessibleTabs
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          icon: '📋',
          content: (
            <div>
              <h2>Overview</h2>
              <p>This is the overview tab content.</p>
            </div>
          ),
        },
        {
          id: 'details',
          label: 'Details',
          icon: '📊',
          content: (
            <div>
              <h2>Details</h2>
              <p>This is the details tab content.</p>
            </div>
          ),
        },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      ariaLabel="Main navigation tabs"
    />
  );
}
```

## Props

```typescript
interface AccessibleTabsProps {
  // Required
  tabs: Array<{
    id: string;
    label: string;
    content: ReactNode;
    icon?: ReactNode;
    description?: string;
    disabled?: boolean;
  }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;

  // Optional
  variant?: 'default' | 'compact';
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  ariaDescribedBy?: string;
}
```

## Examples

### Example 1: Basic Tabs

```typescript
<AccessibleTabs
  tabs={[
    { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  ariaLabel="Navigation"
/>
```

### Example 2: With Descriptions

```typescript
<AccessibleTabs
  tabs={[
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure your preferences',
      content: <SettingsForm />,
    },
    {
      id: 'profile',
      label: 'Profile',
      description: 'View and edit your profile',
      content: <ProfileForm />,
    },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  ariaLabel="Account"
/>
```

### Example 3: With Disabled Tabs

```typescript
<AccessibleTabs
  tabs={[
    { id: 'enabled', label: 'Enabled', content: <div>Available</div> },
    {
      id: 'disabled',
      label: 'Disabled',
      disabled: true,
      content: <div>Not available</div>,
    },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  ariaLabel="Navigation"
/>
```

### Example 4: Vertical Orientation

```typescript
<AccessibleTabs
  tabs={[...]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  orientation="vertical"
  ariaLabel="Sidebar navigation"
/>
```

### Example 5: Compact Variant

```typescript
<AccessibleTabs
  tabs={[...]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  variant="compact"
/>
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `→` or `↓` | Next tab |
| `←` or `↑` | Previous tab |
| `Home` | First tab |
| `End` | Last tab |
| `Tab` | Leave tabs |

## Required CSS Variables

Define these in your global stylesheet:

```css
:root {
  --accent: #0066cc;        /* Active tab color */
  --muted: #718096;         /* Inactive tab color */
  --disabled: #999999;      /* Disabled tab color */
  --focus: #0066cc;         /* Focus outline color */
  --border3: #e2e8f0;       /* Border color */
}

@media (prefers-color-scheme: dark) {
  --accent: #5a9cff;
  --muted: #a0aec0;
  --disabled: #666666;
  --focus: #90caf9;
  --border3: #2d3748;
}
```

## Accessibility Features

✅ **WCAG AAA Compliant**
- Full ARIA roles and properties
- Keyboard navigation (arrow keys, Home, End)
- Screen reader announcements
- High-contrast focus indicators (7:1)
- Minimum 44×44px touch targets
- Support for disabled tabs

## Testing

### Keyboard Test
1. Tab to first tab
2. Use arrow keys to navigate
3. Press Home to go to first tab
4. Press End to go to last tab
5. Disabled tabs should be skipped

### Screen Reader Test
1. Enable VoiceOver (Mac: Cmd+F5), NVDA (Win), or TalkBack (Mobile)
2. Navigate to tabs
3. Verify "tab" role is announced
4. Verify "current" and "disabled" states are announced
5. Verify tab count is announced

## Visual Checklist

- [ ] Focus outline visible on keyboard navigation
- [ ] Active tab clearly distinguished
- [ ] Disabled tabs appear grayed out
- [ ] Minimum 44×44px button size
- [ ] Color contrast 7:1 for active tab
- [ ] Works in light and dark modes

## Common Use Cases

### Navigation Tabs
```typescript
const navTabs = [
  { id: 'home', label: 'Home', content: <HomePage /> },
  { id: 'about', label: 'About', content: <AboutPage /> },
  { id: 'contact', label: 'Contact', content: <ContactPage /> },
];
```

### Form Sections
```typescript
const formTabs = [
  { id: 'personal', label: 'Personal Info', content: <PersonalForm /> },
  { id: 'address', label: 'Address', content: <AddressForm /> },
  { id: 'payment', label: 'Payment', content: <PaymentForm /> },
];
```

### Settings Panels
```typescript
const settingsTabs = [
  { id: 'general', label: 'General', content: <GeneralSettings /> },
  { id: 'privacy', label: 'Privacy', content: <PrivacySettings /> },
  { id: 'notifications', label: 'Notifications', content: <NotificationSettings /> },
];
```

## Styling Customization

The component uses inline styles with CSS variables for theming. To customize:

1. Update CSS variables in your global stylesheet
2. Or override with component-level styling:

```typescript
<div style={{ '--accent': '#ff0000' }}>
  <AccessibleTabs {...props} />
</div>
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Android)

## Screen Reader Support

- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS, iOS)
- TalkBack (Android)

## Troubleshooting

**Focus not visible?**
- Check CSS variables are defined
- Clear browser cache
- Verify `--focus` color is set

**Keyboard navigation not working?**
- Verify focus is on a tab (click if needed)
- Check browser console for errors
- Try different keyboard layout

**Screen reader not announcing?**
- Ensure screen reader is in "web content" mode
- Try different screen reader
- Check browser extensions

## Performance Tips

- Keep tab content lightweight
- Lazy-load heavy content
- Use `React.memo` for tab panels if frequently re-rendering

```typescript
const ExpensivePanel = React.memo(({ children }) => (
  <div>{children}</div>
));
```

## Migration from Legacy Tabs

If using the old `Tabs` component:

```typescript
// Before
import { Tabs } from '@/components/shared';

// After
import { AccessibleTabs } from '@/components/shared';
```

The API is almost identical—just add the `ariaLabel` prop.

## Demo

View the interactive demo at `/design-system/accessible-tabs-demo`

## Full Documentation

See `docs/ACCESSIBLE_TABS_GUIDE.md` for complete documentation.

## Questions?

Refer to the full accessibility guide or check the demo page for examples.

---

**Status:** ✅ WCAG AAA Compliant
**Component:** `apps/web/components/shared/AccessibleTabs.tsx`
**Updated:** 2026-09-03
