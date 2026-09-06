"use client";

/**
 * Break-even calculator — wires the engine's computeUnitBreakEven into the UI.
 * Self-contained: the user types price, variable cost and fixed costs (in major
 * currency units) plus an optional current volume, and sees contribution
 * margin, break-even units/revenue and margin of safety compute live. No
 * persistence needed — it's a quick "what would it take to break even" tool.
 */
import { useEffect, useRef, useState } from "react";
import { computeUnitBreakEven, unitsForTargetProfit, formatMoney } from "@onevyrt/engine";
import { conversationsForSales, leadsForConversations, visitorsForLeads, adSpendForVisitors } from "../../lib/studio/reach-plan";
import { CURRENCIES, currencySymbol, normalizeCurrency } from "../../lib/studio/currency";
import Explain from "../Explain";

const toMinor = (major: number) => Math.round(major * 100);

function NumField({ label, value, onChange, prefix, placeholder }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string }) {
  return (
    <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, display: "block" }}>
      {label}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
        {prefix && <span style={{ fontSize: 13, color: "var(--dim)" }}>{prefix}</span>}
        <input inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 10, padding: "8px 10px", fontSize: 14 }} />
      </div>
    </label>
  );
}

function Row({ label, value, strong, explain }: { label: string; value: string; strong?: boolean; explain?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}{explain && <Explain term={explain} />}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}

