/**
 * Funnel Education Hub — comprehensive guide to how sales funnels work,
 * traffic flow, conversion stages, and where businesses typically drop off.
 * Server-rendered with interactive client components for visualizations.
 *
 * The actual markup lives in `FunnelsExplainedContent` (a Client Component)
 * because it uses `<style jsx>` (styled-jsx), which only works from a Client
 * Component — see that file's own comment for why the styles couldn't just
 * stay split out on their own.
 */
import type { Metadata } from "next";
import { FunnelsExplainedContent } from "../../../components/funnel-education/FunnelsExplainedContent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "How Sales Funnels Work — ONEVYRT" };

export default function FunnelsExplainedPage() {
  return <FunnelsExplainedContent />;
}
