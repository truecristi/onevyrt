// Email-flow templates — classic lifecycle email sequences (category
// "Email flow").
import type { CampaignTemplate } from "./types";

export const EMAIL_TEMPLATES: CampaignTemplate[] = [
  {
    id: "welcome-onboarding",
    name: "Welcome & Onboarding",
    category: "Email flow",
    description: "The first week after someone joins: greet them, set expectations, and drive the one action that makes them stick.",
    objective: "Activate new subscribers or customers by getting them to their first real win fast.",
    channel: "Email",
    steps: [
      { channel: "email", kind: "email", day: 0, title: "Welcome + what to expect", content: "Warm welcome the moment they join. Confirm what they signed up for, set the cadence you'll email at, and point to the single most valuable first step." },
      { channel: "email", kind: "email", day: 1, title: "The one thing to do first", content: "Remove all choice: name the single action that delivers the first win (set up X, book Y, read Z). One link, one outcome." },
      { channel: "email", kind: "email", day: 3, title: "Show what's possible", content: "Paint the outcome with a quick customer story or use-case. Connect their first action to the bigger result they came for." },
      { channel: "email", kind: "email", day: 6, title: "Check in + open the door", content: "Ask how it's going, offer a genuine reply/support path, and softly surface the next step (upgrade, call, deeper feature)." },
    ],
  },
  {
    id: "abandoned-cart",
    name: "Abandoned Cart Recovery",
    category: "Email flow",
    description: "Recover checkouts that stalled — remind, reassure, and give one honest reason to finish now.",
    objective: "Convert a share of abandoned carts back into completed purchases.",
    channel: "Email + SMS",
    steps: [
      { channel: "email", kind: "email", day: 0, title: "You left something behind", content: "Send within an hour. Friendly, no guilt: show the item, a one-click return-to-cart link, and reassurance (secure checkout, easy returns)." },
      { channel: "email", kind: "email", day: 1, title: "Answer the hesitation", content: "Address the real reasons people stall — shipping, sizing/fit, guarantee, or a quick FAQ. Add a proof point or review of the exact item." },
      { channel: "sms", kind: "sms", day: 1, title: "Quick nudge", content: "Short text with the cart link. Only if they opted into SMS; respect the opt-out. Under 160 characters." },
      { channel: "email", kind: "email", day: 3, title: "Last reminder (optional incentive)", content: "Final email. Restate the value; if margins allow, a modest time-bound incentive. If not, urgency of stock/price. One clear CTA." },
    ],
  },
  {
    id: "post-purchase",
    name: "Post-Purchase & Review",
    category: "Email flow",
    description: "Turn a first purchase into a confident customer, a review, and a second order.",
    objective: "Reduce buyer's remorse and refunds, earn reviews, and prompt a natural repeat purchase.",
    channel: "Email",
    steps: [
      { channel: "email", kind: "email", day: 0, title: "Order confirmed + reassure", content: "Confirm the order, set delivery/onboarding expectations, and reinforce they made a great choice. Include how to reach a human." },
      { channel: "email", kind: "email", day: 3, title: "Get the most from it", content: "Help them succeed with what they bought — a tip, setup guide, or best-practice. A happy customer reviews and returns; an ignored one refunds." },
      { channel: "email", kind: "email", day: 8, title: "Ask for a review", content: "Once they've had time to experience the result, ask for an honest review with a one-tap link. Keep it short and specific." },
      { channel: "email", kind: "email", day: 14, title: "Natural next order", content: "Recommend the logical next product or replenishment based on what they bought. Frame it as the next step, not a random upsell." },
    ],
  },
  {
    id: "free-trial",
    name: "Free-Trial Conversion",
    category: "Email flow",
    description: "Guide a trial user to real value before the clock runs out, then convert them to paid.",
    objective: "Move trial signups to activated users and then to paying customers.",
    channel: "Email",
    steps: [
      { channel: "email", kind: "email", day: 0, title: "Start strong", content: "Welcome the trial user and point to the single action that reaches the 'aha' fastest. Make success in the first session the only goal." },
      { channel: "email", kind: "email", day: 2, title: "Unlock a key feature", content: "Highlight one high-value feature they haven't tried, tied to the outcome they signed up for. Show, don't list." },
      { channel: "email", kind: "email", day: 5, title: "Proof + what paid unlocks", content: "Share a result other customers get, and make clear what upgrading unlocks. Connect the paid plan to their now-familiar workflow." },
      { channel: "email", kind: "email", day: 7, title: "Trial ending — decide", content: "Honest heads-up that the trial ends soon. Recap the value they've built, remove friction to upgrade, one clear CTA. Offer help if they're unsure." },
    ],
  },
  {
    id: "referral-flywheel",
    name: "Referral / Advocacy",
    category: "Email flow",
    description: "Ask your happiest customers to bring the next one — at the moment they feel the win.",
    objective: "Turn satisfied customers into a repeatable source of warm referrals.",
    channel: "Email",
    steps: [
      { channel: "email", kind: "email", day: 0, title: "Celebrate their win", content: "Time this after a success milestone (result achieved, renewal, 5-star review). Acknowledge their win specifically before asking for anything." },
      { channel: "email", kind: "email", day: 2, title: "Make the ask easy", content: "Invite them to refer someone who'd benefit. Give a ready-to-forward message and a clear reward for both sides. One tap to share." },
      { channel: "email", kind: "email", day: 9, title: "Gentle reminder", content: "A light nudge for those who meant to and didn't. Restate the mutual reward and how simple it is. Thank them either way; respect a no." },
    ],
  },
];
