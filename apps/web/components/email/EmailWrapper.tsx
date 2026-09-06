/**
 * Email wrapper component providing header, footer, and consistent styling.
 * Used by all email templates to maintain brand consistency.
 */

interface EmailWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
}

export function EmailWrapper({
  children,
  backgroundColor = "#ffffff",
  textColor = "#1f2937",
}: EmailWrapperProps) {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      width="100%"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        backgroundColor,
        color: textColor,
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding: "0" }}>
            {/* Header with logo/branding */}
            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              width="100%"
              style={{
                backgroundColor: "#f3f4f6",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: "24px 20px", textAlign: "center" }}>
                    <h1
                      style={{
                        margin: "0",
                        fontSize: "24px",
                        fontWeight: "700",
                        color: "#1f2937",
                        letterSpacing: "-0.5px",
                      }}
                    >
                      ONEVYRT
                    </h1>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "12px",
                        color: "#6b7280",
                      }}
                    >
                      Growth Operating System
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Main content */}
            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              width="100%"
            >
              <tbody>
                <tr>
                  <td style={{ padding: "32px 20px" }}>
                    <div
                      style={{
                        maxWidth: "600px",
                        margin: "0 auto",
                      }}
                    >
                      {children}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              width="100%"
              style={{
                backgroundColor: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: "24px 20px", textAlign: "center" }}>
                    <p
                      style={{
                        margin: "0",
                        fontSize: "12px",
                        color: "#9ca3af",
                        lineHeight: "1.6",
                      }}
                    >
                      ONEVYRT · Business Growth Coaching Platform
                      <br />
                      © {new Date().getFullYear()} Mastery Research Inc. All rights reserved.
                    </p>
                    <p
                      style={{
                        margin: "8px 0 0 0",
                        fontSize: "11px",
                        color: "#d1d5db",
                      }}
                    >
                      <a
                        href="https://onevyrt.masteryresearch.com"
                        style={{ color: "#6366f1", textDecoration: "none" }}
                      >
                        Visit ONEVYRT
                      </a>
                      {" · "}
                      <a
                        href="https://onevyrt.masteryresearch.com/account"
                        style={{ color: "#6366f1", textDecoration: "none" }}
                      >
                        Account Settings
                      </a>
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
