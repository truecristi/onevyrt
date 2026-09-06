/**
 * Funnel templates + business playbooks — pure data and builders extracted
 * from funnel-studio.tsx to shrink that monolith. TEMPLATES/buildTemplate seed
 * the canvas from a named funnel shape; PLAYBOOKS/inferPlaybook map a business
 * definition to a starter playbook. No studio state — safe to live on its own.
 */
import type { Node, Edge } from "@xyflow/react";
import type { BusinessDefinition } from "@onevyrt/engine";
import { defaultData, type RFNodeData } from "../funnel-map";

type TemplateNode = { id: string; kind: RFNodeData["kind"]; label: string; extra?: Partial<RFNodeData> };
export type TemplateCategory = "Golden Examples" | "Lead Generation" | "Sales & Booking" | "Recurring Revenue" | "Events & Ops";
export type Template = { key: string; name: string; blurb: string; category: TemplateCategory; nodes: TemplateNode[]; edges: [string, string][] };
// "Golden Examples" first so the two proven value-ladders (McDonald's,
// ClickFunnels) are the first thing a founder sees in the template picker.
export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["Golden Examples", "Lead Generation", "Sales & Booking", "Recurring Revenue", "Events & Ops"];
export const TEMPLATES: Template[] = [
  // ── Golden Examples ──────────────────────────────────────────────────────
  // Two famous businesses, modelled as real funnels so you can watch the
  // strategy pay off: a cheap DRIVING PRODUCT (sold thin, even at a loss) pulls
  // people in, then the real profit rides on the back end. Each rung is its own
  // offer node with its own P&L, so the loss-leader shows red and the back end
  // shows the money — the whole point, made visible. Prices are in minor units
  // (cents); costPerVisitor too.
  {
    key: "golden-mcdonalds", name: "McDonald's — loss-leader → profit on the extras", category: "Golden Examples",
    blurb: "The $1 burger barely profits — it exists to get you in the door. The fries and drink attached to it carry an 80%+ margin, and the habit of coming back twice a week turns one cheap sale into years of spend. Watch the driving product run red on the canvas while the back end carries the whole P&L. Steal the shape: price your entry item to be an easy yes, then make your real money on the attach and the repeat — never on the first sale.",
    nodes: [
      { id: "t", kind: "traffic", label: "Foot + drive-thru traffic", extra: { visitors: 12000, costPerVisitor: 20 } },
      { id: "order", kind: "step", label: "Orders at counter / drive-thru", extra: { passRate: 0.55 } },
      { id: "burger", kind: "offer", label: "$1 driving item (sold at a loss)", extra: { conversionRate: 0.95, price: 200, unitCost: 250 } },
      { id: "add", kind: "step", label: "Adds fries + a drink", extra: { passRate: 0.72 } },
      { id: "combo", kind: "offer", label: "Fries + drink (the margin)", extra: { conversionRate: 0.9, price: 460, unitCost: 110 } },
      { id: "back", kind: "step", label: "Comes back next week", extra: { passRate: 0.45 } },
      { id: "repeat", kind: "offer", label: "Repeat visits & combos (profit engine)", extra: { conversionRate: 0.8, price: 1200, unitCost: 480 } },
    ],
    edges: [["t", "order"], ["order", "burger"], ["burger", "add"], ["add", "combo"], ["combo", "back"], ["back", "repeat"]],
  },
  {
    key: "golden-clickfunnels", name: "ClickFunnels — free book → software → high-ticket", category: "Golden Examples",
    blurb: "A free book (just pay shipping) turns a stranger into a buyer at a loss — the shipping barely covers the print run, on purpose. Once someone has paid you once, the next yes is easier: they climb to $97/mo software, then to high-ticket coaching for the best-fit few, where nearly all the profit lives. Each rung costs more, delivers more, and filters to your most committed customers. This is the original “value ladder,” and it’s the template most online businesses quietly run: a nearly-free first step, then a climb where every level pays better than the last.",
    nodes: [
      { id: "t", kind: "traffic", label: "Cold traffic (ads + content)", extra: { visitors: 20000, costPerVisitor: 120 } },
      { id: "lp", kind: "step", label: "Free-book landing page", extra: { passRate: 0.12 } },
      { id: "book", kind: "offer", label: "Free + $7.95 shipping book (loss leader)", extra: { conversionRate: 0.85, price: 795, unitCost: 1300, orderBumpRate: 0.35, orderBumpPrice: 3700 } },
      { id: "trial", kind: "step", label: "Reads it → wants the software", extra: { passRate: 0.35 } },
      { id: "saas", kind: "offer", label: "Funnel software ($97/mo core)", extra: { conversionRate: 0.5, price: 9700, monthlyPrice: 9700, recurringRate: 1, churnRate: 0.06, unitCost: 600 } },
      { id: "up", kind: "step", label: "Power users → high-ticket", extra: { passRate: 0.12 } },
      { id: "coaching", kind: "offer", label: "Coaching & live events (profit engine)", extra: { conversionRate: 0.4, price: 250000, unitCost: 45000 } },
    ],
    edges: [["t", "lp"], ["lp", "book"], ["book", "trial"], ["trial", "saas"], ["saas", "up"], ["up", "coaching"]],
  },
  {
    key: "golden-gillette", name: "Gillette \u2014 razor & blades (the original)", category: "Golden Examples",
    blurb: "Give away the razor, sell the blades forever. The handle is cheap or free — a one-time cost you eat to capture a customer now locked to your blade format. The profit is the refills they keep buying every few weeks for years, at a fat margin. This is the original “razor-and-blades” model every subscription copied: subsidise the thing that creates the habit, then earn on the consumable it forces. Steal it whenever your product has a repeat-purchase part — give ground on the first unit to own the reorder.",
    nodes: [
      { id: "t", kind: "traffic", label: "Retail shelf + ads", extra: { visitors: 15000, costPerVisitor: 30 } },
      { id: "buy", kind: "step", label: "Buys the starter kit", extra: { passRate: 0.4 } },
      { id: "razor", kind: "offer", label: "Cheap razor handle (at a loss)", extra: { conversionRate: 0.9, price: 500, unitCost: 650 } },
      { id: "run", kind: "step", label: "Runs out of blades", extra: { passRate: 0.85 } },
      { id: "blades", kind: "offer", label: "Blade refills, forever (profit engine)", extra: { conversionRate: 0.8, price: 2500, unitCost: 400 } },
    ],
    edges: [["t", "buy"], ["buy", "razor"], ["razor", "run"], ["run", "blades"]],
  },
  {
    key: "golden-costco", name: "Costco \u2014 the membership IS the profit", category: "Golden Examples",
    blurb: "Sell the groceries at cost — you barely make a cent on them, and you advertise that so shoppers trust every price. The annual membership fee, renewed by ~90% of members, is where nearly all the operating profit actually comes from. It flips the usual model completely: the product is the bait, the recurring fee is the business. Steal it when you can turn access itself into the product — charge for the membership, then price everything inside it so cheaply that leaving feels like losing money.",
    nodes: [
      { id: "t", kind: "traffic", label: "Local shoppers", extra: { visitors: 20000, costPerVisitor: 25 } },
      { id: "shop", kind: "step", label: "Shops the warehouse", extra: { passRate: 0.5 } },
      { id: "goods", kind: "offer", label: "Groceries at/below cost (loss leader)", extra: { conversionRate: 0.95, price: 12000, unitCost: 12300 } },
      { id: "join", kind: "step", label: "Joins to keep shopping", extra: { passRate: 0.6 } },
      { id: "member", kind: "offer", label: "Annual membership (the real profit)", extra: { conversionRate: 0.9, price: 6000, unitCost: 300 } },
    ],
    edges: [["t", "shop"], ["shop", "goods"], ["goods", "join"], ["join", "member"]],
  },
  {
    key: "golden-dsc", name: "Dollar Shave Club \u2014 $1 razor \u2192 subscription", category: "Golden Examples",
    blurb: "A $1 starter razor and a viral video get the customer in the door cheaply — the acquisition loses money on day one, by design. Behind it sits a monthly blade subscription that bills every month with almost no further marketing cost, paying back the acquisition many times over across a customer’s lifetime. The whole game is lifetime value beating acquisition cost. Steal it: you can afford to lose money getting the first order if a subscription behind it earns it all back — and then some.",
    nodes: [
      { id: "t", kind: "traffic", label: "Viral video + ads", extra: { visitors: 30000, costPerVisitor: 80 } },
      { id: "lp", kind: "step", label: "Starter-offer page", extra: { passRate: 0.18 } },
      { id: "starter", kind: "offer", label: "$1 starter razor (loss leader)", extra: { conversionRate: 0.85, price: 100, unitCost: 450 } },
      { id: "keep", kind: "step", label: "Keeps the subscription", extra: { passRate: 0.7 } },
      { id: "sub", kind: "offer", label: "Monthly blade subscription (recurring profit)", extra: { conversionRate: 0.9, price: 900, monthlyPrice: 900, recurringRate: 1, churnRate: 0.05, unitCost: 250 } },
    ],
    edges: [["t", "lp"], ["lp", "starter"], ["starter", "keep"], ["keep", "sub"]],
  },
  {
    key: "golden-printer", name: "Printer & ink \u2014 cheap printer, costly cartridges", category: "Golden Examples",
    blurb: "The printer is sold at or below cost to get it onto your desk — the hardware is the loss leader. Then the ink, bought again and again at an eye-watering margin and locked to that specific printer, is where the real money is made for years. The device is a Trojan horse for the consumable. Steal it when your product needs refills, cartridges, pods, or parts: price the base unit to win the placement, and let the reorders be the business.",
    nodes: [
      { id: "t", kind: "traffic", label: "Retail + online", extra: { visitors: 12000, costPerVisitor: 40 } },
      { id: "buy", kind: "step", label: "Buys the printer", extra: { passRate: 0.3 } },
      { id: "printer", kind: "offer", label: "Cheap printer (sold at a loss)", extra: { conversionRate: 0.8, price: 5900, unitCost: 8000 } },
      { id: "out", kind: "step", label: "Runs out of ink", extra: { passRate: 0.9 } },
      { id: "ink", kind: "offer", label: "Ink cartridges, again & again (profit engine)", extra: { conversionRate: 0.85, price: 3500, unitCost: 300 } },
    ],
    edges: [["t", "buy"], ["buy", "printer"], ["printer", "out"], ["out", "ink"]],
  },
  {
    key: "golden-prime", name: "Amazon Prime \u2014 membership that drives spend", category: "Golden Examples",
    blurb: "Prime loses money on the free shipping and the video library taken on their own — those perks cost more than the yearly fee covers. But Prime members buy roughly twice as much, twice as often, as non-members: the membership removes every reason to hesitate at checkout. The repeat spending it unlocks — not the fee — is the whole point. Steal it: sometimes the offer’s job isn’t to profit directly but to change behaviour, so the profit shows up in how much more the customer buys everywhere else.",
    nodes: [
      { id: "t", kind: "traffic", label: "Shoppers everywhere", extra: { visitors: 40000, costPerVisitor: 60 } },
      { id: "join", kind: "step", label: "Signs up for Prime", extra: { passRate: 0.25 } },
      { id: "prime", kind: "offer", label: "Prime membership (loses money on shipping)", extra: { conversionRate: 0.9, price: 13900, unitCost: 20000 } },
      { id: "shop", kind: "step", label: "Buys more, more often", extra: { passRate: 0.8 } },
      { id: "repeat", kind: "offer", label: "Repeat purchases (the profit engine)", extra: { conversionRate: 0.95, price: 60000, unitCost: 42000 } },
    ],
    edges: [["t", "join"], ["join", "prime"], ["prime", "shop"], ["shop", "repeat"]],
  },
  {
    key: "golden-console", name: "Game console \u2014 sold at a loss, games make it back", category: "Golden Examples",
    blurb: "The console ships below cost to win a spot under the TV — every unit sold is a loss the maker takes knowingly. Then the games (a royalty on every copy, high margin) and the online subscription (recurring, for years) more than pay it back over the console’s five-to-seven-year life. The hardware is a platform play, not a product sale. Steal it when owning the customer’s platform unlocks a stream of software, content, or fees behind it.",
    nodes: [
      { id: "t", kind: "traffic", label: "Launch demand + ads", extra: { visitors: 25000, costPerVisitor: 100 } },
      { id: "buy", kind: "step", label: "Buys the console", extra: { passRate: 0.35 } },
      { id: "console", kind: "offer", label: "Console sold at a loss", extra: { conversionRate: 0.8, price: 49900, unitCost: 55000 } },
      { id: "play", kind: "step", label: "Buys games + goes online", extra: { passRate: 0.9 } },
      { id: "games", kind: "offer", label: "Games (high margin)", extra: { conversionRate: 0.85, price: 21000, unitCost: 4500 } },
      { id: "sub", kind: "step", label: "Subscribes for online play", extra: { passRate: 0.6 } },
      { id: "online", kind: "offer", label: "Online subscription (recurring profit)", extra: { conversionRate: 0.7, price: 800, monthlyPrice: 800, recurringRate: 1, churnRate: 0.04, unitCost: 100 } },
    ],
    edges: [["t", "buy"], ["buy", "console"], ["console", "play"], ["play", "games"], ["games", "sub"], ["sub", "online"]],
  },
  {
    key: "golden-planetfitness", name: "Planet Fitness \u2014 $10/mo bait, upgrades pay", category: "Golden Examples",
    blurb: "The $10/mo membership barely covers the cost of serving a member who actually shows up. The profit comes from two places: the Black Card upgrade at roughly double the price, and the large majority of members who pay every month and rarely come in — a full gym would lose money. The cheap tier exists to enrol as many people as possible, then the economics do the rest. Steal the two-tier shape: a fear-free entry price to maximise sign-ups, and a premium upgrade that carries the margin.",
    nodes: [
      { id: "t", kind: "traffic", label: "Local + New-Year ads", extra: { visitors: 18000, costPerVisitor: 35 } },
      { id: "join", kind: "step", label: "Signs up cheap", extra: { passRate: 0.4 } },
      { id: "base", kind: "offer", label: "$10/mo membership (loss-leader price)", extra: { conversionRate: 0.9, price: 1000, monthlyPrice: 1000, recurringRate: 1, churnRate: 0.05, unitCost: 1200 } },
      { id: "up", kind: "step", label: "Upgrades to Black Card", extra: { passRate: 0.5 } },
      { id: "black", kind: "offer", label: "Black Card upgrade (the profit)", extra: { conversionRate: 0.8, price: 2500, monthlyPrice: 2500, recurringRate: 1, churnRate: 0.04, unitCost: 300 } },
    ],
    edges: [["t", "join"], ["join", "base"], ["base", "up"], ["up", "black"]],
  },
  {
    key: "golden-streaming", name: "Streaming \u2014 cheap trial \u2192 monthly subscription", category: "Golden Examples",
    blurb: "A $1 promo month or a free trial costs more to serve than it earns — deliberately underwater, to remove every reason not to try. Once a show becomes part of someone’s week, cancelling feels like a loss, and the monthly subscription runs quietly for years. The trial buys a habit; the habit pays the bill. Steal it: discount the first period hard to get someone in the door, then let the ongoing value — and the friction of leaving — keep them.",
    nodes: [
      { id: "t", kind: "traffic", label: "Ads + word of mouth", extra: { visitors: 50000, costPerVisitor: 40 } },
      { id: "trial", kind: "step", label: "Starts the promo month", extra: { passRate: 0.3 } },
      { id: "promo", kind: "offer", label: "$1 first month (loss leader)", extra: { conversionRate: 0.95, price: 99, unitCost: 500 } },
      { id: "keep", kind: "step", label: "Keeps the subscription", extra: { passRate: 0.6 } },
      { id: "sub", kind: "offer", label: "Monthly subscription (recurring profit)", extra: { conversionRate: 0.9, price: 1599, monthlyPrice: 1599, recurringRate: 1, churnRate: 0.04, unitCost: 400 } },
    ],
    edges: [["t", "trial"], ["trial", "promo"], ["promo", "keep"], ["keep", "sub"]],
  },
  {
    key: "golden-casino", name: "Las Vegas \u2014 cheap rooms, the floor pays", category: "Golden Examples",
    blurb: "The $89 room, the cheap buffet, the free show — all priced below cost to get you through the door and keep you on property. The casino floor is the profit engine; every other amenity exists to route you past it and keep you nearby. Nothing is a loss by accident — each subsidised perk is buying time near the thing that actually makes money. Steal it when you have one high-margin core: make everything around it cheap or free if it increases exposure to that core.",
    nodes: [
      { id: "t", kind: "traffic", label: "Tourists + comps", extra: { visitors: 30000, costPerVisitor: 50 } },
      { id: "come", kind: "step", label: "Comes for the cheap room/buffet", extra: { passRate: 0.5 } },
      { id: "room", kind: "offer", label: "Cheap room + buffet (loss leaders)", extra: { conversionRate: 0.9, price: 8900, unitCost: 11000 } },
      { id: "floor", kind: "step", label: "Hits the casino floor", extra: { passRate: 0.75 } },
      { id: "gaming", kind: "offer", label: "Gaming floor (the profit engine)", extra: { conversionRate: 0.7, price: 30000, unitCost: 5000 } },
    ],
    edges: [["t", "come"], ["come", "room"], ["room", "floor"], ["floor", "gaming"]],
  },
  {
    key: "golden-freemium", name: "Freemium SaaS \u2014 free tool \u2192 paid \u2192 enterprise", category: "Golden Examples",
    blurb: "The free tool and the cheap starter plan cost more in hosting and support than they bring in — they exist to get individuals and teams hooked and spreading the product internally. The recurring Pro plan and the enterprise deals behind them, sold once the tool is already load-bearing, are where the profit sits. Adoption first, monetisation second. Steal it: give the core away to win usage, then charge for the scale, seats, and controls that serious users can’t do without.",
    nodes: [
      { id: "t", kind: "traffic", label: "Content + ads", extra: { visitors: 40000, costPerVisitor: 90 } },
      { id: "free", kind: "step", label: "Signs up for the free tool", extra: { passRate: 0.2 } },
      { id: "starter", kind: "offer", label: "Starter plan (thin \u2014 acquires at a loss)", extra: { conversionRate: 0.3, price: 2000, monthlyPrice: 2000, recurringRate: 1, churnRate: 0.06, unitCost: 2500 } },
      { id: "grow", kind: "step", label: "Grows, upgrades", extra: { passRate: 0.4 } },
      { id: "pro", kind: "offer", label: "Pro plan (recurring core)", extra: { conversionRate: 0.5, price: 80000, monthlyPrice: 80000, recurringRate: 1, churnRate: 0.03, unitCost: 8000 } },
      { id: "scale", kind: "step", label: "Scales to enterprise", extra: { passRate: 0.15 } },
      { id: "ent", kind: "offer", label: "Enterprise (profit engine)", extra: { conversionRate: 0.4, price: 500000, unitCost: 90000 } },
    ],
    edges: [["t", "free"], ["free", "starter"], ["starter", "grow"], ["grow", "pro"], ["pro", "scale"], ["scale", "ent"]],
  },
  {
    key: "golden-coach", name: "Coach's value ladder (steal this one)", category: "Golden Examples",
    blurb: "The one to actually copy for a solo business: a free lead magnet to collect the right people, a $27 tripwire that turns a follower into a buyer (and usually acquires them at a small loss once you count ads), your core program as the main offer, and a monthly membership behind it that quietly makes the real profit. Each step earns the right to the next and filters to your most committed clients. Swap in your own numbers on the canvas and watch the front run thin while the membership carries the P&L — that’s the whole strategy in four rungs.",
    nodes: [
      { id: "t", kind: "traffic", label: "Content + ads", extra: { visitors: 15000, costPerVisitor: 100 } },
      { id: "lm", kind: "step", label: "Grabs the free lead magnet", extra: { passRate: 0.25 } },
      { id: "trip", kind: "offer", label: "$27 tripwire (acquires at a loss)", extra: { conversionRate: 0.08, price: 2700, unitCost: 4000 } },
      { id: "want", kind: "step", label: "Loves it, wants more", extra: { passRate: 0.5 } },
      { id: "core", kind: "offer", label: "Core program (the core offer)", extra: { conversionRate: 0.2, price: 99700, unitCost: 15000 } },
      { id: "ongoing", kind: "step", label: "Wants ongoing support", extra: { passRate: 0.3 } },
      { id: "cont", kind: "offer", label: "Monthly membership (continuity profit)", extra: { conversionRate: 0.4, price: 9700, monthlyPrice: 9700, recurringRate: 1, churnRate: 0.06, unitCost: 1500 } },
    ],
    edges: [["t", "lm"], ["lm", "trip"], ["trip", "want"], ["want", "core"], ["core", "ongoing"], ["ongoing", "cont"]],
  },
  {
    key: "golden-kindle", name: "Kindle \u2014 device at a loss, content forever", category: "Golden Examples",
    blurb: "Sell the e-reader at or below cost to put a bookstore in someone’s hand and lock them to your format. Then the ebooks, audiobooks, and subscriptions they buy for years — each a high-margin digital sale with no reprint cost — are the profit. The device isn’t the product; it’s the doorway to a lifetime of content purchases. Steal it whenever the hardware’s real value is the ecosystem it opens: subsidise the doorway, earn on what comes through it.",
    nodes: [
      { id: "t", kind: "traffic", label: "Store shoppers + ads", extra: { visitors: 30000, costPerVisitor: 50 } },
      { id: "buy", kind: "step", label: "Buys the e-reader", extra: { passRate: 0.2 } },
      { id: "device", kind: "offer", label: "E-reader near/below cost (loss leader)", extra: { conversionRate: 0.85, price: 9900, unitCost: 12000 } },
      { id: "fill", kind: "step", label: "Fills it with books", extra: { passRate: 0.9 } },
      { id: "books", kind: "offer", label: "Ebooks & subscriptions, forever (profit engine)", extra: { conversionRate: 0.8, price: 4000, unitCost: 800 } },
    ],
    edges: [["t", "buy"], ["buy", "device"], ["device", "fill"], ["fill", "books"]],
  },
  {
    key: "golden-ikea", name: "IKEA \u2014 $1 hotdog gets you in the door", category: "Golden Examples",
    blurb: "The café loses money on the $1 hotdog and near-free meatballs on purpose — cheap food pulls families in and, more importantly, keeps them in the store longer. The longer the visit, the more furniture they browse and buy, and the furniture is where the margin lives. A tiny loss on lunch buys hours of exposure to the real catalogue. Steal it: a cheap, almost-loss item at the entrance can be worth far more than its price if it lengthens the visit to your profitable offers.",
    nodes: [
      { id: "t", kind: "traffic", label: "Weekend shoppers", extra: { visitors: 25000, costPerVisitor: 30 } },
      { id: "food", kind: "step", label: "Comes for the cheap food", extra: { passRate: 0.5 } },
      { id: "hotdog", kind: "offer", label: "$1 hotdog / cheap meatballs (loss leader)", extra: { conversionRate: 0.7, price: 100, unitCost: 180 } },
      { id: "walk", kind: "step", label: "Walks the whole showroom", extra: { passRate: 0.6 } },
      { id: "furniture", kind: "offer", label: "Furniture & housewares (the margin)", extra: { conversionRate: 0.4, price: 15000, unitCost: 7000 } },
    ],
    edges: [["t", "food"], ["food", "hotdog"], ["hotdog", "walk"], ["walk", "furniture"]],
  },
  {
    key: "golden-f2p", name: "Free-to-play game \u2014 free download, whales pay", category: "Golden Examples",
    blurb: "The game is free to download and the first small purchase is subsidised — most players will never spend a cent, and that’s fine. The profit comes from a small share who buy again and again (the “whales”), whose spend more than covers everyone who plays for free. A huge free top of funnel exists to find that paying few. Steal it when serving extra users is cheap: let the many use it free to grow reach, and design a clear path for the committed few to spend deeply.",
    nodes: [
      { id: "t", kind: "traffic", label: "App store + ads", extra: { visitors: 100000, costPerVisitor: 25 } },
      { id: "install", kind: "step", label: "Installs free, starts playing", extra: { passRate: 0.35 } },
      { id: "starter", kind: "offer", label: "$1.99 starter pack (subsidised, at a loss)", extra: { conversionRate: 0.05, price: 199, unitCost: 400 } },
      { id: "hooked", kind: "step", label: "Gets hooked", extra: { passRate: 0.4 } },
      { id: "iap", kind: "offer", label: "In-app purchases / whales (profit engine)", extra: { conversionRate: 0.3, price: 5000, unitCost: 500 } },
    ],
    edges: [["t", "install"], ["install", "starter"], ["starter", "hooked"], ["hooked", "iap"]],
  },
  {
    key: "golden-airline", name: "Budget airline \u2014 cheap fare, fees make it", category: "Golden Examples",
    blurb: "The rock-bottom headline fare barely covers the seat — sometimes not even that — because its only job is to win the price comparison and get the booking. Bags, seat selection, priority boarding, upgrades, and especially the co-branded credit card are where a budget airline actually makes its money. The advertised price is the hook; the add-ons are the business. Steal it: lead with the lowest possible entry price to win the click, then let optional upgrades and attachments carry the margin.",
    nodes: [
      { id: "t", kind: "traffic", label: "Fare search + ads", extra: { visitors: 40000, costPerVisitor: 40 } },
      { id: "book", kind: "step", label: "Books the cheap fare", extra: { passRate: 0.3 } },
      { id: "fare", kind: "offer", label: "Rock-bottom base fare (at a loss)", extra: { conversionRate: 0.6, price: 8900, unitCost: 10500 } },
      { id: "addons", kind: "step", label: "Adds bags, seats, extras", extra: { passRate: 0.7 } },
      { id: "ancillary", kind: "offer", label: "Bags, seats & upgrades (the margin)", extra: { conversionRate: 0.8, price: 6000, unitCost: 800 } },
      { id: "card", kind: "step", label: "Gets the airline credit card", extra: { passRate: 0.15 } },
      { id: "loyalty", kind: "offer", label: "Co-brand card & loyalty (profit engine)", extra: { conversionRate: 0.5, price: 9500, unitCost: 1000 } },
    ],
    edges: [["t", "book"], ["book", "fare"], ["fare", "addons"], ["addons", "ancillary"], ["ancillary", "card"], ["card", "loyalty"]],
  },
  {
    key: "golden-bank", name: "Free checking \u2014 the account is bait", category: "Golden Examples",
    blurb: "A “free” checking account genuinely costs the bank money to run — there’s no fee to the customer at all. It pays off in the background: interchange every time you swipe the card, interest earned on the balance you leave sitting there, the occasional overdraft fee, and above all the credit cards, loans, and mortgages they cross-sell once they hold the relationship. The free account is a foot in the door to a lifetime of financial products. Steal it: give away the entry relationship, then earn on everything you’re positioned to sell the customer later.",
    nodes: [
      { id: "t", kind: "traffic", label: "Ads + branch", extra: { visitors: 30000, costPerVisitor: 60 } },
      { id: "open", kind: "step", label: "Opens a free account", extra: { passRate: 0.3 } },
      { id: "acct", kind: "offer", label: "Free checking (costs money to run, loss leader)", extra: { conversionRate: 0.9, price: 500, unitCost: 1200 } },
      { id: "use", kind: "step", label: "Uses cards, keeps a balance", extra: { passRate: 0.8 } },
      { id: "fees", kind: "offer", label: "Interchange, interest & fees (the margin)", extra: { conversionRate: 0.85, price: 12000, unitCost: 2000 } },
      { id: "credit", kind: "step", label: "Takes the credit card / loan", extra: { passRate: 0.25 } },
      { id: "lending", kind: "offer", label: "Credit cards & loans (the real profit)", extra: { conversionRate: 0.5, price: 40000, unitCost: 8000 } },
    ],
    edges: [["t", "open"], ["open", "acct"], ["acct", "use"], ["use", "fees"], ["fees", "credit"], ["credit", "lending"]],
  },
  {
    key: "golden-rideshare", name: "Ride-share \u2014 subsidised rides, then habit", category: "Golden Examples",
    blurb: "The first rides are discounted below cost — subsidised by the company — to break the taxi habit and make the app your default. Once opening it is a reflex, the repeat rides at full price and the perks membership behind them turn a profit that dwarfs the early subsidy. They’re buying a habit up front and collecting on it for years. Steal it: if switching costs and defaults matter in your market, spend to win the habit early, then earn on the repeat once you’re the obvious choice.",
    nodes: [
      { id: "t", kind: "traffic", label: "App installs + promos", extra: { visitors: 60000, costPerVisitor: 30 } },
      { id: "first", kind: "step", label: "Takes a subsidised first ride", extra: { passRate: 0.3 } },
      { id: "promo", kind: "offer", label: "Discounted first rides (subsidised, at a loss)", extra: { conversionRate: 0.7, price: 800, unitCost: 1400 } },
      { id: "regular", kind: "step", label: "Becomes a regular", extra: { passRate: 0.5 } },
      { id: "rides", kind: "offer", label: "Repeat rides (the margin)", extra: { conversionRate: 0.8, price: 15000, unitCost: 11000 } },
      { id: "perks", kind: "step", label: "Subscribes for perks", extra: { passRate: 0.2 } },
      { id: "membership", kind: "offer", label: "Perks membership (recurring profit)", extra: { conversionRate: 0.5, price: 999, monthlyPrice: 999, recurringRate: 1, churnRate: 0.05, unitCost: 100 } },
    ],
    edges: [["t", "first"], ["first", "promo"], ["promo", "regular"], ["regular", "rides"], ["rides", "perks"], ["perks", "membership"]],
  },
  {
    key: "golden-cardealer", name: "Car dealership \u2014 car near invoice, service pays", category: "Golden Examples",
    blurb: "The car itself is sold near invoice — the salesperson makes almost nothing on the metal, and the haggling everyone braces for is over a thin slice. The real profit is in the finance and insurance office (the loan markup, the extended warranty, the add-ons) and in years of service, parts, and repairs afterward. The sale is the entry point; the ownership relationship is the business. Steal it: when the first transaction is low-margin and competitive, build your profit into the financing, the guarantees, and the long tail of service that follows.",
    nodes: [
      { id: "t", kind: "traffic", label: "Lot + online listings", extra: { visitors: 8000, costPerVisitor: 150 } },
      { id: "buy", kind: "step", label: "Buys the car", extra: { passRate: 0.15 } },
      { id: "car", kind: "offer", label: "Car sold near invoice (thin, at a loss)", extra: { conversionRate: 0.6, price: 3000000, unitCost: 3050000 } },
      { id: "finance", kind: "step", label: "Finances + adds a service plan", extra: { passRate: 0.75 } },
      { id: "backend", kind: "offer", label: "Financing, warranty & service (profit engine)", extra: { conversionRate: 0.7, price: 400000, unitCost: 60000 } },
    ],
    edges: [["t", "buy"], ["buy", "car"], ["car", "finance"], ["finance", "backend"]],
  },
  {
    key: "leadgen", name: "Lead-gen (opt-in \u2192 offer)", category: "Lead Generation",
    blurb: "Cold traffic to a landing page, then a tripwire offer.",
    nodes: [
      { id: "t", kind: "traffic", label: "Facebook Ads", extra: { visitors: 5000, costPerVisitor: 150 } },
      { id: "lp", kind: "step", label: "Landing Page", extra: { passRate: 0.35 } },
      { id: "of", kind: "offer", label: "Tripwire Offer", extra: { conversionRate: 0.06, price: 2700 } },
    ],
    edges: [["t", "lp"], ["lp", "of"]],
  },
  {
    key: "webinar", name: "Webinar funnel", category: "Sales & Booking",
    blurb: "Registration \u2192 show-up \u2192 pitch \u2192 high-ticket offer.",
    nodes: [
      { id: "t", kind: "traffic", label: "YouTube Ads", extra: { visitors: 8000, costPerVisitor: 120 } },
      { id: "reg", kind: "step", label: "Registration", extra: { passRate: 0.4 } },
      { id: "show", kind: "step", label: "Showed Up", extra: { passRate: 0.5 } },
      { id: "of", kind: "offer", label: "Core Program", extra: { conversionRate: 0.05, price: 99700 } },
    ],
    edges: [["t", "reg"], ["reg", "show"], ["show", "of"]],
  },
  {
    key: "ecom", name: "E-commerce (bump + upsell)", category: "Sales & Booking",
    blurb: "Product page to cart to checkout with an order bump.",
    nodes: [
      { id: "t", kind: "traffic", label: "Instagram Ads", extra: { visitors: 10000, costPerVisitor: 90 } },
      { id: "pdp", kind: "step", label: "Product Page", extra: { passRate: 0.3 } },
      { id: "cart", kind: "step", label: "Add to Cart", extra: { passRate: 0.55 } },
      { id: "co", kind: "offer", label: "Checkout", extra: { conversionRate: 0.6, price: 4900, orderBumpRate: 0.25, orderBumpPrice: 1900 } },
    ],
    edges: [["t", "pdp"], ["pdp", "cart"], ["cart", "co"]],
  },
  {
    key: "saas", name: "SaaS free trial", category: "Recurring Revenue",
    blurb: "Signup \u2192 activation \u2192 paid conversion (recurring).",
    nodes: [
      { id: "t", kind: "traffic", label: "Google Ads", extra: { visitors: 6000, costPerVisitor: 300 } },
      { id: "su", kind: "step", label: "Free Signup", extra: { passRate: 0.25 } },
      { id: "act", kind: "step", label: "Activated", extra: { passRate: 0.6 } },
      { id: "of", kind: "offer", label: "Paid Plan", extra: { conversionRate: 0.2, price: 4900, monthlyPrice: 4900, recurringRate: 1, churnRate: 0.05 } },
    ],
    edges: [["t", "su"], ["su", "act"], ["act", "of"]],
  },
  {
    key: "course", name: "Course launch", category: "Sales & Booking",
    blurb: "VSL to a cart-open enrollment window.",
    nodes: [
      { id: "t", kind: "traffic", label: "Facebook Ads", extra: { visitors: 7000, costPerVisitor: 140 } },
      { id: "vsl", kind: "step", label: "VSL Page", extra: { passRate: 0.32 } },
      { id: "cart", kind: "step", label: "Cart Open", extra: { passRate: 0.45 } },
      { id: "of", kind: "offer", label: "Course Enrollment", extra: { conversionRate: 0.08, price: 49700, orderBumpRate: 0.2, orderBumpPrice: 2700 } },
    ],
    edges: [["t", "vsl"], ["vsl", "cart"], ["cart", "of"]],
  },
  {
    key: "highticket", name: "High-ticket sales", category: "Sales & Booking",
    blurb: "Application to a booked call to a closed offer.",
    nodes: [
      { id: "t", kind: "traffic", label: "LinkedIn Ads", extra: { visitors: 3000, costPerVisitor: 400 } },
      { id: "app", kind: "step", label: "Application Page", extra: { passRate: 0.22 } },
      { id: "call", kind: "step", label: "Strategy Call", extra: { passRate: 0.5 } },
      { id: "of", kind: "offer", label: "1:1 Program", extra: { conversionRate: 0.35, price: 500000 } },
    ],
    edges: [["t", "app"], ["app", "call"], ["call", "of"]],
  },
  {
    key: "booking", name: "Appointment booking", category: "Sales & Booking",
    blurb: "Landing page to a booked, paid consultation.",
    nodes: [
      { id: "t", kind: "traffic", label: "Google Ads", extra: { visitors: 4000, costPerVisitor: 180 } },
      { id: "lp", kind: "step", label: "Landing Page", extra: { passRate: 0.4 } },
      { id: "book", kind: "step", label: "Booking Page", extra: { passRate: 0.5 } },
      { id: "of", kind: "offer", label: "Paid Consultation", extra: { conversionRate: 0.6, price: 15000 } },
    ],
    edges: [["t", "lp"], ["lp", "book"], ["book", "of"]],
  },
  {
    key: "membership", name: "Membership", category: "Recurring Revenue",
    blurb: "Sales page straight into a recurring membership.",
    nodes: [
      { id: "t", kind: "traffic", label: "Instagram Ads", extra: { visitors: 6000, costPerVisitor: 110 } },
      { id: "sp", kind: "step", label: "Sales Page", extra: { passRate: 0.38 } },
      { id: "of", kind: "offer", label: "Membership", extra: { conversionRate: 0.1, price: 3900, monthlyPrice: 3900, recurringRate: 1, churnRate: 0.06 } },
    ],
    edges: [["t", "sp"], ["sp", "of"]],
  },
  {
    key: "event", name: "Event", category: "Events & Ops",
    blurb: "Event page to registration to ticket purchase.",
    nodes: [
      { id: "t", kind: "traffic", label: "Facebook Ads", extra: { visitors: 5000, costPerVisitor: 100 } },
      { id: "ep", kind: "step", label: "Event Page", extra: { passRate: 0.45 } },
      { id: "reg", kind: "step", label: "Registration", extra: { passRate: 0.55 } },
      { id: "of", kind: "offer", label: "Event Ticket", extra: { conversionRate: 0.3, price: 9900 } },
    ],
    edges: [["t", "ep"], ["ep", "reg"], ["reg", "of"]],
  },
  {
    key: "recruit", name: "Recruitment / application", category: "Events & Ops",
    blurb: "Careers page to application to hire — no price, just flow.",
    nodes: [
      { id: "t", kind: "traffic", label: "LinkedIn Ads", extra: { visitors: 2000, costPerVisitor: 250 } },
      { id: "lp", kind: "step", label: "Careers Page", extra: { passRate: 0.5 } },
      { id: "app", kind: "step", label: "Application Form", extra: { passRate: 0.3 } },
      { id: "of", kind: "offer", label: "Hired", extra: { conversionRate: 0.15, price: 0 } },
    ],
    edges: [["t", "lp"], ["lp", "app"], ["app", "of"]],
  },
  {
    key: "local", name: "Local business", category: "Lead Generation",
    blurb: "Local search traffic to a booked, paid service call.",
    nodes: [
      { id: "t", kind: "traffic", label: "Google Ads", extra: { visitors: 2500, costPerVisitor: 220 } },
      { id: "lp", kind: "step", label: "Landing Page", extra: { passRate: 0.42 } },
      { id: "call", kind: "step", label: "Phone Call", extra: { passRate: 0.6 } },
      { id: "of", kind: "offer", label: "Service Booked", extra: { conversionRate: 0.5, price: 25000 } },
    ],
    edges: [["t", "lp"], ["lp", "call"], ["call", "of"]],
  },
  {
    key: "agency", name: "Agency client", category: "Recurring Revenue",
    blurb: "Case studies to a discovery call to a signed retainer.",
    nodes: [
      { id: "t", kind: "traffic", label: "LinkedIn Ads", extra: { visitors: 1500, costPerVisitor: 500 } },
      { id: "lp", kind: "step", label: "Case Studies Page", extra: { passRate: 0.35 } },
      { id: "call", kind: "step", label: "Discovery Call", extra: { passRate: 0.4 } },
      { id: "of", kind: "offer", label: "Retainer Signed", extra: { conversionRate: 0.3, price: 300000, monthlyPrice: 300000, recurringRate: 1, churnRate: 0.08 } },
    ],
    edges: [["t", "lp"], ["lp", "call"], ["call", "of"]],
  },
];