export function BreakEvenCard({ currency, initialPrice, persist }: { currency: string; initialPrice?: number; persist?: boolean }) {
  // Currency is workspace-wide; when persisting it's loaded from (and saved to)
  // the economics record, so break-even stops being hardcoded USD for non-US
  // owners. The `currency` prop is the initial/fallback value.
  const [currencyCode, setCurrencyCode] = useState(() => normalizeCurrency(currency));
  const sym = currencySymbol(currencyCode);
  // Fields start blank, not pre-filled with plausible-looking numbers — a
  // brand-new user must never see a computed break-even that's secretly made
  // of invented figures (previously: $50 price / $20 variable / $6,000 fixed,
  // silently). The old defaults now live only as grey `placeholder` hints on
  // the inputs below, which are never part of the calculation.
  const [price, setPrice] = useState(initialPrice != null && initialPrice > 0 ? String(initialPrice) : "");
  // The offer price often arrives after mount (async fetch on the parent), so
  // the initializer above sees it as undefined. Seed the field once when a real
  // price shows up — but only until the user edits it, so we never stomp typing.
  const priceEdited = useRef(false);
  useEffect(() => {
    if (priceEdited.current) return;
    if (initialPrice != null && initialPrice > 0) setPrice(String(initialPrice));
  }, [initialPrice]);
  const [variable, setVariable] = useState("");
  const [fixed, setFixed] = useState("");
  const [units, setUnits] = useState("");
  const [goal, setGoal] = useState("");
  const [close, setClose] = useState("");
  const [qualify, setQualify] = useState("");
  const [optin, setOptin] = useState("");
  const [cpv, setCpv] = useState("");
  // Persistence (only when `persist`): the economics figures (not price — that
  // comes from the offer) are saved to the workspace so they survive a reload
  // and are read by the Numbers hub's viability meter.
  const [loaded, setLoaded] = useState(!persist);
  // If the user starts typing before the (async) economics fetch lands, the
  // response must NOT overwrite their in-progress input — the debounced save
  // would then persist the reverted numbers. Any field edit wins over the load.
  const formEdited = useRef(false);
  const touch = (fn: (v: string) => void) => (v: string) => { formEdited.current = true; fn(v); };

  useEffect(() => {
    if (!persist) return;
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/business/economics", { credentials: "include" });
        // getEconomics only stamps `updatedAt` once the workspace has actually
        // saved a real economics record — an untouched workspace comes back as
        // plain zeros with no updatedAt. Only populate the fields from a real
        // save; otherwise leave them blank so the form reads as not-started
        // instead of quietly typing in someone else's zeros.
        if (live && r.ok && !formEdited.current) {
          const e = await r.json();
          if (typeof e?.updatedAt !== "string") return;
          if (typeof e?.variableCostPerUnit === "number") setVariable(String(e.variableCostPerUnit));
          if (typeof e?.fixedCosts === "number") setFixed(String(e.fixedCosts));
          if (typeof e?.currentUnits === "number") setUnits(String(e.currentUnits));
          if (typeof e?.profitGoal === "number") setGoal(String(e.profitGoal));
          if (typeof e?.closeRatePct === "number") setClose(String(e.closeRatePct));
          if (typeof e?.qualifyRatePct === "number") setQualify(String(e.qualifyRatePct));
          if (typeof e?.optInRatePct === "number") setOptin(String(e.optInRatePct));
          if (typeof e?.costPerVisitor === "number") setCpv(String(e.costPerVisitor));
          if (typeof e?.currency === "string") setCurrencyCode(normalizeCurrency(e.currency));
        }
      } catch { /* fall back to defaults */ }
      finally { if (live) setLoaded(true); }
    })();
    return () => { live = false; };
  }, [persist]);

  const num = (s: string) => { const n = Number(s.replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
  const currentUnits = units.trim() === "" ? undefined : Math.max(0, Math.round(num(units)));
  // True once the user (or a real seeded offer price) has put a real number
  // into price, variable cost or fixed costs. Until then the results below
  // would just be computing from blanks-as-zero, which reads as a genuine
  // "each sale loses money" verdict on a form nobody has touched yet.
  const started = price.trim() !== "" || variable.trim() !== "" || fixed.trim() !== "";

  const econ = { fixedCosts: toMinor(num(fixed)), pricePerUnit: toMinor(num(price)), variableCostPerUnit: toMinor(num(variable)) };
  const r = computeUnitBreakEven(econ, currentUnits);
  const goalProfit = goal.trim() === "" ? undefined : num(goal);
  const goalUnits = goalProfit !== undefined ? unitsForTargetProfit(econ, toMinor(goalProfit)) : undefined;
  const goalConvos = goalUnits != null ? conversationsForSales(goalUnits, num(close)) : null;
  const goalLeads = leadsForConversations(goalConvos, num(qualify));
  const goalVisitors = visitorsForLeads(goalLeads, num(optin));
  const goalSpend = adSpendForVisitors(goalVisitors, num(cpv));
  const goalProfitMinor = goalProfit !== undefined ? toMinor(goalProfit) : undefined;
  const spendMinor = goalSpend !== null ? toMinor(goalSpend) : null;
  // "Worth it" = the ad budget to reach the goal is smaller than the profit the
  // goal delivers. If buying the traffic costs more than the goal pays, the
  // honest answer is to earn those visitors for free (outreach / content).
  const adWorthIt = spendMinor !== null && goalProfitMinor !== undefined && goalProfitMinor > 0 && spendMinor < goalProfitMinor;

  // "Biggest lever" — a single, prescriptive "which knob do I turn first"
  // line, built only from numbers already on this form (no new inputs, no
  // fetches). We nudge each lever a founder can actually pull by the same
  // realistic ~10% move and see which one shrinks the real target the most:
  // units-to-goal (or break-even units, with no goal set) normally, or — once
  // the funnel section below is filled in — the ad budget needed to get
  // there, since that's the number a founder ultimately has to spend. A lever
  // that isn't filled in yet (no cost-per-visitor, no conversion rates) is
  // simply left out of the comparison rather than guessed at.
  //
  // `@onevyrt/engine`'s profit-drivers helper models a different shape (a
  // period revenue/cost baseline improved by 5 fixed named levers) that
  // doesn't map cleanly onto price/cost-per-visitor/conversion without
  // inventing a baseline this card doesn't always have (no current units ==
  // no baseline), so this reuses the same break-even + reach-plan calls
  // already used above instead of forcing that fit.
  const lever: string | null = (() => {
    const LEVER_MOVE = 0.1; // a realistic ~10% nudge, applied to every lever so they're comparable
    const movePct = `${Math.round(LEVER_MOVE * 100)}%`;
    const gp = goalProfitMinor;

    if (r.breakEvenUnits === null) {
      // Each sale already loses money — no volume lever below fixes that;
      // the fix is the price/cost relationship itself.
      if (num(price) <= 0) return null;
      return `Price doesn't clear variable cost — raise price above ${formatMoney(econ.variableCostPerUnit, currencyCode)} (or cut variable cost below price) before anything else; no volume of sales can reach break-even yet.`;
    }

    // Units needed to hit the goal (or break even, with no goal) for a given
    // hypothetical price/variable cost — same engine calls as the results above.
    const unitsNeededWith = (priceMinor: number, variableMinor: number): number | null => {
      const hypEcon = { fixedCosts: econ.fixedCosts, pricePerUnit: priceMinor, variableCostPerUnit: variableMinor };
      return gp !== undefined ? unitsForTargetProfit(hypEcon, gp) : computeUnitBreakEven(hypEcon).breakEvenUnits;
    };
    // Cascade a units figure down to visitors/ad spend via the exact same
    // funnel helpers as the "path to goal" section above — already null-safe.
    const spendForUnits = (unitsNeeded: number | null, closePct: number, qualifyPct: number, optinPct: number, cpvMajor: number) => {
      const convos = conversationsForSales(unitsNeeded, closePct);
      const leads = leadsForConversations(convos, qualifyPct);
      const visitors = visitorsForLeads(leads, optinPct);
      const spend = adSpendForVisitors(visitors, cpvMajor);
      return { visitors, spend };
    };

    const baseUnits = unitsNeededWith(econ.pricePerUnit, econ.variableCostPerUnit);
    if (baseUnits === null || baseUnits <= 0) return null;
    const baseFunnel = spendForUnits(baseUnits, num(close), num(qualify), num(optin), num(cpv));

    // Compare every lever on the most concrete metric this form actually
    // supports right now: ad budget once cost-per-visitor is filled in, else
    // visitors once the conversion rates are filled in, else plain units.
    let tier: "spend" | "visitors" | "units";
    let baseMetric: number;
    if (baseFunnel.spend !== null) { tier = "spend"; baseMetric = toMinor(baseFunnel.spend); }
    else if (baseFunnel.visitors !== null) { tier = "visitors"; baseMetric = baseFunnel.visitors; }
    else { tier = "units"; baseMetric = baseUnits; }
    if (baseMetric <= 0) return null;

    const metricFor = (unitsNeeded: number | null): number | null => {
      if (tier === "units") return unitsNeeded;
      const f = spendForUnits(unitsNeeded, num(close), num(qualify), num(optin), num(cpv));
      return tier === "spend" ? (f.spend !== null ? toMinor(f.spend) : null) : f.visitors;
    };

    const candidates: { label: string; after: number | null }[] = [
      { label: `Raising price ~${movePct}`, after: metricFor(unitsNeededWith(toMinor(num(price) * (1 + LEVER_MOVE)), econ.variableCostPerUnit)) },
    ];
    if (num(variable) > 0) {
      candidates.push({ label: `Cutting variable cost ~${movePct}`, after: metricFor(unitsNeededWith(econ.pricePerUnit, toMinor(num(variable) * (1 - LEVER_MOVE)))) });
    }
    if (tier === "spend" && num(cpv) > 0) {
      const hypSpend = adSpendForVisitors(baseFunnel.visitors, num(cpv) * (1 - LEVER_MOVE));
      candidates.push({ label: `Cutting cost-per-visitor ~${movePct}`, after: hypSpend !== null ? toMinor(hypSpend) : null });
    }
    if (tier !== "units" && (num(close) > 0 || num(qualify) > 0 || num(optin) > 0)) {
      const bump = (v: number) => (v > 0 ? Math.min(100, v * (1 + LEVER_MOVE)) : v);
      const f = spendForUnits(baseUnits, bump(num(close)), bump(num(qualify)), bump(num(optin)), num(cpv));
      candidates.push({ label: `Lifting your conversion rates ~${movePct}`, after: tier === "spend" ? (f.spend !== null ? toMinor(f.spend) : null) : f.visitors });
    }

    let bestLabel: string | null = null;
    let bestAfter = 0;
    let bestImprovement = 0;
    for (const c of candidates) {
      if (c.after === null) continue;
      const improvement = (baseMetric - c.after) / baseMetric;
      if (improvement > bestImprovement) { bestImprovement = improvement; bestLabel = c.label; bestAfter = c.after; }
    }
    if (bestLabel === null || bestImprovement <= 0.001) return null; // no lever here clears the noise floor

    const metricName = tier === "spend" ? "the ad budget to hit your goal" : tier === "visitors" ? "the visitors you need to hit your goal" : gp !== undefined ? "units-to-goal" : "break-even units";
    const fmt = (v: number) => (tier === "spend" ? formatMoney(v, currencyCode) : `${v.toLocaleString()} ${tier === "visitors" ? "visitors" : "units"}`);
    return `${bestLabel} cuts ${metricName} from ${fmt(baseMetric)} to ${fmt(bestAfter)} — the fastest lever here.`;
  })();

  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

  // Debounced persist of the economics figures once loaded (never price).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!persist || !loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload: Record<string, number | string> = { fixedCosts: num(fixed), variableCostPerUnit: num(variable) };
      if (units.trim() !== "") payload.currentUnits = Math.max(0, Math.round(num(units)));
      if (goal.trim() !== "") payload.profitGoal = num(goal);
      if (close.trim() !== "") payload.closeRatePct = Math.min(100, Math.max(0, num(close)));
      if (qualify.trim() !== "") payload.qualifyRatePct = Math.min(100, Math.max(0, num(qualify)));
      if (optin.trim() !== "") payload.optInRatePct = Math.min(100, Math.max(0, num(optin)));
      if (cpv.trim() !== "") payload.costPerVisitor = Math.max(0, num(cpv));
      const body = { ...payload, currency: currencyCode };
      void fetch("/api/business/economics", {
        method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      }).catch(() => { /* best-effort; a reload re-reads the last saved state */ });
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [persist, loaded, fixed, variable, units, goal, close, qualify, optin, cpv, currencyCode]);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, padding: 18, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Break-even</div>
        {persist && (
          <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 5 }}>
            Currency
            <select value={currencyCode} onChange={(e) => { formEdited.current = true; setCurrencyCode(normalizeCurrency(e.target.value)); }}
              aria-label="Workspace currency"
              style={{ background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 8, padding: "3px 6px", fontSize: 12 }}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
            </select>
          </label>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 14 }}>How many you must sell to cover fixed costs — and how much cushion you have.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
        <NumField label="Price / unit" value={price} onChange={(v) => { priceEdited.current = true; setPrice(v); }} prefix={sym} placeholder="50" />
        <NumField label="Variable cost / unit" value={variable} onChange={touch(setVariable)} prefix={sym} placeholder="20" />
        <NumField label="Fixed costs (period)" value={fixed} onChange={touch(setFixed)} prefix={sym} placeholder="6,000" />
        <NumField label="Current units (optional)" value={units} onChange={touch(setUnits)} />
        <NumField label="Profit goal (optional)" value={goal} onChange={touch(setGoal)} prefix={sym} />
        <NumField label="Close rate % (optional)" value={close} onChange={touch(setClose)} />
        <NumField label="Qualify rate % (optional)" value={qualify} onChange={touch(setQualify)} />
        <NumField label="Visitor→lead % (optional)" value={optin} onChange={touch(setOptin)} />
        <NumField label="Cost per visitor (optional)" value={cpv} onChange={touch(setCpv)} prefix={sym} />
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
      {!started ? (
        <div style={{ fontSize: 13, color: "var(--dim)", padding: "6px 0" }}>Not started — enter a price and your costs above to see your break-even.</div>
      ) : (
      <>
        <Row label="Contribution / unit" value={formatMoney(r.contributionPerUnit, currencyCode)} explain="Contribution per unit" />
        <Row label="Contribution margin" value={pct(r.contributionMarginPct)} explain="Contribution margin" />
        {r.breakEvenUnits === null ? (
          <Row label="Break-even" value="Never — each sale loses money" strong explain="Break-even" />
        ) : (
          <>
            <Row label="Break-even units" value={`${r.breakEvenUnits.toLocaleString()} units`} strong explain="Break-even" />
            <Row label="Break-even revenue" value={r.breakEvenRevenue !== null ? formatMoney(r.breakEvenRevenue, currencyCode) : "—"} />
          </>
        )}
        {currentUnits !== undefined && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
            <Row label={`Profit at ${currentUnits.toLocaleString()} units`} value={r.currentProfit !== null ? formatMoney(r.currentProfit, currencyCode) : "—"}
              strong />
            {r.marginOfSafetyUnits !== null && (
              <Row label="Margin of safety" value={`${r.marginOfSafetyUnits >= 0 ? "+" : ""}${r.marginOfSafetyUnits.toLocaleString()} units${r.marginOfSafetyPct !== null ? ` (${pct(r.marginOfSafetyPct)})` : ""}`} explain="Margin of safety" />
            )}
          </>
        )}
        {goalProfit !== undefined && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
            <Row label={`Sell this to make ${formatMoney(toMinor(goalProfit), currencyCode)}`}
              value={goalUnits === null ? "Never — each sale loses money" : `${goalUnits!.toLocaleString()} units`} strong />
            {goalUnits !== null && goalUnits! > 0 && num(price) > 0 && (
              <Row label="Revenue at that goal" value={formatMoney(goalUnits! * toMinor(num(price)), currencyCode)} />
            )}
            {goalConvos !== null && (
              <Row label="Sales conversations to get there" value={`${goalConvos.toLocaleString()} conversations`} explain="Close rate" />
            )}
            {goalLeads !== null && (
              <Row label="Leads you need" value={`${goalLeads.toLocaleString()} leads`} explain="Qualify rate" />
            )}
            {goalVisitors !== null && (
              <Row label="Visitors you need" value={`${goalVisitors.toLocaleString()} visitors`} explain="Opt-in rate" />
            )}
            {goalSpend !== null && spendMinor !== null && (
              <Row label="Ad budget to hit your goal" value={formatMoney(spendMinor, currencyCode)} strong explain="Cost per visitor" />
            )}
            {goalSpend !== null && goalProfitMinor !== undefined && goalProfitMinor > 0 && (
              <div style={{ marginTop: 8, background: adWorthIt ? "var(--ds-brand-soft, var(--surface2))" : "var(--surface2)", border: `1px solid ${adWorthIt ? "var(--ds-brand, var(--border2))" : "var(--border2)"}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.55, color: "var(--text)" }}>
                {adWorthIt ? (
                  <>Paid traffic can work: spending <b>{formatMoney(spendMinor!, currencyCode)}</b> to reach this goal is less than the <b>{formatMoney(goalProfitMinor, currencyCode)}</b> profit it makes — a return of about <b>{(goalProfit! / goalSpend).toFixed(1)}×</b> on ad spend.</>
                ) : (
                  <>Paid traffic is a hard sell here: buying <b>{formatMoney(spendMinor!, currencyCode)}</b> of visitors to make <b>{formatMoney(goalProfitMinor, currencyCode)}</b> leaves little or no profit. Earn those visitors for free first — <b>First Message</b> outreach and <b>Content Angles</b> cost time, not budget.</>
                )}
              </div>
            )}
            {goalUnits !== null && goalUnits! > 0 && (goalConvos !== null || goalLeads !== null || goalVisitors !== null) && (
              <div style={{ marginTop: 8, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.55, color: "var(--text)" }}>
                <b>Your path to {formatMoney(toMinor(num(goal)), currencyCode)}:</b>{" "}
                {[
                  goalVisitors !== null && `bring ${goalVisitors.toLocaleString()} visitors`,
                  goalLeads !== null && `collect ${goalLeads.toLocaleString()} leads`,
                  goalConvos !== null && `have ${goalConvos.toLocaleString()} sales conversations`,
                  `close ${goalUnits!.toLocaleString()} sale${goalUnits === 1 ? "" : "s"}`,
                ].filter(Boolean).join(" → ")}.
              </div>
            )}
          </>
        )}
        {lever && (
          <div style={{ marginTop: 8, background: "var(--ds-brand-soft, var(--surface2))", border: "1px solid var(--ds-brand, var(--border2))", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.55, color: "var(--text)" }}>
            <b>Biggest lever:</b> {lever}
          </div>
        )}
      </>
      )}
      </div>
    </div>
  );
}
