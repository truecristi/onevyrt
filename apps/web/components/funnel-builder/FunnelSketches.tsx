/**
 * Professional SVG sketches of funnel pages and templates.
 * Styled to match ClickFunnels/Leadpages aesthetic — clean, modern, scalable.
 */

export function OptinPageSketch() {
  return (
    <svg viewBox="0 0 400 600" className="funnel-sketch" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="400" height="600" fill="var(--ds-surface)" />

      {/* Header bar */}
      <rect width="400" height="60" fill="var(--ds-brand)" />
      <text x="20" y="40" fontSize="14" fill="white" fontWeight="600">Brand Logo</text>

      {/* Hero section */}
      <rect y="60" width="400" height="140" fill="var(--ds-bg-subtle)" />
      <text x="20" y="100" fontSize="24" fontWeight="700" fill="var(--ds-text-primary)" className="funnel-sketch-headline">
        Discover Your Secret to Growth
      </text>
      <text x="20" y="160" fontSize="14" fill="var(--ds-text-secondary)" className="funnel-sketch-subheadline">
        Join 500+ coaches who scale their business
      </text>

      {/* Form section */}
      <rect y="200" width="400" height="240" fill="var(--ds-surface)" />

      {/* Form title */}
      <text x="20" y="230" fontSize="18" fontWeight="600" fill="var(--ds-text-primary)">
        Get Instant Access
      </text>

      {/* Name field */}
      <rect x="20" y="250" width="360" height="40" rx="4" fill="var(--ds-surface-subtle)" stroke="var(--ds-border-default)" strokeWidth="1" />
      <text x="30" y="278" fontSize="13" fill="var(--ds-text-tertiary)">Your Name</text>

      {/* Email field */}
      <rect x="20" y="300" width="360" height="40" rx="4" fill="var(--ds-surface-subtle)" stroke="var(--ds-border-default)" strokeWidth="1" />
      <text x="30" y="328" fontSize="13" fill="var(--ds-text-tertiary)">Your Email</text>

      {/* CTA Button */}
      <rect x="20" y="350" width="360" height="50" rx="4" fill="var(--ds-brand-solid)" />
      <text x="200" y="381" fontSize="16" fontWeight="600" fill="white" textAnchor="middle">
        Get Access Now →
      </text>

      {/* Trust indicators */}
      <text x="20" y="430" fontSize="11" fill="var(--ds-text-tertiary)">✓ No credit card required</text>
      <text x="20" y="450" fontSize="11" fill="var(--ds-text-tertiary)">✓ Instant access to all materials</text>

      {/* Footer */}
      <rect y="540" width="400" height="60" fill="var(--ds-bg-subtle)" />
      <text x="20" y="575" fontSize="11" fill="var(--ds-text-tertiary)">© 2024 Your Company. Privacy Policy</text>
    </svg>
  );
}

