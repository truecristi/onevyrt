/**
 * Badge Component Usage Examples
 * CSS Patch 5 — Comprehensive badge and label component showcase
 *
 * This file demonstrates all badge variants, sizes, and combinations
 * for reference in other components. Not meant to be rendered directly.
 */

import { Badge, StatusBadge, ChapterBadge, RoleBadge } from "./Badge";
import { Label, HelpText, Field, LabelBadge, Eyebrow } from "./Label";

/**
 * BADGE EXAMPLES
 */

export function BadgeExamples() {
  return (
    <div className="space-y-8">
      {/* Status Variants */}
      <section>
        <h2 className="ds-section mb-4">Status Badges</h2>
        <div className="flex gap-2 flex-wrap">
          <Badge status="neutral">Neutral</Badge>
          <Badge status="brand">Brand</Badge>
          <Badge status="success">Success</Badge>
          <Badge status="warning">Warning</Badge>
          <Badge status="danger">Error</Badge>
          <Badge status="info">Info</Badge>
        </div>
      </section>

      {/* Size Variants */}
      <section>
        <h2 className="ds-section mb-4">Size Variants</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge size="sm">Small</Badge>
          <Badge size="md">Medium (default)</Badge>
          <Badge size="lg">Large</Badge>
          <Badge size="compact">Compact</Badge>
        </div>
      </section>

      {/* With Status Dots */}
      <section>
        <h2 className="ds-section mb-4">With Status Indicator Dots</h2>
        <div className="flex gap-2 flex-wrap">
          <Badge status="success" dot>Active</Badge>
          <Badge status="warning" dot>Pending</Badge>
          <Badge status="danger" dot>Blocked</Badge>
          <Badge status="info" dot>In Review</Badge>
          <Badge status="neutral" dot dotPosition="right">
            Right dot
          </Badge>
        </div>
      </section>

      {/* Chapter Badges */}
      <section>
        <h2 className="ds-section mb-4">Chapter Status Badges</h2>
        <div className="flex gap-2 flex-wrap">
          <ChapterBadge chapter="start" />
          <ChapterBadge chapter="define" />
          <ChapterBadge chapter="implement" />
          <ChapterBadge chapter="control" />
          <ChapterBadge chapter="improve" />
          <ChapterBadge chapter="finish" />
        </div>
      </section>

      {/* Chapter Badges with Dots */}
      <section>
        <h2 className="ds-section mb-4">Chapter Badges with Progress Indicators</h2>
        <div className="flex gap-2 flex-wrap">
          <ChapterBadge chapter="define" dot />
          <ChapterBadge chapter="implement" dot />
          <ChapterBadge chapter="control" dot />
          <ChapterBadge chapter="improve" dot />
          <ChapterBadge chapter="finish" dot />
        </div>
      </section>

      {/* Role Badges */}
      <section>
        <h2 className="ds-section mb-4">User Role Badges</h2>
        <div className="flex gap-2 flex-wrap">
          <RoleBadge role="owner" />
          <RoleBadge role="manager" />
          <RoleBadge role="editor" />
          <RoleBadge role="viewer" />
        </div>
      </section>

      {/* Status Badges (convenience helper) */}
      <section>
        <h2 className="ds-section mb-4">Status Badges (Helper)</h2>
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status="awaiting" />
          <StatusBadge status="approved" />
          <StatusBadge status="changes-requested" />
          <StatusBadge status="rejected" />
          <StatusBadge status="in-progress" />
          <StatusBadge status="not-started" />
          <StatusBadge status="complete" />
          <StatusBadge status="submitted" />
        </div>
      </section>

      {/* Interactive Badges */}
      <section>
        <h2 className="ds-section mb-4">Interactive Badges</h2>
        <div className="flex gap-2 flex-wrap">
          <Badge
            interactive
            status="success"
            onClick={() => console.log("Clicked!")}
          >
            Click me
          </Badge>
          <Badge
            interactive
            status="info"
            size="lg"
            onClick={() => console.log("Large clicked!")}
          >
            Large clickable
          </Badge>
        </div>
      </section>

      {/* Compact Size (for dense layouts) */}
      <section>
        <h2 className="ds-section mb-4">Compact Badges (11px, 4px 8px padding)</h2>
        <div className="flex gap-2 flex-wrap">
          <Badge size="compact" status="success">
            COMPLETED
          </Badge>
          <Badge size="compact" status="warning">
            PENDING
          </Badge>
          <Badge size="compact" status="danger">
            REJECTED
          </Badge>
          <Badge size="compact" chapter="define">
            DEFINE
          </Badge>
        </div>
      </section>

      {/* Combinations */}
      <section>
        <h2 className="ds-section mb-4">Common Combinations</h2>
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <span>Progress Indicator:</span>
            <ChapterBadge chapter="implement" dot />
          </div>
          <div className="flex gap-2 items-center">
            <span>Submission Status:</span>
            <StatusBadge status="submitted" />
          </div>
          <div className="flex gap-2 items-center">
            <span>User Role:</span>
            <RoleBadge role="manager" />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * LABEL & FIELD EXAMPLES
 */

export function LabelExamples() {
  return (
    <div className="space-y-8">
      {/* Basic Labels */}
      <section>
        <h2 className="ds-section mb-4">Basic Labels</h2>
        <div className="space-y-4">
          <Label htmlFor="email">Email Address</Label>
          <Label htmlFor="website" optional>
            Website
          </Label>
          <Label htmlFor="password" required>
            Password
          </Label>
        </div>
      </section>

      {/* Labels with Hints */}
      <section>
        <h2 className="ds-section mb-4">Labels with Hints</h2>
        <div className="space-y-4">
          <Label htmlFor="role" hint="Who will use this workspace?">
            Role
          </Label>
          <Label
            htmlFor="access"
            hint="Determines what you can edit and create"
          >
            Access Level
          </Label>
        </div>
      </section>

      {/* Help Text Variants */}
      <section>
        <h2 className="ds-section mb-4">Help Text Variants</h2>
        <div className="space-y-4">
          <div>
            <label>Default</label>
            <HelpText>This is helper text</HelpText>
          </div>
          <div>
            <label>Error</label>
            <HelpText variant="error">Email is required</HelpText>
          </div>
          <div>
            <label>Success</label>
            <HelpText variant="success">Email verified!</HelpText>
          </div>
          <div>
            <label>Warning</label>
            <HelpText variant="warning">This email is already in use</HelpText>
          </div>
          <div>
            <label>Info</label>
            <HelpText variant="info">We'll never share your email</HelpText>
          </div>
        </div>
      </section>

      {/* Field Component */}
      <section>
        <h2 className="ds-section mb-4">Field Component (Label + Input + Help)</h2>
        <div className="space-y-6 max-w-md">
          <Field label="Email Address" htmlFor="email1" required>
            <input
              id="email1"
              type="email"
              className="ds-input"
              placeholder="you@example.com"
            />
          </Field>

          <Field
            label="Website"
            htmlFor="website1"
            optional
            help="Your business website"
          >
            <input
              id="website1"
              type="url"
              className="ds-input"
              placeholder="https://example.com"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password1"
            required
            help="At least 12 characters recommended"
          >
            <input
              id="password1"
              type="password"
              className="ds-input"
            />
          </Field>

          <Field
            label="Confirm Password"
            htmlFor="confirm1"
            help="Passwords don't match"
            helpVariant="error"
          >
            <input
              id="confirm1"
              type="password"
              className="ds-input"
              aria-invalid="true"
            />
          </Field>

          <Field
            label="Industry"
            htmlFor="industry"
            help="For relevant recommendations"
            helpVariant="info"
          >
            <select id="industry" className="ds-select">
              <option>Select an industry...</option>
              <option>E-commerce</option>
              <option>Services</option>
              <option>SaaS</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Label Badges */}
      <section>
        <h2 className="ds-section mb-4">Label Badges (Inline)</h2>
        <div className="flex gap-2 flex-wrap">
          <LabelBadge variant="default">General</LabelBadge>
          <LabelBadge variant="primary">Featured</LabelBadge>
          <LabelBadge variant="success">Verified</LabelBadge>
          <LabelBadge variant="warning">Pending</LabelBadge>
          <LabelBadge variant="danger">Archived</LabelBadge>
          <LabelBadge variant="info">Beta</LabelBadge>
        </div>
      </section>

      {/* Eyebrow */}
      <section>
        <h2 className="ds-section mb-4">Eyebrow / Overline</h2>
        <div className="space-y-4">
          <div>
            <Eyebrow>Chapter 1</Eyebrow>
            <h1 className="ds-title">Define Your Business</h1>
          </div>
          <div>
            <Eyebrow>New Feature</Eyebrow>
            <h2 className="ds-section">Real-time Collaboration</h2>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * PRACTICAL SCENARIOS
 */

export function BadgeLabelScenarios() {
  return (
    <div className="space-y-8">
      {/* User Card with Role Badge */}
      <section>
        <h2 className="ds-section mb-4">User Card with Role</h2>
        <div className="ds-card p-4 max-w-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">Sarah Chen</h3>
              <p className="text-sm text-gray-500">sarah@company.com</p>
            </div>
            <RoleBadge role="manager" />
          </div>
        </div>
      </section>

      {/* Chapter Progress Tracker */}
      <section>
        <h2 className="ds-section mb-4">Chapter Progress Tracker</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span>Start</span>
            <ChapterBadge chapter="start" dot />
          </div>
          <div className="flex items-center justify-between">
            <span>Define</span>
            <ChapterBadge chapter="define" dot />
          </div>
          <div className="flex items-center justify-between">
            <span>Implement</span>
            <ChapterBadge chapter="implement" dot />
          </div>
        </div>
      </section>

      {/* Submission Status List */}
      <section>
        <h2 className="ds-section mb-4">Submission Status List</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b">
            <span>Business Blueprint</span>
            <StatusBadge status="approved" dot={false} />
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span>Working System</span>
            <StatusBadge status="changes-requested" dot={false} />
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span>Control Dashboard</span>
            <StatusBadge status="in-progress" dot={false} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span>Growth Plan</span>
            <StatusBadge status="not-started" dot={false} />
          </div>
        </div>
      </section>

      {/* Form with Validation */}
      <section>
        <h2 className="ds-section mb-4">Form with Validation</h2>
        <div className="max-w-md space-y-4">
          <Field label="Email" htmlFor="form-email" required>
            <input
              id="form-email"
              type="email"
              className="ds-input"
              value="user@example.com"
            />
          </Field>

          <Field
            label="Username"
            htmlFor="form-username"
            required
            help="Username already taken"
            helpVariant="error"
          >
            <input
              id="form-username"
              type="text"
              className="ds-input"
              aria-invalid="true"
              value="john_doe"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="form-password"
            required
            help="Strong password set"
            helpVariant="success"
          >
            <input
              id="form-password"
              type="password"
              className="ds-input"
              value="••••••••••••"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}
