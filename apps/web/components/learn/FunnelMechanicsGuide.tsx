"use client";
/**
 * FunnelMechanicsGuide — Educational guide explaining funnel mechanics
 * with interactive SVG diagrams and key concepts.
 */
import { useState } from "react";

interface Concept {
  id: string;
  title: string;
  emoji: string;
  description: string;
  keyPoints: string[];
}

const CONCEPTS: Concept[] = [
  {
    id: "awareness",
    title: "Awareness — Cast a Wide Net",
    emoji: "📢",
    description:
      "Your prospects don't know you exist yet. Awareness is about being visible through ads, content, SEO, and referrals. Focus is on reach and traffic.",
    keyPoints: [
      "High volume expected (you get everyone's attention)",
      "Low conversion rate is normal (most won't be interested)",
      "Cost per visitor is the metric to optimize",
      "Examples: ads, blog posts, social media, events",
    ],
  },
  {
    id: "interest",
    title: "Interest — Filter for Relevance",
    emoji: "👀",
    description:
      "Once people see you, do they care? Interest stage filters for people who think your offer might solve their problem. Quality starts mattering here.",
    keyPoints: [
      "Dramatic drop from awareness (expected—only qualified move forward)",
      "Clear value proposition matters now",
      "Time on page, email opens, engagement signals show interest",
      "Examples: landing pages, welcome emails, lead magnets",
    ],
  },
  {
    id: "consideration",
    title: "Consideration — Build Trust",
    emoji: "🔍",
    description:
      "Interested prospects are comparing options (yours vs competitors). Your job is to build credibility and show you're worth the investment.",
    keyPoints: [
      "Objections peak here (cost, complexity, alternatives)",
      "Trust signals matter: testimonials, case studies, credentials",
      "Time investment increases (they're seriously evaluating)",
      "Examples: demos, consultations, detailed comparisons, reviews",
    ],
  },
  {
    id: "decision",
    title: "Decision — Remove Friction",
    emoji: "✅",
    description:
      "The prospect is ready to buy. Your job is to make it as easy as possible. Remove every obstacle between them and the purchase button.",
    keyPoints: [
      "Small frictions become big blockers at this stage",
      "Clear pricing, easy checkout, simple terms matter",
      "Last-minute doubts need addressing (guarantees, support)",
      "Examples: checkout page, contract terms, payment options",
    ],
  },
  {
    id: "retention",
    title: "Retention — Create Advocates",
    emoji: "💎",
    description:
      "The sale is just the beginning. Retention is keeping customers happy, getting results, and turning them into repeating customers and referrers.",
    keyPoints: [
      "Much cheaper to keep a customer than to find a new one",
      "Good onboarding cuts churn dramatically",
      "Happy customers refer more than any ad",
      "Examples: onboarding, support, product updates, loyalty programs",
    ],
  },
];