export function SalesPageSketch() {
  return (
    <svg viewBox="0 0 400 1000" className="funnel-sketch" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="1000" fill="var(--ds-surface)" />

      {/* Header */}
      <rect width="400" height="50" fill="var(--ds-brand)" />
      <text x="20" y="35" fontSize="12" fill="white" fontWeight="600">LOGO</text>

      {/* Hero/Above the fold */}
      <rect y="50" width="400" height="200" fill="var(--ds-bg-subtle)" />
      <text x="20" y="110" fontSize="22" fontWeight="700" fill="var(--ds-text-primary)">
        The System That Turned
      </text>
      <text x="20" y="140" fontSize="22" fontWeight="700" fill="var(--ds-text-primary)">
        $100K Into $500K
      </text>
      <text x="20" y="170" fontSize="14" fill="var(--ds-text-secondary)">
        Discover how John went from frustrated to scaling
      </text>
      <rect x="20" y="190" width="360" height="45" rx="4" fill="var(--ds-brand-solid)" />
      <text x="200" y="220" fontSize="14" fontWeight="600" fill="white" textAnchor="middle">
        Watch Free Case Study
      </text>

      {/* Pain section */}
      <rect y="250" width="400" height="140" fill="var(--ds-surface)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="20" y="280" fontSize="16" fontWeight="600" fill="var(--ds-text-primary)">
        Are You Stuck In This Loop?
      </text>
      <text x="20" y="310" fontSize="13" fill="var(--ds-text-secondary)">
        ✗ Working 12-hour days without seeing progress
      </text>
      <text x="20" y="335" fontSize="13" fill="var(--ds-text-secondary)">
        ✗ Spending money on ads that don't convert
      </text>
      <text x="20" y="360" fontSize="13" fill="var(--ds-text-secondary)">
        ✗ Feeling like your business owns you
      </text>

      {/* Solution section */}
      <rect y="390" width="400" height="140" fill="var(--ds-bg-subtle)" />
      <text x="20" y="420" fontSize="16" fontWeight="600" fill="var(--ds-text-primary)">
        The ONEVYRT System Solves This In 90 Days
      </text>
      <text x="20" y="450" fontSize="13" fill="var(--ds-text-secondary)">
        ✓ Clear business blueprint that scales
      </text>
      <text x="20" y="475" fontSize="13" fill="var(--ds-text-secondary)">
        ✓ Proven funnel with predictable conversions
      </text>
      <text x="20" y="500" fontSize="13" fill="var(--ds-text-secondary)">
        ✓ Work less, earn more (your coach walks you through it)
      </text>

      {/* Social proof */}
      <rect y="530" width="400" height="80" fill="var(--ds-surface)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="20" y="560" fontSize="14" fontWeight="600" fill="var(--ds-text-primary)">
        Trusted by 2000+ Coaches
      </text>
      <circle cx="50" cy="595" r="12" fill="var(--ds-brand-soft)" />
      <circle cx="100" cy="595" r="12" fill="var(--ds-brand-soft)" />
      <circle cx="150" cy="595" r="12" fill="var(--ds-brand-soft)" />

      {/* CTA */}
      <rect y="610" width="400" height="120" fill="var(--ds-bg-subtle)" />
      <text x="20" y="645" fontSize="18" fontWeight="700" fill="var(--ds-text-primary)">
        Secure Your Spot Today
      </text>
      <text x="20" y="668" fontSize="13" fill="var(--ds-text-secondary)">
        Limited to 10 clients per month
      </text>
      <rect x="20" y="685" width="360" height="50" rx="4" fill="var(--ds-brand-solid)" />
      <text x="200" y="715" fontSize="14" fontWeight="600" fill="white" textAnchor="middle">
        Claim Your Spot ($4,997)
      </text>

      {/* Footer */}
      <rect y="950" width="400" height="50" fill="var(--ds-bg-subtle)" />
      <text x="20" y="980" fontSize="11" fill="var(--ds-text-tertiary)">© 2024 ONEVYRT. All rights reserved.</text>
    </svg>
  );
}

