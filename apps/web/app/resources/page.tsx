/**
 * Resources Hub — One place to find all tools, templates, guides, and community resources.
 * Organized into four sections: RECOMMENDED FOR YOU, BUILD, LEARN, and COMMUNITY.
 * Server-rendered with inline styling for performance.
 */

import type { Metadata } from "next";
import { CANONICAL_ROUTES } from "../../lib/navigation/canonical-routes";

export const metadata: Metadata = {
  title: "Resources Hub — ONEVYRT",
  description: "Access all ONEVYRT tools, templates, guides, and community resources in one place.",
};

interface ResourceCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  color?: "blue" | "green" | "amber" | "red" | "cyan" | "purple";
}

const RECOMMENDED: ResourceCard[] = [
  {
    id: "customer-avatar",
    icon: "👥",
    title: "Customer Avatar",
    description: "Define your ideal customer in depth. Includes templates for demographics, psychographics, and buying behavior.",
    href: CANONICAL_ROUTES.business,
    badge: "Essential",
    color: "blue",
  },
  {
    id: "offer-builder",
    icon: "🎯",
    title: "Offer Builder",
    description: "Craft a compelling offer using the value ladder framework. Test pricing, positioning, and messaging.",
    href: CANONICAL_ROUTES.businessMessage,
    badge: "Strategic",
    color: "cyan",
  },
  {
    id: "break-even-calculator",
    icon: "💰",
    title: "Break-Even Calculator",
    description: "Understand your unit economics. Calculate runway, CAC, and profitability thresholds.",
    href: CANONICAL_ROUTES.business,
    badge: "Financial",
    color: "amber",
  },
];

const BUILD: ResourceCard[] = [
  {
    id: "funnel-builder",
    icon: "🔧",
    title: "Studio (Project Builder)",
    description: "Build landing pages, sales funnels, and campaigns without code. Drag-and-drop canvas with pre-built components.",
    href: CANONICAL_ROUTES.studio,
    color: "green",
  },
  {
    id: "funnel-designer",
    icon: "🎨",
    title: "Funnel Templates",
    description: "Professional, battle-tested funnel templates. Opt-in pages, sales pages, checkout sequences, upsells, and thank-you pages.",
    href: "/resources/funnel-templates",
    color: "green",
  },
  {
    id: "campaign-studio",
    icon: "📢",
    title: "Campaign Studio",
    description: "AI-powered copywriting and creative generation. Write emails, landing page copy, and ad creatives in seconds.",
    href: CANONICAL_ROUTES.campaignStudioBrand,
    color: "purple",
  },
  {
    id: "leads-inbox",
    icon: "📥",
    title: "Leads Inbox",
    description: "Capture, qualify, and organize leads in one place. Track their journey and book calls directly.",
    href: CANONICAL_ROUTES.businessLeads,
    color: "red",
  },
];

const LEARN: ResourceCard[] = [
  {
    id: "funnels-explained",
    icon: "📚",
    title: "Funnels Explained",
    description: "Complete education on how sales funnels work, traffic flow, conversion stages, and optimization strategies.",
    href: "/resources/funnels-explained",
    color: "blue",
  },
  {
    id: "glossary",
    icon: "📖",
    title: "Business Glossary",
    description: "Terminology reference for marketing, sales, and business metrics. Definitions you can actually understand.",
    href: CANONICAL_ROUTES.glossary,
    color: "cyan",
  },
  {
    id: "programme",
    icon: "🎓",
    title: "Learning Programme",
    description: "4-stage structured curriculum: DEFINE your business, IMPLEMENT systems, CONTROL metrics, IMPROVE & SCALE.",
    href: CANONICAL_ROUTES.programme,
    color: "blue",
  },
];

const COMMUNITY: ResourceCard[] = [
  {
    id: "community-templates",
    icon: "🤝",
    title: "Community Library",
    description: "Swipe file of proven templates, funnels, and creatives shared by successful founders. Learn what works.",
    href: CANONICAL_ROUTES.community,
    color: "purple",
  },
  {
    id: "best-practices",
    icon: "⭐",
    title: "Best Practices",
    description: "Curated insights from top performers. See how successful founders optimized funnels, pricing, and scaling.",
    href: CANONICAL_ROUTES.community,
    color: "green",
  },
];

const colorMap: Record<string, string> = {
  blue: "var(--ds-ch1-color)",
  green: "var(--ds-ch2-color)",
  amber: "var(--ds-ch3-color)",
  red: "var(--ds-ch4-color)",
  cyan: "var(--ds-ch5-color)",
  purple: "#8b5cf6",
};

const colorSoftMap: Record<string, string> = {
  blue: "var(--ds-ch1-soft)",
  green: "var(--ds-ch2-soft)",
  amber: "var(--ds-ch3-soft)",
  red: "var(--ds-ch4-soft)",
  cyan: "var(--ds-ch5-soft)",
  purple: "#f3e8ff",
};

