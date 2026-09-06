/**
 * Reusable email components for consistent template styling.
 */

interface SectionProps {
  children: React.ReactNode;
  backgroundColor?: string;
  padding?: string;
}

export function Section({
  children,
  backgroundColor = "transparent",
  padding = "0",
}: SectionProps) {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      width="100%"
      style={{
        backgroundColor,
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding }}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

interface CardProps {
  children: React.ReactNode;
  backgroundColor?: string;
  borderColor?: string;
  padding?: string;
}

export function Card({
  children,
  backgroundColor = "#ffffff",
  borderColor = "#e5e7eb",
  padding = "20px",
}: CardProps) {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      width="100%"
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding }}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
}

export function Button({
  href,
  children,
  backgroundColor = "#6366f1",
  textColor = "#ffffff",
  padding = "12px 24px",
}: ButtonProps) {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      style={{
        margin: "16px 0",
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              borderRadius: "6px",
              backgroundColor,
              textAlign: "center",
            }}
          >
            <a
              href={href}
              style={{
                display: "inline-block",
                padding,
                color: textColor,
                textDecoration: "none",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

interface LinkProps {
  href: string;
  children: React.ReactNode;
  color?: string;
}

export function Link({ href, children, color = "#6366f1" }: LinkProps) {
  return (
    <a
      href={href}
      style={{
        color,
        textDecoration: "underline",
      }}
    >
      {children}
    </a>
  );
}

interface HeadingProps {
  level: 1 | 2 | 3;
  children: React.ReactNode;
  color?: string;
  margin?: string;
}

export function Heading({
  level,
  children,
  color = "#1f2937",
  margin = "0 0 12px 0",
}: HeadingProps) {
  const sizes = { 1: "24px", 2: "20px", 3: "16px" };
  const weights = { 1: "700", 2: "600", 3: "600" };
  const Tag = `h${level}` as "h1" | "h2" | "h3";

  return (
    <Tag
      style={{
        margin,
        fontSize: sizes[level],
        fontWeight: weights[level],
        color,
        lineHeight: "1.3",
      }}
    >
      {children}
    </Tag>
  );
}

interface ParagraphProps {
  children: React.ReactNode;
  color?: string;
  fontSize?: string;
  margin?: string;
  lineHeight?: string;
}

export function Paragraph({
  children,
  color = "#4b5563",
  fontSize = "14px",
  margin = "0 0 12px 0",
  lineHeight = "1.6",
}: ParagraphProps) {
  return (
    <p
      style={{
        margin,
        color,
        fontSize,
        lineHeight,
      }}
    >
      {children}
    </p>
  );
}

interface ChapterStatusProps {
  chapterNumber: number;
  chapterName: string;
  status: "completed" | "approved" | "pending" | "rejected";
  learnerName?: string;
}

export function ChapterStatus({
  chapterNumber,
  chapterName,
  status,
  learnerName,
}: ChapterStatusProps) {
  const statusColors = {
    completed: { bg: "#ecfdf5", text: "#065f46", label: "Completed" },
    approved: { bg: "#ecfdf5", text: "#065f46", label: "Approved by Coach" },
    pending: { bg: "#fef3c7", text: "#92400e", label: "Pending Review" },
    rejected: { bg: "#fee2e2", text: "#991b1b", label: "Needs Revision" },
  };

  const colors = statusColors[status];

  return (
    <Card backgroundColor="#f9fafb" padding="16px">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px 0",
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
            }}
          >
            Chapter {chapterNumber}: {chapterName}
          </h3>
          {learnerName && (
            <p
              style={{
                margin: "0",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              {learnerName}
            </p>
          )}
        </div>
        <div
          style={{
            display: "inline-block",
            backgroundColor: colors.bg,
            color: colors.text,
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          {colors.label}
        </div>
      </div>
    </Card>
  );
}

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  color?: string;
}

export function ProgressBar({
  current,
  total,
  label,
  color = "#6366f1",
}: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div style={{ margin: "16px 0" }}>
      {label && (
        <p
          style={{
            margin: "0 0 8px 0",
            fontSize: "13px",
            fontWeight: "600",
            color: "#1f2937",
          }}
        >
          {label}
        </p>
      )}
      <table
        role="presentation"
        cellPadding="0"
        cellSpacing="0"
        width="100%"
        style={{
          backgroundColor: "#e5e7eb",
          borderRadius: "4px",
          overflow: "hidden",
          height: "8px",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: color,
                width: `${percentage}%`,
                height: "8px",
              }}
            />
          </tr>
        </tbody>
      </table>
      <p
        style={{
          margin: "6px 0 0 0",
          fontSize: "12px",
          color: "#6b7280",
          textAlign: "right",
        }}
      >
        {current} of {total} complete
      </p>
    </div>
  );
}

interface DividerProps {
  color?: string;
  margin?: string;
}

export function Divider({ color = "#e5e7eb", margin = "20px 0" }: DividerProps) {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      width="100%"
      style={{
        margin,
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              borderTop: `1px solid ${color}`,
            }}
          />
        </tr>
      </tbody>
    </table>
  );
}
