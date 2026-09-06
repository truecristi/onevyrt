// Core campaign templates — the original general-purpose marketing flows
// (lead magnet, launch, nurture, webinar, win-back, local).
import type { CampaignTemplate } from "./types";

export const CORE_TEMPLATES: CampaignTemplate[] = [
  {
    id: "lead-magnet-funnel",
    name: "Lead Magnet Funnel",
    category: "Lead generation",
    description: "Trade a valuable free resource for an email, then warm new leads with a short nurture before the offer.",
    objective: "Grow the email list with qualified leads and convert a first tranche to a call or purchase.",
    channel: "Meta + Email",
    steps: [
      { channel: "meta", kind: "ad", day: 0, title: "Lead-magnet ad", content: "A paid ad offering the free resource. Lead with the single biggest problem it solves; make the promise specific and the download effortless." },
      { channel: "landing", kind: "landing", day: 0, title: "Opt-in page", content: "A focused landing page: headline = the outcome, 3 bullets on what's inside, one email field, one button. No navigation, no distractions." },
      { channel: "email", kind: "email", day: 0, title: "Deliver + welcome", content: "Instant delivery email with the resource link, a one-line reminder of why it matters, and a hint of what's coming next." },
      { channel: "email", kind: "email", day: 2, title: "Teach + build trust", content: "A useful email that helps them get a quick win with the resource, and quietly positions your paid offer as the natural next step." },
      { channel: "email", kind: "email", day: 4, title: "Invite to the offer", content: "Make the offer clearly: who it's for, the transformation, the specific next action (book a call / start trial). One strong CTA." },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch (Runway)",
    category: "Launch",
    description: "A staged launch: tease, build anticipation, open, then close with urgency.",
    objective: "Drive a concentrated burst of sales during an open cart window.",
    channel: "Email + Social",
    steps: [
      { channel: "email", kind: "email", day: -5, title: "Tease", content: "Hint that something is coming that solves a problem this audience cares about. Create curiosity without revealing the offer." },
      { channel: "organic", kind: "post", day: -3, title: "Anticipation post", content: "Share the 'why now' — the shift or insight behind the launch. Invite people to watch for the open date." },
      { channel: "email", kind: "email", day: 0, title: "Cart open", content: "Open with the full offer: the transformation, what's included, the price, the guarantee, and a single clear buy action." },
      { channel: "email", kind: "email", day: 2, title: "Handle objections", content: "Address the top 2–3 reasons people hesitate. Use a proof point or testimonial for each." },
      { channel: "email", kind: "email", day: 4, title: "Last call", content: "Close the window: restate the core outcome, note the deadline honestly, and give the final CTA." },
    ],
  },
  {
    id: "nurture-sequence",
    name: "Nurture Sequence",
    category: "Nurture",
    description: "Turn cold subscribers into buyers with a value-first email sequence.",
    objective: "Build trust and move new subscribers toward their first purchase.",
    channel: "Email",
    steps: [
      { channel: "email", kind: "email", day: 0, title: "Story + belief", content: "Share the origin story or belief behind the brand. Make the reader feel understood; end with what you help them achieve." },
      { channel: "email", kind: "email", day: 2, title: "Quick win", content: "Give one immediately useful tip they can apply today. Prove you can help before asking for anything." },
      { channel: "email", kind: "email", day: 4, title: "Proof", content: "Show a customer result or case. Focus on the before → after, not features." },
      { channel: "email", kind: "email", day: 6, title: "Soft offer", content: "Introduce the offer as the shortcut to the outcome. Low-pressure CTA to learn more or start." },
    ],
  },
  {
    id: "webinar-workshop",
    name: "Webinar / Workshop",
    category: "Event",
    description: "Fill a live session, maximise show-up, and convert attendees to the offer.",
    objective: "Register attendees, get them to show up live, and convert to a paid offer.",
    channel: "Ads + Email",
    steps: [
      { channel: "meta", kind: "ad", day: -7, title: "Registration ad", content: "Promote the free session by the single outcome attendees will walk away with. Specific date/time, easy signup." },
      { channel: "landing", kind: "landing", day: -7, title: "Registration page", content: "One promise, 3 bullets on what they'll learn, presenter credibility, one signup button." },
      { channel: "email", kind: "email", day: -1, title: "Reminder (24h)", content: "Remind registrants, restate the one big takeaway, add the join link and a calendar hold." },
      { channel: "sms", kind: "sms", day: 0, title: "Going live", content: "Short 'we're starting now' text with the join link. Keep it under 160 characters." },
      { channel: "email", kind: "email", day: 0, title: "Replay + offer", content: "Send the replay and open the offer introduced live. Clear CTA and a deadline for any session bonus." },
    ],
  },
  {
    id: "reengagement",
    name: "Win-Back / Re-engagement",
    category: "Retention",
    description: "Revive dormant subscribers or lapsed customers before they churn for good.",
    objective: "Re-activate cold contacts and recover a share of lapsed customers.",
    channel: "Email + SMS",
    steps: [
      { channel: "email", kind: "email", day: 0, title: "We miss you", content: "Acknowledge it's been a while, remind them of the value, and ask a simple question to re-open the conversation." },
      { channel: "email", kind: "email", day: 3, title: "Best reason to return", content: "Give the single strongest reason to come back now — a new result, improvement, or time-bound incentive." },
      { channel: "sms", kind: "sms", day: 5, title: "Final nudge", content: "One short text with a clear return CTA. Respect the opt-out." },
    ],
  },
  {
    id: "local-offline",
    name: "Local / Offline Offer",
    category: "Local",
    description: "Drive local foot traffic or bookings with a geo-targeted offer and follow-up.",
    objective: "Generate local bookings or visits from a targeted radius.",
    channel: "Meta + SMS",
    steps: [
      { channel: "meta", kind: "ad", day: 0, title: "Local offer ad", content: "Geo-targeted ad with a concrete local offer. Lead with the neighbourhood/city and the specific deal." },
      { channel: "landing", kind: "landing", day: 0, title: "Claim page", content: "Simple claim/booking page: the offer, the location + map, hours, and one action (book / claim / call)." },
      { channel: "sms", kind: "sms", day: 1, title: "Confirm + remind", content: "Confirm the booking or claim and set expectations. Include address and a reschedule option." },
    ],
  },
];
