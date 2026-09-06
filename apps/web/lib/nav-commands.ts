/**
 * App-wide navigation targets for the global ⌘K palette. Pure data (id, title,
 * section, keywords, href) so it's testable and the overlay stays a thin shell
 * over the existing fuzzy ranker (lib/studio/command-palette). Every major
 * destination is one keystroke away: press ⌘K (Ctrl+K), type, Enter.
 *
 * `section` mirrors AppNav's five canonical tabs (components/AppNav.tsx) —
 * Home · Programme · My Business · Coaching · Resources — grouped by the same
 * route prefixes as that nav's `match` predicates, so a command's section
 * always agrees with whichever tab actually highlights on its destination.
 */
import type { Command } from "./studio/command-palette";

export type NavCommand = Command & { href: string };

export const NAV_COMMANDS: NavCommand[] = [
  // — Home — (AppNav: "/", "/app", "/command-center*")
  { id: "nav-home", title: "Home — Launch Studio", section: "Home", keywords: ["dashboard", "command center", "momentum"], href: "/command-center" },
  { id: "nav-welcome", title: "Welcome — marketing landing", section: "Home", keywords: ["landing page", "marketing", "pre-auth", "signed out", "hero"], href: "/welcome" },
  { id: "nav-insights", title: "Insights", section: "Home", keywords: ["metrics", "leads", "cac", "book rate"], href: "/command-center/insights" },

  // — Programme — (AppNav: "/programme*", "/psychology*", "/numbers*", "/execution*", "/start*")
  { id: "nav-plan", title: "Your Plan", section: "Programme", keywords: ["start", "journey", "steps", "checklist", "onboarding", "what next"], href: "/start" },
  { id: "nav-programme", title: "Programme — your journey", section: "Programme", keywords: ["journey", "curriculum", "chapters", "modules", "path", "course"], href: "/programme" },
  { id: "nav-psych", title: "Psychology", section: "Programme", keywords: ["sell", "persuasion", "pillar"], href: "/psychology" },
  { id: "nav-golden", title: "The Golden Example (strategy)", section: "Programme", keywords: ["mcdonalds", "loss leader", "value ladder", "driving product", "back end", "profit engine", "upsell", "usp", "example"], href: "/psychology/golden" },
  { id: "nav-offer", title: "Offer & Positioning", section: "Programme", keywords: ["price", "guarantee", "deliverables", "objections", "audience", "sales page"], href: "/psychology/offer" },
  { id: "nav-sell", title: "Sell it better (AI rewrite)", section: "Programme", keywords: ["copy", "rewrite", "headline", "hook"], href: "/psychology/sell-better" },
  { id: "nav-swipe", title: "Swipe Library", section: "Programme", keywords: ["templates", "formulas", "examples", "copy"], href: "/psychology/swipe" },
  { id: "nav-outreach", title: "First Message (cold outreach)", section: "Programme", keywords: ["dm", "cold email", "reach out", "linkedin", "prospecting", "no audience"], href: "/psychology/outreach" },
  { id: "nav-content", title: "Content Angles (post ideas)", section: "Programme", keywords: ["social", "posts", "reels", "threads", "what to post", "audience", "content"], href: "/psychology/content" },
  { id: "nav-present", title: "Presentation checklist", section: "Programme", keywords: ["trust", "landing page", "proof"], href: "/psychology/presentation" },
  { id: "nav-kit", title: "Sales Kit (export copy)", section: "Programme", keywords: ["export", "wordpress", "paste", "copy blocks"], href: "/psychology/kit" },
  { id: "nav-numbers", title: "Numbers", section: "Programme", keywords: ["math", "viability", "pillar"], href: "/numbers" },
  { id: "nav-breakeven", title: "Break-even & goal planner", section: "Programme", keywords: ["profit", "margin", "price", "how many to sell", "traffic", "conversations"], href: "/numbers/break-even" },
  { id: "nav-exec", title: "Execution", section: "Programme", keywords: ["run", "pillar"], href: "/execution" },

  // — My Business — (AppNav: "/business", "/business/*")
  { id: "nav-business", title: "Business OS — Plan & Reality", section: "My Business", keywords: ["plan", "constraint", "drivers"], href: "/business" },
  { id: "nav-reality", title: "Reality Map", section: "My Business", keywords: ["where you are", "gap", "vision", "12 month", "36 month", "stage", "lifecycle"], href: "/business/reality" },
  { id: "nav-drivers", title: "Key Driver Tree", section: "My Business", keywords: ["levers", "leverage", "key drivers", "outcome", "multiply"], href: "/business/drivers" },
  { id: "nav-constraint", title: "Growth Constraint", section: "My Business", keywords: ["bottleneck", "theory of constraints", "focus", "relieve", "stop doing"], href: "/business/constraint" },
  { id: "nav-biz-execution", title: "Execution Centre", section: "My Business", keywords: ["sprints", "tasks", "90 day goals", "definition of done", "weighted progress"], href: "/business/execution" },
  { id: "nav-launches", title: "Launch OS", section: "My Business", keywords: ["go no-go", "readiness checklist", "preflight", "launch day", "blockers"], href: "/business/launches" },
  { id: "nav-review", title: "Review — close the loop", section: "My Business", keywords: ["retro", "actual vs plan", "learned", "review cycle"], href: "/business/review" },
  { id: "nav-message", title: "Message — your one-liner", section: "My Business", keywords: ["storybrand", "one liner", "positioning statement", "pitch"], href: "/business/message" },
  { id: "nav-funnels", title: "Funnels", section: "My Business", keywords: ["funnel builder", "qualify", "landing", "front door"], href: "/business/funnels" },
  { id: "nav-leads", title: "Leads & booking", section: "My Business", keywords: ["inbox", "booked", "calls", "contacts"], href: "/business/leads" },
  { id: "nav-segments", title: "Audiences & broadcasts", section: "My Business", keywords: ["segments", "email", "sms", "campaign", "send"], href: "/business/segments" },

  // — Coaching — (AppNav: "/businesses", "/businesses/*")
  { id: "nav-businesses", title: "My businesses & clients", section: "Coaching", keywords: ["businesses", "clients", "coaching", "portfolio", "workspaces", "coach", "students"], href: "/businesses" },

  // — Resources — (AppNav: "/studio", "/campaign-studio*", "/community*", "/glossary*")
  { id: "nav-campaigns", title: "Campaigns", section: "Resources", keywords: ["broadcast", "email", "sms"], href: "/campaign-studio/campaigns" },
  { id: "nav-creative", title: "Creative Studio", section: "Resources", keywords: ["ad creative", "meta ads", "facebook ads", "angles", "hooks"], href: "/campaign-studio/creative" },
  { id: "nav-write", title: "Asset Writer", section: "Resources", keywords: ["email", "landing page", "ad copy", "sms", "copywriting"], href: "/campaign-studio/write" },
  { id: "nav-connect", title: "Connect AI", section: "Resources", keywords: ["api key", "openai", "claude", "anthropic", "provider", "connections"], href: "/campaign-studio/connections" },
  { id: "nav-brand", title: "Brand & Presentation", section: "Resources", keywords: ["design", "logo", "colours", "visuals"], href: "/campaign-studio/brand" },
  { id: "nav-community", title: "Community", section: "Resources", keywords: ["grow", "share", "swipe"], href: "/community" },
  { id: "nav-glossary", title: "Glossary — plain-English terms", section: "Resources", keywords: ["help", "what does", "definitions", "meaning", "jargon"], href: "/glossary" },
];