export function CheckoutPageSketch() {
  return (
    <svg viewBox="0 0 400 700" className="funnel-sketch" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="700" fill="var(--ds-surface)" />

      {/* Header */}
      <rect width="400" height="50" fill="var(--ds-surface-subtle)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="20" y="35" fontSize="12" fill="var(--ds-text-primary)" fontWeight="600">LOGO</text>

      {/* Checkout section */}
      <text x="20" y="90" fontSize="20" fontWeight="700" fill="var(--ds-text-primary)">Complete Your Order</text>

      {/* Progress bar */}
      <rect x="20" y="110" width="360" height="4" rx="2" fill="var(--ds-border-subtle)" />
      <rect x="20" y="110" width="270" height="4" rx="2" fill="var(--ds-brand)" />
      <text x="20" y="140" fontSize="12" fill="var(--ds-text-tertiary)">Step 3 of 4: Payment</text>

      {/* Order summary */}
      <rect x="20" y="160" width="360" height="80" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="30" y="185" fontSize="14" fontWeight="600" fill="var(--ds-text-primary)">ONEVYRT Growth Program</text>
      <text x="30" y="210" fontSize="13" fill="var(--ds-text-secondary)">4-stage business transformation + lifetime access</text>
      <text x="360" y="210" fontSize="14" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="end">$4,997</text>
      <line x1="30" y1="230" x2="370" y2="230" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="30" y="250" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)">Total Due Today</text>
      <text x="360" y="250" fontSize="16" fontWeight="700" fill="var(--ds-text-primary)" textAnchor="end">$4,997</text>

      {/* Card input */}
      <text x="20" y="280" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)">Card Details</text>
      <rect x="20" y="295" width="360" height="45" rx="4" fill="var(--ds-surface-subtle)" stroke="var(--ds-border-default)" strokeWidth="1" />
      <text x="30" y="325" fontSize="13" fill="var(--ds-text-tertiary)">1234 1234 1234 1234</text>

      {/* Expiry and CVV */}
      <rect x="20" y="350" width="170" height="45" rx="4" fill="var(--ds-surface-subtle)" stroke="var(--ds-border-default)" strokeWidth="1" />
      <text x="30" y="380" fontSize="13" fill="var(--ds-text-tertiary)">MM/YY</text>

      <rect x="210" y="350" width="170" height="45" rx="4" fill="var(--ds-surface-subtle)" stroke="var(--ds-border-default)" strokeWidth="1" />
      <text x="220" y="380" fontSize="13" fill="var(--ds-text-tertiary)">CVV</text>

      {/* Trust badges */}
      <rect x="20" y="410" width="360" height="50" rx="4" fill="var(--ds-bg-subtle)" />
      <text x="30" y="435" fontSize="12" fill="var(--ds-text-secondary)">🔒 Secure SSL encryption</text>
      <text x="30" y="455" fontSize="12" fill="var(--ds-text-secondary)">✓ Stripe Certified Payment Processing</text>

      {/* CTA */}
      <rect x="20" y="470" width="360" height="55" rx="4" fill="var(--ds-brand-solid)" />
      <text x="200" y="505" fontSize="16" fontWeight="600" fill="white" textAnchor="middle">
        Confirm Payment
      </text>

      {/* Security note */}
      <text x="20" y="560" fontSize="11" fill="var(--ds-text-tertiary)" textAnchor="start">
        Your payment information is secure and encrypted
      </text>

      {/* Money-back guarantee */}
      <rect x="20" y="575" width="360" height="90" rx="4" fill="#e7f6f0" stroke="var(--ds-brand)" strokeWidth="1" />
      <text x="30" y="600" fontSize="13" fontWeight="600" fill="var(--ds-brand)">🛡 60-Day Money-Back Guarantee</text>
      <text x="30" y="625" fontSize="12" fill="var(--ds-brand)">Not satisfied? We'll refund every penny.</text>
      <text x="30" y="645" fontSize="12" fill="var(--ds-brand)">No questions asked.</text>
    </svg>
  );
}

