/**
 * ONEVYRT Design System v1 — DataTable.
 * One shared, accessible table for the app's list surfaces (leads, activity,
 * webhook log, …) so rows, headers, alignment and the wrapping scroll container
 * read the same everywhere instead of each page hand-rolling a <table>.
 *
 * Accessibility features (WCAG 2.1 Level AA):
 * - Semantic <table> with proper <th scope="col"> headers
 * - Optional <caption> for screen readers
 * - Keyboard navigation: Tab to navigate rows, Enter to activate (if clickable)
 * - Focus visible: Rows show focus ring when keyboard-navigated
 * - Touch targets: 44px minimum height for mobile accessibility
 * - Scrollable container with hint on mobile ("↔ Swipe to scroll")
 * - Responsive: Adapts for mobile (wraps table, adds scroll hint)
 *
 * Usage:
 *   <DataTable
 *     columns={[{ key: 'name', header: 'Name', render: (row) => row.name }]}
 *     rows={data}
 *     rowKey={(row) => row.id}
 *     caption="List of active leads"
 *     onRowClick={(row) => navigateTo(row.id)}
 *   />
 */
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  className = "",
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Rendered in place of the table when there are no rows (e.g. an EmptyState). */
  empty?: ReactNode;
  /** Optional row click — makes rows keyboard-activatable too. */
  onRowClick?: (row: T) => void;
  className?: string;
  /** Caption for the table (screen-reader visible, best practice). */
  caption?: ReactNode;
}) {
  if (rows.length === 0 && empty !== undefined) return <>{empty}</>;

  const headCell = (c: Column<T>) => ({
    textAlign: c.align ?? ("left" as const),
    padding: "8px 10px",
    borderBottom: "1px solid var(--border)",
    color: "var(--ds-text-secondary, var(--muted))",
    fontWeight: 600,
    fontSize: 11.5,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
    width: c.width,
  });

  return (
    <div
      className="ds-table-wrap"
      style={{
        overflowX: "auto",
        width: "100%",
        WebkitOverflowScrolling: "touch",
      }}
      role="region"
      aria-label={caption ? undefined : "Data table"}
    >
      <style>{`
        @media (max-width: 639px) {
          .ds-table-wrap {
            border: 1px solid var(--border);
            border-radius: 8px;
          }
          .ds-table-wrap::after {
            content: '↔ Swipe to scroll';
            display: block;
            font-size: 11px;
            color: var(--ds-text-tertiary, #94a3b8);
            padding: 6px 10px;
            text-align: center;
            background: var(--ds-bg-subtle, #f1f4f9);
          }
        }
      `}</style>
      <table
        className={["ds-table", className].filter(Boolean).join(" ")}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          minWidth: "500px",
        }}
      >
        {caption && (
          <caption
            style={{
              textAlign: "left",
              padding: "8px 10px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ds-text-primary, var(--text))",
              captionSide: "top",
            }}
          >
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={headCell(c)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              style={{
                cursor: onRowClick ? "pointer" : undefined,
                minHeight: "44px",
              }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align ?? "left",
                    padding: "11px 10px",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--ds-text-primary, var(--text))",
                    verticalAlign: "middle",
                    minHeight: "44px",
                  }}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
