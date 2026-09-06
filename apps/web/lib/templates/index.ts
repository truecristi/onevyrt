/**
 * Campaign Studio — built-in campaign templates. Each template is a proven
 * marketing *structure* (an ordered flow of steps across channels) that seeds a
 * new campaign; the user then fills or AI-generates each step's copy from their
 * Brand Brain. These are original, general marketing mechanics — no external
 * course material, scripts, or pricing is embedded.
 *
 * The catalogue is split across ./catalog-* files (core / email / industries)
 * and combined here; consumers keep importing from "lib/templates".
 */
export * from "./channels";
export * from "./types";

import type { CampaignTemplate } from "./types";
import { CORE_TEMPLATES } from "./catalog-core";
import { EMAIL_TEMPLATES } from "./catalog-email";
import { INDUSTRY_TEMPLATES } from "./catalog-industries";

export const TEMPLATES: CampaignTemplate[] = [
  ...CORE_TEMPLATES,
  ...EMAIL_TEMPLATES,
  ...INDUSTRY_TEMPLATES,
];

export function findTemplate(id: string): CampaignTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