export function UpsellPageSketch() {
  return (
    <svg viewBox="0 0 400 600" className="funnel-sketch" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="600" fill="var(--ds-surface)" />

      {/* Header */}
      <rect width="400" height="50" fill="var(--ds-bg-subtle)" />
      <text x="20" y="35" fontSize="12" fill="var(--ds-text-primary)" fontWeight="600">LOGO</text>

      {/* Urgency message */}
      <rect x="20" y="70" width="360" height="50" rx="4" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1" />
      <text x="30" y="98" fontSize="13" fontWeight="600" fill="#78350f">⏰ Special offer expires in 12 hours</text>

      {/* Main offer */}
      <rect y="130" width="400" height="180" fill="var(--ds-bg-subtle)" />
      <text x="20" y="165" fontSize="20" fontWeight="700" fill="var(--ds-text-primary)">
        Wait! One More Thing...
      </text>
      <text x="20" y="195" fontSize="14" fill="var(--ds-text-secondary)">
        Add the 1-on-1 Coaching Package and get:
      </text>
      <text x="20" y="220" fontSize="13" fill="var(--ds-text-secondary)">✓ 12 months of priority support</text>
      <text x="20" y="242" fontSize="13" fill="var(--ds-text-secondary)">✓ Custom growth blueprint (normally $2,000)</text>
      <text x="20" y="264" fontSize="13" fill="var(--ds-text-secondary)">✓ Weekly strategy calls with your coach</text>

      {/* Price section */}
      <rect y="310" width="400" height="100" fill="var(--ds-surface)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="20" y="340" fontSize="14" fill="var(--ds-text-secondary)">Regular Price:</text>
      <text x="360" y="340" fontSize="14" fill="var(--ds-text-tertiary)" textAnchor="end">
        <tspan textDecoration="line-through">$2,997</tspan>
      </text>
      <text x="20" y="365" fontSize="16" fontWeight="700" fill="var(--ds-text-primary)">Today Only:</text>
      <text x="360" y="365" fontSize="24" fontWeight="700" fill="var(--ds-brand)" textAnchor="end">$597</text>
      <text x="20" y="390" fontSize="12" fill="var(--ds-text-secondary)">Save $2,400 (80% off)</text>

      {/* CTA */}
      <rect x="20" y="420" width="360" height="55" rx="4" fill="var(--ds-brand-solid)" />
      <text x="200" y="455" fontSize="16" fontWeight="600" fill="white" textAnchor="middle">
        Add to Order Now
      </text>

      {/* Skip option */}
      <line x1="40" y1="495" x2="360" y2="495" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="200" y="520" fontSize="12" fill="var(--ds-text-tertiary)" textAnchor="middle">
        No thanks, skip this offer →
      </text>
    </svg>
  );
}

export function ThankYouPageSketch() {
  return (
    <svg viewBox="0 0 400 700" className="funnel-sketch" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="700" fill="var(--ds-surface)" />

      {/* Celebration header */}
      <rect y="0" width="400" height="80" fill="var(--ds-brand-soft)" />
      <text x="200" y="45" fontSize="48" textAnchor="middle">🎉</text>

      {/* Message */}
      <text x="20" y="120" fontSize="20" fontWeight="700" fill="var(--ds-text-primary)" textAnchor="start">
        Thank You! You're In.
      </text>
      <text x="20" y="150" fontSize="14" fill="var(--ds-text-secondary)">
        Check your email for instant access
      </text>
      <text x="20" y="175" fontSize="13" fill="var(--ds-text-tertiary)">
        Look for: confirm@onevyrt.com
      </text>

      {/* Next steps */}
      <rect x="20" y="195" width="360" height="160" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="30" y="220" fontSize="14" fontWeight="600" fill="var(--ds-text-primary)">Here's What Happens Next:</text>

      <text x="30" y="250" fontSize="13" fontWeight="600" fill="var(--ds-brand)">1. Confirm Your Email</text>
      <text x="30" y="270" fontSize="12" fill="var(--ds-text-secondary)">Click the link to activate your account</text>

      <text x="30" y="300" fontSize="13" fontWeight="600" fill="var(--ds-brand)">2. Start Module 1</text>
      <text x="30" y="320" fontSize="12" fill="var(--ds-text-secondary)">Complete in 20 minutes (+ action exercise)</text>

      <text x="30" y="350" fontSize="13" fontWeight="600" fill="var(--ds-brand)">3. Your Coach Gets Notified</text>
      <text x="30" y="370" fontSize="12" fill="var(--ds-text-secondary)">They'll reach out within 24 hours</text>

      {/* Expected timeline */}
      <rect x="20" y="365" width="360" height="100" rx="4" fill="var(--ds-surface)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="30" y="390" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)">Program Timeline</text>
      <text x="30" y="415" fontSize="12" fill="var(--ds-text-secondary)">Week 1-4: Define (Business Blueprint)</text>
      <text x="30" y="435" fontSize="12" fill="var(--ds-text-secondary)">Week 5-8: Implement (Systems)</text>
      <text x="30" y="455" fontSize="12" fill="var(--ds-text-secondary)">Week 9-12: Control (Metrics) + Improve</text>

      {/* Contact coach */}
      <rect x="20" y="475" width="360" height="50" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-subtle)" strokeWidth="1" />
      <text x="30" y="502" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)">Questions?</text>
      <text x="30" y="520" fontSize="12" fill="var(--ds-text-secondary)">Email support@onevyrt.com or text +1-555-0123</text>

      {/* Social proof */}
      <rect x="20" y="535" width="360" height="80" rx="4" fill="var(--ds-brand-soft)" />
      <text x="30" y="562" fontSize="13" fontWeight="600" fill="var(--ds-brand)">Join 2,000+ Coaches</text>
      <text x="30" y="585" fontSize="12" fill="var(--ds-brand)">Who are already growing their business with ONEVYRT</text>
      <text x="30" y="605" fontSize="12" fill="var(--ds-brand)">Avg improvement: 45% revenue growth in 90 days</text>
    </svg>
  );
}

