import type { Channel } from "./channels";

/** A single step in a campaign flow (a template step has no id yet). */
export interface TemplateStep {
  channel: Channel;
  kind: string;   // ad | email | landing | sms | post | call — free label
  title: string;
  content: string; // brief: what this step should say (placeholder + AI hint)
  day: number;     // day offset from campaign start
}

export interface CampaignTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  objective: string;
  channel: string; // primary channel label for the campaign card
  steps: TemplateStep[];
}