export function buildTemplate(tpl: Template): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = tpl.nodes.map((n, i) => ({
    id: n.id, type: "gb", position: { x: 60 + i * 220, y: 160 },
    data: { ...defaultData(n.kind, n.label), ...(n.extra ?? {}) },
  }));
  const edges: Edge[] = tpl.edges.map(([a, b]) => ({ id: `e-${a}-${b}`, source: a, target: b }));
  return { nodes, edges };
}

// Business Playbooks: broader than a funnel template — picking one seeds the
// canvas AND the business-definition workbook AND a starter checklist, so a
// user starting from "High-ticket coaching" gets a program to fill in, not
// just three boxes on a canvas. Deliberately reuses a funnel template for the
// canvas half rather than inventing a second node data set to maintain.
export type Playbook = {
  key: string; name: string; blurb: string;
  templateKey: string; // one of TEMPLATES[].key
  definition: Partial<BusinessDefinition>;
  checklist: string[];
};
export const PLAYBOOKS: Playbook[] = [
  {
    key: "pb-highticket", name: "High-Ticket Coaching", templateKey: "highticket",
    blurb: "Application → call → close, for a premium 1:1 or group program.",
    definition: {
      whoServe: "People who need a fast, guided result and will pay for direct access to you.",
      mainOffer: "A high-ticket 1:1 or small-group coaching program sold on a strategy call.",
      mainConstraint: "Sales capacity — growth is capped by how many calls you can run and close.",
    },
    checklist: ["Application form live and qualifying", "Call script and objection responses written", "Calendar booking + reminder sequence wired", "Payment plan and contract ready", "First 5 client case studies documented"],
  },
  {
    key: "pb-ecom", name: "E-Commerce Upsell", templateKey: "ecom",
    blurb: "Product page → cart → checkout with an order bump, built to raise AOV.",
    definition: {
      whoServe: "Buyers already searching for this product category, not people who need educating.",
      mainOffer: "A core product with a related order bump at checkout.",
      mainConstraint: "Margin after ad spend — AOV and repeat purchase rate decide if this scales.",
    },
    checklist: ["Product photos and copy finalized", "Order bump priced and tested", "Checkout page loads under 3s on mobile", "Post-purchase upsell or thank-you offer live", "Return/refund policy published"],
  },
  {
    key: "pb-webinar", name: "Webinar Launch", templateKey: "webinar",
    blurb: "Registration → show-up → pitch, for launching an offer to a cold list.",
    definition: {
      whoServe: "People who need to be educated and warmed up before they'll buy.",
      mainOffer: "A mid-to-high ticket offer pitched at the end of a live or evergreen webinar.",
      mainConstraint: "Show-up rate — registration is cheap, getting people to actually attend is not.",
    },
    checklist: ["Webinar slides and pitch scripted", "Reminder/replay email sequence written", "Registration page tested end-to-end", "Tech run-through completed (audio/video/screen share)", "Offer cart and payment link ready before go-live"],
  },
  {
    key: "pb-leadgen", name: "Lead Generation", templateKey: "leadgen",
    blurb: "Cold traffic → landing page → tripwire offer, for building a buyer list cheaply.",
    definition: {
      whoServe: "Cold audience that doesn't know you yet — the goal is a first, low-risk purchase.",
      mainOffer: "A low-priced tripwire offer that turns a stranger into a buyer.",
      mainConstraint: "Cost per lead — the whole model depends on paying less to acquire than a lead is worth.",
    },
    checklist: ["Landing page built and tracking installed", "Tripwire offer priced to convert, not to profit", "Follow-up email sequence for non-buyers written", "Ad creative and targeting set up", "Backend offer ready for buyers to ascend into"],
  },
  {
    key: "pb-membership", name: "Recurring Membership", templateKey: "membership",
    blurb: "Sales page → recurring membership, for building predictable monthly revenue.",
    definition: {
      whoServe: "People who want ongoing access or community, not a one-time transaction.",
      mainOffer: "A recurring membership with clear, repeated value delivered every period.",
      mainConstraint: "Churn — growth is meaningless if members leave as fast as they join.",
    },
    checklist: ["Member onboarding sequence built", "Content/community delivery cadence set", "Churn-prevention (win-back, pause options) planned", "Billing and dunning (failed-payment recovery) tested", "First-30-days retention milestone defined"],
  },
];

// Turns free-text workbook answers into a starting playbook, so the canvas
// can be generated instead of picked — deliberately dumb keyword matching
// (first pattern that hits wins), same spirit as BRAND_FALLBACK above.
// Never guesses when the user hasn't written anything worth reading yet.
const PLAYBOOK_INFERENCE: { re: RegExp; key: string }[] = [
  { re: /(membership|subscription|community)/i, key: "pb-membership" },
  { re: /(webinar|masterclass|live training|workshop)/i, key: "pb-webinar" },
  { re: /(shop|store|product|e-?commerce|order bump|checkout)/i, key: "pb-ecom" },
  { re: /(coach|consult|1:1|strategy call|done-for-you|agency)/i, key: "pb-highticket" },
];
export function inferPlaybook(definition: BusinessDefinition): Playbook | null {
  const text = `${definition.mainOffer ?? ""} ${definition.whoServe ?? ""}`.trim();
  if (!text) return null;
  for (const { re, key } of PLAYBOOK_INFERENCE) if (re.test(text)) return PLAYBOOKS.find((p) => p.key === key) ?? null;
  return PLAYBOOKS.find((p) => p.key === "pb-leadgen") ?? null;
}