/**
 * Funnel template sketches showing complete flow
 */
export function WebinarFunnelSketch() {
  return (
    <svg viewBox="0 0 1000 400" className="funnel-template-sketch" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="400" fill="var(--ds-surface)" />

      {/* Title */}
      <text x="500" y="40" fontSize="18" fontWeight="700" fill="var(--ds-text-primary)" textAnchor="middle">
        Webinar Funnel Flow
      </text>

      {/* Stage 1: Opt-in */}
      <rect x="30" y="80" width="150" height="240" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-default)" strokeWidth="2" />
      <text x="105" y="150" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">Opt-in Page</text>
      <text x="105" y="175" fontSize="28" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">100%</text>
      <text x="105" y="200" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">1,000 visitors</text>
      <text x="105" y="220" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">65% conversion</text>
      <text x="105" y="300" fontSize="11" fill="var(--ds-text-tertiary)" textAnchor="middle">Lead Magnet</text>

      {/* Arrow 1 */}
      <path d="M 180 200 L 230 200" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />

      {/* Stage 2: Webinar */}
      <rect x="230" y="80" width="150" height="240" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-brand)" strokeWidth="2" />
      <text x="305" y="150" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">Webinar Page</text>
      <text x="305" y="175" fontSize="28" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">65%</text>
      <text x="305" y="200" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">650 attendees</text>
      <text x="305" y="220" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">42% conversion</text>
      <text x="305" y="300" fontSize="11" fill="var(--ds-text-tertiary)" textAnchor="middle">Live Teaching</text>

      {/* Arrow 2 */}
      <path d="M 380 200 L 430 200" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />

      {/* Stage 3: Sales Page */}
      <rect x="430" y="80" width="150" height="240" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-default)" strokeWidth="2" />
      <text x="505" y="150" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">Order Page</text>
      <text x="505" y="175" fontSize="28" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">27%</text>
      <text x="505" y="200" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">273 buyers</text>
      <text x="505" y="220" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">$4,997/ea</text>
      <text x="505" y="300" fontSize="11" fill="var(--ds-text-tertiary)" textAnchor="middle">Payment</text>

      {/* Arrow 3 */}
      <path d="M 580 200 L 630 200" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />

      {/* Stage 4: Upsell */}
      <rect x="630" y="80" width="150" height="240" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-default)" strokeWidth="2" />
      <text x="705" y="150" fontSize="13" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">Upsell Page</text>
      <text x="705" y="175" fontSize="28" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">31%</text>
      <text x="705" y="200" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">85 upsold</text>
      <text x="705" y="220" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">$597/ea</text>
      <text x="705" y="300" fontSize="11" fill="var(--ds-text-tertiary)" textAnchor="middle">Coaching Add-on</text>

      {/* Arrow 4 */}
      <path d="M 780 200 L 830 200" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />

      {/* Stage 5: Delivery */}
      <rect x="830" y="80" width="140" height="240" rx="4" fill="var(--ds-brand-soft)" stroke="var(--ds-brand)" strokeWidth="2" />
      <text x="900" y="150" fontSize="13" fontWeight="600" fill="var(--ds-brand)" textAnchor="middle">Member Access</text>
      <text x="900" y="175" fontSize="28" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">31%</text>
      <text x="900" y="200" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">358 total revenue</text>
      <text x="900" y="220" fontSize="11" fill="var(--ds-text-secondary)" textAnchor="middle">$1.36M lifetime</text>
      <text x="900" y="300" fontSize="11" fill="var(--ds-text-tertiary)" textAnchor="middle">Program + Coaching</text>

      {/* SVG marker for arrow */}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="var(--ds-border-default)" />
        </marker>
      </defs>
    </svg>
  );
}

