/**
 * ExportPanel — "you wrote it here, now put it in your platform."
 *
 * Drop-in, self-contained (own scoped styles, own class prefix `xp-`) so it
 * works on any OneVYRT page regardless of that page's CSS. Shows each asset as
 * a copy-to-clipboard block, plus a platform picker that reveals short
 * "paste this into X" steps for the currently selected platform.
 *
 * This is the copy+guide layer of the authoring→implement bridge (task #54);
 * file exports and native API pushes are later phases that can slot in beside
 * the platform picker without changing this contract.
 */
"use client";

import { useMemo, useState } from "react";
import { useToast } from "./Toast";
import { PLATFORMS, platformGuide, type ExportAsset } from "../lib/studio/platform-export";
import { copyText } from "../lib/clipboard";

export interface ExportPanelProps {
  assets: ExportAsset[];
  /** Heading shown at the top of the panel. */
  title?: string;
  /** Optional one-line explainer under the heading. */
  subtitle?: string;
}

export default function ExportPanel({ assets, title = "Use this in your platform", subtitle }: ExportPanelProps) {
  const toast = useToast();
  const usable = useMemo(() => assets.filter((a) => a.value.trim().length > 0), [assets]);
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]!.id);
  const [copiedKey, setCopiedKey] = useState<string>("");

  // The kinds present in this asset set — we only show guidance for those.
  const kinds = useMemo(() => Array.from(new Set(usable.map((a) => a.kind))), [usable]);

  if (usable.length === 0) return null;

  const copy = async (a: ExportAsset) => {
    if (await copyText(a.value)) {
      setCopiedKey(a.key);
      window.setTimeout(() => setCopiedKey((k) => (k === a.key ? "" : k)), 1600);
      toast(`Copied "${a.label}" — paste it into ${PLATFORMS.find((p) => p.id === platform)?.name}.`);
    } else {
      toast("Couldn't copy — select the text and copy manually.", "error");
    }
  };

  const kindLabel = (k: string) => (k === "web" ? "On a page / funnel" : k === "email" ? "In an email" : "As an audience list");

  return (
    <section className="xp" aria-label={title}>
      <style>{CSS}</style>
      <div className="xp-head">
        <div>
          <div className="xp-title">{title}</div>
          <div className="xp-sub">{subtitle ?? "OneVYRT is where you write it — copy each block and drop it into the tool you already use."}</div>
        </div>
      </div>

      {/* Copy blocks */}
      <div className="xp-assets">
        {usable.map((a) => (
          <div className="xp-asset" key={a.key}>
            <div className="xp-asset-top">
              <span className="xp-asset-label">{a.label}</span>
              <button type="button" className="xp-copy" onClick={() => void copy(a)}>
                {copiedKey === a.key ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <div className="xp-asset-val">{a.value}</div>
          </div>
        ))}
      </div>

      {/* Platform picker */}
      <div className="xp-plat-label">Where are you putting it?</div>
      <div className="xp-plats" role="tablist" aria-label="Target platform">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={platform === p.id}
            className={`xp-plat${platform === p.id ? " on" : ""}`}
            onClick={() => setPlatform(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Steps for the selected platform, per kind present */}
      <div className="xp-guide">
        <div className="xp-guide-note">{PLATFORMS.find((p) => p.id === platform)?.note}</div>
        {kinds.map((k) => {
          const steps = platformGuide(platform, k);
          return (
            <div className="xp-guide-block" key={k}>
              {kinds.length > 1 && <div className="xp-guide-kind">{kindLabel(k)}</div>}
              <ol className="xp-steps">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const CSS = `
.xp{--xp-brand:var(--ds-brand,#0a9e6e);--xp-surface:var(--ds-surface,#fff);--xp-subtle:var(--ds-surface-subtle,#fafbfc);
  --xp-text:var(--ds-text-primary,#111827);--xp-muted:var(--ds-text-secondary,#475569);--xp-tert:var(--ds-text-tertiary,#64748b);
  --xp-border:var(--ds-border-default,#dde3eb);
  background:var(--xp-surface);border:1px solid var(--xp-border);border-radius:var(--ds-radius-lg,12px);
  padding:16px 16px 18px;box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.04));margin-bottom:14px;color:var(--xp-text);}
.xp *{box-sizing:border-box;}
.xp-title{font-size:14px;font-weight:700;}
.xp-sub{font-size:12px;color:var(--xp-tert);margin-top:2px;line-height:1.5;max-width:60ch;}
.xp-head{margin-bottom:12px;}
.xp-assets{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;}
.xp-asset{border:1px solid var(--xp-border);border-radius:10px;background:var(--xp-subtle);padding:10px 12px;}
.xp-asset-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px;}
.xp-asset-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--xp-tert);}
.xp-copy{background:var(--xp-brand);color:#fff;border:none;border-radius:7px;padding:4px 11px;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .15s;white-space:nowrap;}
.xp-copy:hover{opacity:.88;}
.xp-asset-val{font-size:13.5px;line-height:1.5;color:var(--xp-text);white-space:pre-wrap;word-break:break-word;}
.xp-plat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--xp-tert);margin-bottom:8px;}
.xp-plats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}
.xp-plat{background:var(--xp-surface);border:1px solid var(--xp-border);color:var(--xp-muted);border-radius:99px;padding:6px 13px;font-size:12.5px;font-weight:500;cursor:pointer;transition:all .15s;}
.xp-plat:hover{border-color:var(--xp-brand);color:var(--xp-text);}
.xp-plat.on{background:var(--xp-brand);border-color:var(--xp-brand);color:#fff;}
.xp-guide{background:var(--xp-subtle);border:1px solid var(--xp-border);border-radius:10px;padding:12px 14px;}
.xp-guide-note{font-size:12px;color:var(--xp-tert);margin-bottom:8px;font-style:italic;}
.xp-guide-block+.xp-guide-block{margin-top:10px;padding-top:10px;border-top:1px solid var(--xp-border);}
.xp-guide-kind{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--xp-muted);margin-bottom:6px;}
.xp-steps{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:5px;}
.xp-steps li{font-size:13px;line-height:1.5;color:var(--xp-text);}
`;