export function FunnelMechanicsGuide() {
  const [expandedId, setExpandedId] = useState<string>("awareness");

  return (
    <div className="funnel-mechanics-guide w-full space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ color: "var(--ds-text-primary)" }}>
          How Funnels Work
        </h2>
        <p className="text-gray-600" style={{ color: "var(--ds-text-secondary)" }}>
          Understand the five critical stages of turning strangers into raving customers.
        </p>
      </div>

      {/* Funnel diagram */}
      <div className="bg-white border border-gray-200 rounded-lg p-8" style={{
        backgroundColor: "var(--ds-surface)",
        borderColor: "var(--ds-border-subtle)",
      }}>
        <svg
          viewBox="0 0 800 400"
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Funnel shape */}
          <defs>
            <linearGradient id="grad-awareness" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-interest" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-consideration" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-decision" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-retention" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Funnel segments */}
          <polygon
            points="50,30 750,30 700,90 100,90"
            fill="url(#grad-awareness)"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          <polygon
            points="100,90 700,90 650,150 150,150"
            fill="url(#grad-interest)"
            stroke="#10b981"
            strokeWidth="2"
          />
          <polygon
            points="150,150 650,150 600,210 200,210"
            fill="url(#grad-consideration)"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <polygon
            points="200,210 600,210 550,270 250,270"
            fill="url(#grad-decision)"
            stroke="#8b5cf6"
            strokeWidth="2"
          />
          <polygon
            points="250,270 550,270 520,330 280,330"
            fill="url(#grad-retention)"
            stroke="#ec4899"
            strokeWidth="2"
          />

          {/* Labels */}
          <text x="400" y="65" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">
            Awareness
          </text>
          <text x="400" y="125" textAnchor="middle" fontSize="16" fontWeight="600" fill="#065f46">
            Interest
          </text>
          <text x="400" y="185" textAnchor="middle" fontSize="16" fontWeight="600" fill="#92400e">
            Consideration
          </text>
          <text x="400" y="245" textAnchor="middle" fontSize="16" fontWeight="600" fill="#5b21b6">
            Decision
          </text>
          <text x="400" y="305" textAnchor="middle" fontSize="16" fontWeight="600" fill="#831843">
            Retention
          </text>

          {/* Visitor counts (examples) */}
          <text x="700" y="65" fontSize="13" fontWeight="700" fill="#3b82f6">
            10K
          </text>
          <text x="700" y="125" fontSize="13" fontWeight="700" fill="#10b981">
            1K
          </text>
          <text x="700" y="185" fontSize="13" fontWeight="700" fill="#f59e0b">
            300
          </text>
          <text x="700" y="245" fontSize="13" fontWeight="700" fill="#8b5cf6">
            100
          </text>
          <text x="700" y="305" fontSize="13" fontWeight="700" fill="#ec4899">
            50
          </text>
        </svg>

        {/* Funnel insight */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Key insight:</strong> You don't need more traffic—you need better conversion at each
            stage. A 10% improvement in conversion at the Decision stage (50→55) adds 5 more customers
            with the same traffic.
          </p>
        </div>
      </div>

      {/* Concepts */}
      <div className="space-y-4">
        {CONCEPTS.map((concept) => (
          <div
            key={concept.id}
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: "var(--ds-border-subtle)" }}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(expandedId === concept.id ? "" : concept.id)}
              className="w-full px-6 py-4 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
              style={{
                backgroundColor: expandedId === concept.id ? "var(--ds-surface-subtle)" : "var(--ds-surface)",
              }}
            >
              <div className="flex items-center gap-4 text-left">
                <span className="text-3xl">{concept.emoji}</span>
                <div>
                  <h3 className="font-semibold text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
                    {concept.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1" style={{ color: "var(--ds-text-secondary)" }}>
                    {concept.description.substring(0, 60)}...
                  </p>
                </div>
              </div>
              <span
                className="text-gray-400 transition-transform flex-shrink-0"
                style={{
                  transform: expandedId === concept.id ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                ▼
              </span>
            </button>

            {/* Expanded content */}
            {expandedId === concept.id && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200" style={{
                backgroundColor: "var(--ds-surface-subtle)",
                borderColor: "var(--ds-border-subtle)",
              }}>
                <p className="text-gray-700 mb-4" style={{ color: "var(--ds-text-secondary)" }}>
                  {concept.description}
                </p>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3" style={{ color: "var(--ds-text-primary)" }}>
                    Key Points:
                  </h4>
                  <ul className="space-y-2">
                    {concept.keyPoints.map((point, i) => (
                      <li
                        key={i}
                        className="flex gap-3 text-sm text-gray-700"
                        style={{ color: "var(--ds-text-secondary)" }}
                      >
                        <span className="text-blue-600 font-bold flex-shrink-0">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Stage-specific tips */}
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Optimization tip:</strong> Use A/B testing to find what resonates at this
                    stage. Small wins compound.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Interactive example */}
      <div className="bg-white border border-gray-200 rounded-lg p-6" style={{
        backgroundColor: "var(--ds-surface)",
        borderColor: "var(--ds-border-subtle)",
      }}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: "var(--ds-text-primary)" }}>
          Real Example: SaaS Company
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded border-l-4 border-blue-500">
            <span className="text-sm font-medium text-blue-900">📢 Awareness</span>
            <span className="text-lg font-bold text-blue-600">10,000</span>
            <span className="text-xs text-blue-700">(100%)</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded border-l-4 border-green-500">
            <span className="text-sm font-medium text-green-900">👀 Interest</span>
            <span className="text-lg font-bold text-green-600">500</span>
            <span className="text-xs text-green-700">(5% conversion)</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-amber-50 rounded border-l-4 border-amber-500">
            <span className="text-sm font-medium text-amber-900">🔍 Consideration</span>
            <span className="text-lg font-bold text-amber-600">100</span>
            <span className="text-xs text-amber-700">(20% conversion)</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-purple-50 rounded border-l-4 border-purple-500">
            <span className="text-sm font-medium text-purple-900">✅ Decision</span>
            <span className="text-lg font-bold text-purple-600">50</span>
            <span className="text-xs text-purple-700">(50% conversion)</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-pink-50 rounded border-l-4 border-pink-500">
            <span className="text-sm font-medium text-pink-900">💎 Retention</span>
            <span className="text-lg font-bold text-pink-600">40</span>
            <span className="text-xs text-pink-700">(80% retention)</span>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-700" style={{ color: "var(--ds-text-secondary)" }}>
            <strong>Analysis:</strong> Only 0.4% of the original 10K became happy customers. But notice
            the bottleneck is Awareness→Interest (95% drop). Fix that first. A small 10% improvement
            (500→550) adds 5 more customers!
          </p>
        </div>
      </div>

      {/* Common mistakes */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
          ⚠️ Common Mistakes to Avoid
        </h3>
        <ul className="space-y-2 text-sm text-red-800">
          <li>❌ Chasing more traffic without fixing conversion stages</li>
          <li>❌ Ignoring the bottleneck (lowest conversion) stage</li>
          <li>❌ Mixing up what matters at each stage (traffic matters in Awareness, trust in Consideration)</li>
          <li>❌ Not measuring conversion rates at each stage</li>
          <li>❌ Forgetting about retention (the most profitable stage)</li>
        </ul>
      </div>

      <style jsx>{`
        .funnel-mechanics-guide {
          width: 100%;
        }

        button {
          text-align: left;
        }

        button:focus {
          outline: none;
          background-color: var(--ds-surface-subtle);
        }

        @media (max-width: 768px) {
          :global(.funnel-mechanics-guide svg) {
            max-height: 300px;
          }
        }
      `}</style>
    </div>
  );
}