export function ProductLaunchFunnelSketch() {
  return (
    <svg viewBox="0 0 900 300" className="funnel-template-sketch" xmlns="http://www.w3.org/2000/svg">
      <rect width="900" height="300" fill="var(--ds-surface)" />

      {/* Title */}
      <text x="450" y="30" fontSize="16" fontWeight="700" fill="var(--ds-text-primary)" textAnchor="middle">
        Product Launch Funnel
      </text>

      {/* Lead */}
      <rect x="20" y="60" width="130" height="180" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-default)" strokeWidth="2" />
      <text x="85" y="100" fontSize="12" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">Lead Gen</text>
      <text x="85" y="125" fontSize="24" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">100%</text>
      <text x="85" y="145" fontSize="10" fill="var(--ds-text-secondary)" textAnchor="middle">500 leads</text>
      <text x="85" y="215" fontSize="10" fill="var(--ds-text-tertiary)" textAnchor="middle">Free tool/resource</text>

      {/* Demo */}
      <path d="M 150 150 L 190 150" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" />
      <rect x="190" y="60" width="130" height="180" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-default)" strokeWidth="2" />
      <text x="255" y="100" fontSize="12" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">Demo Video</text>
      <text x="255" y="125" fontSize="24" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">48%</text>
      <text x="255" y="145" fontSize="10" fill="var(--ds-text-secondary)" textAnchor="middle">240 watched</text>
      <text x="255" y="215" fontSize="10" fill="var(--ds-text-tertiary)" textAnchor="middle">Product overview</text>

      {/* Application */}
      <path d="M 320 150 L 360 150" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" />
      <rect x="360" y="60" width="130" height="180" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-border-default)" strokeWidth="2" />
      <text x="425" y="100" fontSize="12" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">App Call</text>
      <text x="425" y="125" fontSize="24" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">28%</text>
      <text x="425" y="145" fontSize="10" fill="var(--ds-text-secondary)" textAnchor="middle">67 qualified</text>
      <text x="425" y="215" fontSize="10" fill="var(--ds-text-tertiary)" textAnchor="middle">Qualification call</text>

      {/* Close */}
      <path d="M 490 150 L 530 150" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" />
      <rect x="530" y="60" width="130" height="180" rx="4" fill="var(--ds-bg-subtle)" stroke="var(--ds-brand)" strokeWidth="2" />
      <text x="595" y="100" fontSize="12" fontWeight="600" fill="var(--ds-text-primary)" textAnchor="middle">Close</text>
      <text x="595" y="125" fontSize="24" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">55%</text>
      <text x="595" y="145" fontSize="10" fill="var(--ds-text-secondary)" textAnchor="middle">37 customers</text>
      <text x="595" y="215" fontSize="10" fill="var(--ds-text-tertiary)" textAnchor="middle">Proposal/close</text>

      {/* Upsell */}
      <path d="M 660 150 L 700 150" stroke="var(--ds-border-default)" strokeWidth="2" fill="none" />
      <rect x="700" y="60" width="130" height="180" rx="4" fill="var(--ds-brand-soft)" stroke="var(--ds-brand)" strokeWidth="2" />
      <text x="765" y="100" fontSize="12" fontWeight="600" fill="var(--ds-brand)" textAnchor="middle">Upsell</text>
      <text x="765" y="125" fontSize="24" fontWeight="700" fill="var(--ds-brand)" textAnchor="middle">43%</text>
      <text x="765" y="145" fontSize="10" fill="var(--ds-text-secondary)" textAnchor="middle">16 upgrades</text>
      <text x="765" y="215" fontSize="10" fill="var(--ds-text-tertiary)" textAnchor="middle">Premium tier</text>
    </svg>
  );
}