function ResourceCard({ card }: { card: ResourceCard }) {
  const color = colorMap[card.color || "blue"];
  const colorSoft = colorSoftMap[card.color || "blue"];

  return (
    <a href={card.href} className="rh-card">
      <style>{`
        .rh-card {
          --rh-color: ${color};
          --rh-soft: ${colorSoft};
        }
      `}</style>
      <div className="rh-card-icon">{card.icon}</div>
      <div className="rh-card-content">
        <div className="rh-card-header">
          <h3 className="rh-card-title">{card.title}</h3>
          {card.badge && <span className="rh-card-badge">{card.badge}</span>}
        </div>
        <p className="rh-card-description">{card.description}</p>
      </div>
      <div className="rh-card-arrow">→</div>
    </a>
  );
}

function ResourceSection({ title, subtitle, cards }: { title: string; subtitle?: string; cards: ResourceCard[] }) {
  return (
    <section className="rh-section">
      <div className="rh-section-header">
        <h2 className="rh-section-title">{title}</h2>
        {subtitle && <p className="rh-section-subtitle">{subtitle}</p>}
      </div>
      <div className="rh-section-grid">
        {cards.map((card) => (
          <ResourceCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export default function ResourcesPage() {
  return (
    <div className="rh-page">
      <style>{RESOURCES_CSS}</style>

      {/* Hero Section */}
      <div className="rh-hero">
        <div className="rh-hero-content">
          <h1 className="rh-hero-title">Resources Hub</h1>
          <p className="rh-hero-subtitle">
            Everything you need to build, learn, and grow your business. Access tools, templates, guides, and community resources in one place.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="rh-container">
        {/* Recommended For You */}
        <ResourceSection
          title="Recommended For You"
          subtitle="Start with these essential tools and frameworks"
          cards={RECOMMENDED}
        />

        {/* Build Section */}
        <ResourceSection
          title="Build"
          subtitle="Create funnels, campaigns, and landing pages without code"
          cards={BUILD}
        />

        {/* Learn Section */}
        <ResourceSection
          title="Learn"
          subtitle="Understand the fundamentals and strategies"
          cards={LEARN}
        />

        {/* Community Section */}
        <ResourceSection
          title="Community"
          subtitle="Learn from other founders. Find proven templates and best practices."
          cards={COMMUNITY}
        />
      </div>
    </div>
  );
}

const RESOURCES_CSS = `
.rh-page {
  background: var(--ds-bg-app);
  min-height: 100vh;
  font-family: var(--ds-font, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
}

/* Hero Section */
.rh-hero {
  background: linear-gradient(135deg, var(--ds-brand) 0%, var(--ds-brand-dark) 100%);
  color: white;
  padding: 60px 20px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.rh-hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.rh-hero-title {
  font-size: clamp(28px, 8vw, 52px);
  font-weight: 700;
  margin: 0 0 16px 0;
  line-height: 1.2;
  letter-spacing: -0.5px;
}

.rh-hero-subtitle {
  font-size: 18px;
  margin: 0;
  opacity: 0.95;
  line-height: 1.6;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

/* Main Container */
.rh-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 60px 20px;
}

/* Section */
.rh-section {
  margin-bottom: 80px;
}

.rh-section:last-child {
  margin-bottom: 40px;
}

.rh-section-header {
  margin-bottom: 40px;
}

.rh-section-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: var(--ds-text-primary);
  letter-spacing: -0.5px;
}

.rh-section-subtitle {
  font-size: 16px;
  color: var(--ds-text-secondary);
  margin: 0;
  line-height: 1.5;
}

/* Grid Layout */
.rh-section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;
}

@media (max-width: 768px) {
  .rh-section-grid {
    grid-template-columns: 1fr;
  }
}

/* Card */
.rh-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-subtle);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s ease;
  box-shadow: var(--ds-shadow-xs);
  position: relative;
  overflow: hidden;
}

.rh-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--rh-color, var(--ds-brand));
  transition: height 0.2s ease;
}

.rh-card:hover {
  border-color: var(--rh-color, var(--ds-brand));
  box-shadow: var(--ds-shadow-md);
  transform: translateY(-2px);
}

.rh-card:hover::before {
  height: 6px;
}

.rh-card-icon {
  font-size: 48px;
  margin-bottom: 16px;
  display: inline-block;
}

.rh-card-content {
  flex: 1;
  min-height: 0;
}

.rh-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.rh-card-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--ds-text-primary);
  line-height: 1.3;
}

.rh-card-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--rh-soft, var(--ds-brand-soft));
  color: var(--rh-color, var(--ds-brand));
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.rh-card-description {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ds-text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rh-card-arrow {
  font-size: 20px;
  color: var(--rh-color, var(--ds-brand));
  margin-top: 16px;
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.2s ease;
}

.rh-card:hover .rh-card-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .rh-hero {
    background: linear-gradient(135deg, var(--ds-brand) 0%, var(--ds-brand-dark) 100%);
  }

  .rh-card {
    background: var(--ds-surface);
  }
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .rh-hero {
    padding: 40px 16px;
  }

  .rh-hero-title {
    font-size: 32px;
  }

  .rh-hero-subtitle {
    font-size: 16px;
  }

  .rh-container {
    padding: 40px 16px;
  }

  .rh-section {
    margin-bottom: 60px;
  }

  .rh-section-title {
    font-size: 24px;
  }

  .rh-card {
    padding: 20px;
  }

  .rh-card-icon {
    font-size: 40px;
  }

  .rh-card-title {
    font-size: 16px;
  }

  .rh-card-description {
    font-size: 13px;
  }
}
`;
