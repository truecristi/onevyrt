"use client";

/**
 * Extracted form field components from InspectorPanels.tsx
 * Reusable input components for the inspector UI
 */

export function Field({
  label,
  value,
  step,
  onChange,
  term,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  term?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span
        data-term={term}
        style={{ fontSize: 13, color: "var(--muted)" }}
      >
        {label}
      </span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: "100%",
          marginTop: 4,
          background: "var(--bg)",
          border: "1px solid var(--border3)",
          borderRadius: 6,
          color: "var(--text)",
          padding: "6px 8px",
          fontSize: 13,
        }}
      />
    </label>
  );
}

export function InspField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 4,
          background: "var(--surface2)",
          border: "1px solid var(--border3)",
          borderRadius: 6,
          color: "var(--text)",
          padding: "6px 8px",
          fontSize: 13,
        }}
      />
    </label>
  );
}

export function NumBox({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
  term,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  term?: string;
}) {
  return (
    <label style={{ flex: "1 1 44%", minWidth: 104 }}>
      <span
        data-term={term}
        style={{
          fontSize: 11,
          letterSpacing: 0.6,
          color: "var(--dim)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 3,
          background: "var(--surface2)",
          border: "1px solid var(--border3)",
          borderRadius: 6,
          padding: "5px 7px",
        }}
      >
        {prefix && (
          <span style={{ fontSize: 11, color: "var(--dim)" }}>{prefix}</span>
        )}
        <input
          type="number"
          step={step ?? 1}
          value={
            Number.isFinite(value)
              ? Math.round(value * 1000) / 1000
              : 0
          }
          onChange={(e) =>
            onChange(
              e.target.value === "" ? 0 : Number(e.target.value)
            )
          }
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
        {suffix && (
          <span style={{ fontSize: 11, color: "var(--dim)" }}>
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

export function StatBox({
  label,
  value,
  tone,
  term,
}: {
  label: string;
  value: string;
  tone?: string;
  term?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 44%",
        minWidth: 96,
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "7px 9px",
        background: "var(--surface2)",
      }}
    >
      <div
        data-term={term}
        style={{
          fontSize: 11,
          letterSpacing: 0.6,
          color: "var(--dim)",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: tone ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
