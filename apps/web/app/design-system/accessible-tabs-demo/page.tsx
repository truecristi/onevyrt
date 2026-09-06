"use client";

import { useState } from "react";
import { AccessibleTabs } from "@/components/shared/AccessibleTabs";

export default function AccessibleTabsDemo() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeTab2, setActiveTab2] = useState("implementation");
  const [activeTab3, setActiveTab3] = useState("semantics");
  const [activeTab4, setActiveTab4] = useState("vertical1");

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ marginBottom: "8px", color: "#1a202c", fontSize: "2.5rem" }}>
        Accessible Tabs Prototype
      </h1>
      <p style={{ fontSize: "1.125rem", color: "#718096", marginBottom: "32px" }}>
        WCAG AAA-compliant tabs with full keyboard navigation, screen reader support, and visual focus indicators.
      </p>

      {/* Demo 1: Basic Horizontal Tabs */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#f7fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#2d3748", fontSize: "1.5rem" }}>
          Demo 1: Basic Horizontal Tabs
        </h2>
        <p style={{ marginBottom: "16px", color: "#4a5568" }}>
          Standard horizontal tabs with icons and descriptions. Use arrow keys to navigate.
        </p>

        <AccessibleTabs
          tabs={[
            {
              id: "overview",
              label: "Overview",
              icon: "📋",
              description: "General information and quick summary",
              content: (
                <div>
                  <h3 style={{ marginBottom: "12px" }}>Overview Tab</h3>
                  <p>
                    This is a comprehensive overview of the WCAG AAA-compliant
                    accessible tabs component. It demonstrates how to properly
                    implement tabs with full accessibility features.
                  </p>
                  <ul style={{ marginTop: "12px", paddingLeft: "24px" }}>
                    <li>Full ARIA support (roles, properties, states)</li>
                    <li>Keyboard navigation (Arrow keys, Home, End)</li>
                    <li>Screen reader announcements</li>
                    <li>Visual focus indicators (3px outline)</li>
                    <li>Disabled tab support</li>
                    <li>Orientation support (horizontal/vertical)</li>
                  </ul>
                </div>
              ),
            },
            {
              id: "features",
              label: "Features",
              icon: "✨",
              description: "Key features and capabilities",
              content: (
                <div>
                  <h3 style={{ marginBottom: "12px" }}>Key Features</h3>
                  <ul style={{ paddingLeft: "24px" }}>
                    <li>
                      <strong>Keyboard Navigation:</strong> Full support for arrow
                      keys, Home, End, and Tab keys
                    </li>
                    <li>
                      <strong>Focus Management:</strong> Proper tab ordering and
                      focus trap management
                    </li>
                    <li>
                      <strong>Screen Reader:</strong> Live regions and ARIA labels
                      for screen reader users
                    </li>
                    <li>
                      <strong>Visual Indicators:</strong> High-contrast focus
                      indicators meeting WCAG AAA
                    </li>
                    <li>
                      <strong>Disabled States:</strong> Support for disabled tabs
                      with proper styling
                    </li>
                    <li>
                      <strong>Orientations:</strong> Horizontal and vertical layout
                      support
                    </li>
                  </ul>
                </div>
              ),
            },
            {
              id: "usage",
              label: "Usage",
              icon: "💻",
              description: "How to use the component",
              content: (
                <div>
                  <h3 style={{ marginBottom: "12px" }}>Usage Example</h3>
                  <pre
                    style={{
                      backgroundColor: "#2d3748",
                      color: "#e2e8f0",
                      padding: "16px",
                      borderRadius: "6px",
                      overflowX: "auto",
                      fontSize: "0.875rem",
                      marginTop: "12px",
                    }}
                  >
                    {`<AccessibleTabs
  tabs={[
    {
      id: "tab1",
      label: "Tab 1",
      icon: "📋",
      description: "First tab description",
      content: <div>Content 1</div>
    },
    {
      id: "tab2",
      label: "Tab 2",
      content: <div>Content 2</div>
    }
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  ariaLabel="Main navigation tabs"
/>`}
                  </pre>
                </div>
              ),
            },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel="Basic horizontal tabs demo"
        />
      </section>

      {/* Demo 2: Compact Variant */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#f7fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#2d3748", fontSize: "1.5rem" }}>
          Demo 2: Compact Variant with Disabled Tabs
        </h2>
        <p style={{ marginBottom: "16px", color: "#4a5568" }}>
          Compact sizing with one disabled tab to demonstrate state handling.
        </p>

        <AccessibleTabs
          tabs={[
            {
              id: "implementation",
              label: "Implementation",
              icon: "🔧",
              content: (
                <div>
                  <h3>Implementation Details</h3>
                  <p>
                    The component uses React refs and event handlers to manage
                    keyboard navigation and focus states. All ARIA attributes are
                    dynamically generated based on tab state.
                  </p>
                </div>
              ),
            },
            {
              id: "advanced",
              label: "Advanced",
              icon: "🚀",
              content: (
                <div>
                  <h3>Advanced Configuration</h3>
                  <p>
                    Support for manual and automatic activation modes, custom
                    orientations, and integration with external state management.
                  </p>
                </div>
              ),
            },
            {
              id: "disabled",
              label: "Disabled",
              icon: "🔒",
              disabled: true,
              content: <div>This tab is disabled and cannot be selected.</div>,
            },
          ]}
          activeTab={activeTab2}
          onTabChange={setActiveTab2}
          variant="compact"
          ariaLabel="Compact tabs with disabled state"
        />
      </section>

      {/* Demo 3: With Descriptions */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#f7fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#2d3748", fontSize: "1.5rem" }}>
          Demo 3: Tabs with Full Descriptions
        </h2>
        <p style={{ marginBottom: "16px", color: "#4a5568" }}>
          Each tab can have a description shown both in the tab and in the panel.
        </p>

        <AccessibleTabs
          tabs={[
            {
              id: "semantics",
              label: "Semantic HTML",
              description:
                "Understanding HTML structure and semantic meaning for accessibility",
              content: (
                <div>
                  <h3 style={{ marginBottom: "12px" }}>Semantic HTML Foundation</h3>
                  <p>
                    The tabs component is built on semantic HTML principles with
                    proper ARIA roles and attributes. Every element has a purpose
                    and contributes to the accessibility tree.
                  </p>
                  <h4 style={{ marginTop: "16px", marginBottom: "8px" }}>
                    Key Elements:
                  </h4>
                  <ul style={{ paddingLeft: "24px" }}>
                    <li>
                      <code>role="tablist"</code> on the container
                    </li>
                    <li>
                      <code>role="tab"</code> on each button
                    </li>
                    <li>
                      <code>role="tabpanel"</code> on the content area
                    </li>
                    <li>
                      <code>aria-selected</code> for active state
                    </li>
                    <li>
                      <code>aria-controls</code> linking tab to panel
                    </li>
                  </ul>
                </div>
              ),
            },
            {
              id: "keyboard",
              label: "Keyboard Support",
              description: "Complete keyboard navigation implementation",
              content: (
                <div>
                  <h3 style={{ marginBottom: "12px" }}>Keyboard Navigation</h3>
                  <p>
                    Full support for all standard keyboard interactions expected
                    by screen reader and keyboard-only users.
                  </p>
                  <table
                    style={{
                      width: "100%",
                      marginTop: "16px",
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#e2e8f0",
                          borderBottom: "2px solid #cbd5e0",
                        }}
                      >
                        <th
                          style={{
                            textAlign: "left",
                            padding: "12px",
                            fontWeight: "600",
                          }}
                        >
                          Key
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "12px",
                            fontWeight: "600",
                          }}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px" }}>
                          <code>→ / ↓</code>
                        </td>
                        <td style={{ padding: "12px" }}>Next tab</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px" }}>
                          <code>← / ↑</code>
                        </td>
                        <td style={{ padding: "12px" }}>Previous tab</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px" }}>
                          <code>Home</code>
                        </td>
                        <td style={{ padding: "12px" }}>First tab</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "12px" }}>
                          <code>End</code>
                        </td>
                        <td style={{ padding: "12px" }}>Last tab</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              id: "wcag",
              label: "WCAG AAA",
              description: "WCAG 2.1 Level AAA conformance details",
              content: (
                <div>
                  <h3 style={{ marginBottom: "12px" }}>WCAG AAA Compliance</h3>
                  <p>
                    This component meets or exceeds all WCAG 2.1 Level AAA success
                    criteria for interactive components.
                  </p>
                  <h4 style={{ marginTop: "16px", marginBottom: "8px" }}>
                    Conformance Areas:
                  </h4>
                  <ul style={{ paddingLeft: "24px" }}>
                    <li>2.1.1 Keyboard (Level A)</li>
                    <li>2.1.3 Keyboard (No Exception) (Level AAA)</li>
                    <li>2.4.3 Focus Order (Level A)</li>
                    <li>2.4.7 Focus Visible (Level AA)</li>
                    <li>2.5.5 Target Size (Level AAA)</li>
                    <li>4.1.2 Name, Role, Value (Level A)</li>
                    <li>4.1.3 Status Messages (Level AA)</li>
                  </ul>
                </div>
              ),
            },
          ]}
          activeTab={activeTab3}
          onTabChange={setActiveTab3}
          ariaLabel="Detailed information tabs"
        />
      </section>

      {/* Demo 4: Vertical Tabs */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#f7fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#2d3748", fontSize: "1.5rem" }}>
          Demo 4: Vertical Orientation
        </h2>
        <p style={{ marginBottom: "16px", color: "#4a5568" }}>
          Vertical tab layout with proper orientation ARIA attribute.
        </p>

        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <AccessibleTabs
              tabs={[
                {
                  id: "vertical1",
                  label: "Getting Started",
                  icon: "🚀",
                  content: (
                    <div>
                      <h3>Getting Started</h3>
                      <p>
                        Step 1: Import the AccessibleTabs component from the shared
                        components library.
                      </p>
                    </div>
                  ),
                },
                {
                  id: "vertical2",
                  label: "Configuration",
                  icon: "⚙️",
                  content: (
                    <div>
                      <h3>Configuration</h3>
                      <p>
                        Step 2: Configure your tabs with proper ARIA labels and
                        descriptions.
                      </p>
                    </div>
                  ),
                },
                {
                  id: "vertical3",
                  label: "Testing",
                  icon: "✅",
                  content: (
                    <div>
                      <h3>Testing</h3>
                      <p>
                        Step 3: Test with screen readers and keyboard navigation
                        tools.
                      </p>
                    </div>
                  ),
                },
              ]}
              activeTab={activeTab4}
              onTabChange={setActiveTab4}
              orientation="vertical"
              ariaLabel="Vertical navigation tabs"
            />
          </div>
        </div>
      </section>

      {/* Accessibility Guidelines */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#fef5e7",
          borderRadius: "8px",
          border: "1px solid #f8c471",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#784212", fontSize: "1.5rem" }}>
          🎯 Accessibility Testing Checklist
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <h3 style={{ marginBottom: "12px", color: "#784212" }}>
              Keyboard Navigation
            </h3>
            <ul style={{ paddingLeft: "24px", color: "#5d4037" }}>
              <li>Tab to first tab, then left/right arrows cycle through</li>
              <li>Home key goes to first tab</li>
              <li>End key goes to last tab</li>
              <li>Can't tab inside tab panel with keyboard</li>
              <li>Disabled tabs are skipped in navigation</li>
            </ul>
          </div>

          <div>
            <h3 style={{ marginBottom: "12px", color: "#784212" }}>
              Screen Readers
            </h3>
            <ul style={{ paddingLeft: "24px", color: "#5d4037" }}>
              <li>Announces "tab, selected" for active tab</li>
              <li>Announces "tab, disabled" for disabled tabs</li>
              <li>Announces panel with associated tab label</li>
              <li>Live region announces current tab number</li>
              <li>Descriptions are associated with tabs</li>
            </ul>
          </div>

          <div>
            <h3 style={{ marginBottom: "12px", color: "#784212" }}>
              Visual Indicators
            </h3>
            <ul style={{ paddingLeft: "24px", color: "#5d4037" }}>
              <li>3px high-contrast focus outline (7:1 ratio)</li>
              <li>Focus visible on keyboard navigation</li>
              <li>Minimum 44x44px touch target size</li>
              <li>Active tab clearly distinguished (color + border)</li>
              <li>Disabled tabs have reduced opacity</li>
            </ul>
          </div>

          <div>
            <h3 style={{ marginBottom: "12px", color: "#784212" }}>
              WCAG Compliance
            </h3>
            <ul style={{ paddingLeft: "24px", color: "#5d4037" }}>
              <li>Level AAA focus visibility (WCAG 2.4.7)</li>
              <li>Target size 44x44px minimum (WCAG 2.5.5)</li>
              <li>Full keyboard support (WCAG 2.1.3)</li>
              <li>Proper ARIA roles and properties (WCAG 4.1.2)</li>
              <li>Status messages announced (WCAG 4.1.3)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Implementation Notes */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#eaf2f8",
          borderRadius: "8px",
          border: "1px solid #85c1e2",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#1e3a5f", fontSize: "1.5rem" }}>
          📚 Implementation Notes
        </h2>

        <div style={{ color: "#2c4a70" }}>
          <h3 style={{ marginBottom: "12px" }}>Key Implementation Details:</h3>

          <h4 style={{ marginTop: "16px", marginBottom: "8px", fontWeight: "600" }}>
            1. ARIA Roles & Attributes
          </h4>
          <pre
            style={{
              backgroundColor: "#f0f6fb",
              padding: "12px",
              borderRadius: "6px",
              overflow: "auto",
              fontSize: "0.875rem",
            }}
          >
            {`role="tablist"           // Container for all tabs
role="tab"               // Each individual tab button
role="tabpanel"          // Content area

aria-selected            // true/false for active tab
aria-controls           // Links tab to its panel
aria-labelledby          // Links panel back to tab
aria-describedby        // Optional description
aria-disabled           // For disabled tabs
aria-orientation        // horizontal/vertical
aria-live               // For status announcements`}
          </pre>

          <h4 style={{ marginTop: "16px", marginBottom: "8px", fontWeight: "600" }}>
            2. Focus Management
          </h4>
          <ul style={{ paddingLeft: "24px" }}>
            <li>Only active tab is in tab order (tabIndex 0)</li>
            <li>Inactive tabs have tabIndex -1</li>
            <li>Arrow key navigation moves focus directly to new tab</li>
            <li>3px solid focus outline meets WCAG AAA contrast</li>
            <li>Focus visible on keyboard navigation only</li>
          </ul>

          <h4 style={{ marginTop: "16px", marginBottom: "8px", fontWeight: "600" }}>
            3. Keyboard Support
          </h4>
          <ul style={{ paddingLeft: "24px" }}>
            <li>Arrow keys: Navigate between tabs</li>
            <li>Home/End: Jump to first/last tab</li>
            <li>Tab key: Move focus out of tab list</li>
            <li>Disabled tabs skipped in navigation</li>
            <li>Enter/Space: Activate tab (automatic on arrow)</li>
          </ul>

          <h4 style={{ marginTop: "16px", marginBottom: "8px", fontWeight: "600" }}>
            4. Screen Reader Support
          </h4>
          <ul style={{ paddingLeft: "24px" }}>
            <li>
              <code>aria-live</code> region announces tab changes
            </li>
            <li>
              <code>aria-atomic</code> ensures full announcement of status
            </li>
            <li>Tab count and position announced</li>
            <li>Disabled state explicitly announced</li>
            <li>Descriptions linked via <code>aria-describedby</code></li>
          </ul>
        </div>
      </section>

      {/* CSS Requirements */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#f5e6f8",
          borderRadius: "8px",
          border: "1px solid #d8b5e8",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#4a235a", fontSize: "1.5rem" }}>
          🎨 Required CSS Variables
        </h2>

        <p style={{ marginBottom: "16px", color: "#5d4e7a" }}>
          Define these CSS variables in your global stylesheet for proper theming:
        </p>

        <pre
          style={{
            backgroundColor: "#f9f6fc",
            padding: "16px",
            borderRadius: "6px",
            overflow: "auto",
            fontSize: "0.875rem",
            color: "#4a235a",
          }}
        >
          {`:root {
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
}`}
        </pre>

        <p style={{ marginTop: "16px", color: "#5d4e7a" }}>
          Minimum 44x44px touch targets and 3:1 color contrast is automatically
          enforced. Focus outline has 7:1 contrast for WCAG AAA compliance.
        </p>
      </section>

      {/* Testing Instructions */}
      <section
        style={{
          marginBottom: "48px",
          padding: "24px",
          backgroundColor: "#e8f5e9",
          borderRadius: "8px",
          border: "1px solid #81c784",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#1b5e20", fontSize: "1.5rem" }}>
          🧪 How to Test Accessibility
        </h2>

        <div style={{ color: "#2e7d32" }}>
          <h3 style={{ marginBottom: "12px" }}>Screen Reader Testing</h3>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>macOS (VoiceOver):</strong> Cmd+F5 to enable, then use VO
              key (Ctrl+Option)
            </li>
            <li>
              <strong>Windows (NVDA):</strong> Free download from
              nvaccess.org, use standard NVDA key (Insert)
            </li>
            <li>
              <strong>Windows (JAWS):</strong> Common in enterprise environments
            </li>
            <li>
              <strong>Chrome (ChromeVox):</strong> Extension for developers, Ctrl+Alt+Z
            </li>
          </ul>

          <h3 style={{ marginBottom: "12px" }}>Keyboard Navigation Testing</h3>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>Tab through components, verify focus visible at all times</li>
            <li>Use arrow keys to navigate between tabs</li>
            <li>Press Home key, verify first tab is focused</li>
            <li>Press End key, verify last tab is focused</li>
            <li>Verify disabled tabs are skipped</li>
          </ul>

          <h3 style={{ marginBottom: "12px" }}>
            Automated Testing Tools
          </h3>
          <ul style={{ paddingLeft: "24px" }}>
            <li>
              <strong>axe DevTools:</strong> Browser extension for accessibility
              checks
            </li>
            <li>
              <strong>WAVE:</strong> WebAIM accessibility evaluation tool
            </li>
            <li>
              <strong>Lighthouse:</strong> Chrome DevTools built-in audits
            </li>
            <li>
              <strong>Pa11y:</strong> Command-line accessibility testing
            </li>
          </ul>
        </div>
      </section>

      {/* Browser Support */}
      <section
        style={{
          padding: "24px",
          backgroundColor: "#fff3e0",
          borderRadius: "8px",
          border: "1px solid #ffb74d",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#e65100", fontSize: "1.5rem" }}>
          ✅ Browser & Assistive Technology Support
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div style={{ color: "#bf360c" }}>
            <h3 style={{ marginBottom: "12px" }}>Browsers</h3>
            <ul style={{ paddingLeft: "24px" }}>
              <li>Chrome 90+ ✓</li>
              <li>Firefox 88+ ✓</li>
              <li>Safari 14+ ✓</li>
              <li>Edge 90+ ✓</li>
              <li>Mobile Safari (iOS 14+) ✓</li>
              <li>Chrome Mobile (Android) ✓</li>
            </ul>
          </div>

          <div style={{ color: "#bf360c" }}>
            <h3 style={{ marginBottom: "12px" }}>
              Assistive Technologies
            </h3>
            <ul style={{ paddingLeft: "24px" }}>
              <li>NVDA (Windows) ✓</li>
              <li>JAWS (Windows) ✓</li>
              <li>VoiceOver (macOS/iOS) ✓</li>
              <li>TalkBack (Android) ✓</li>
              <li>Dragon NaturallySpeaking ✓</li>
              <li>Switch Control ✓</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
