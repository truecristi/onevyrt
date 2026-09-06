"use client";
/**
 * FunnelVisualizer — Interactive visual representation of funnel stages
 * with animated traffic flow, color-coded progression, and metrics.
 */
import { useState, useEffect } from "react";

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  width: number;
  metrics: string;
  description: string;
}

const STAGES: FunnelStage[] = [
  {
    id: "awareness",
    name: "Awareness",
    color: "#3b82f6",
    width: 100,
    metrics: "Impressions → Clicks",
    description: "People discover you through ads, organic search, referrals, or social media",
  },
  {
    id: "consideration",
    name: "Consideration",
    color: "#f59e0b",
    width: 65,
    metrics: "Visits → Sign-ups",
    description: "Prospects evaluate your offer and build trust through content and interactions",
  },
  {
    id: "decision",
    name: "Decision",
    color: "#10b981",
    width: 35,
    metrics: "Leads → Conversions",
    description: "Customers make the commitment and complete the purchase or enrollment",
  },
  {
    id: "retention",
    name: "Retention",
    color: "#8b5cf6",
    width: 25,
    metrics: "Customers → Advocates",
    description: "Ongoing value delivery and building long-term relationships and loyalty",
  },
];

export function FunnelVisualizer() {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  return (
    <div className="funnel-visualizer">
      <div className="funnel-container">
        <svg
          viewBox="0 0 800 400"
          className="funnel-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Animated traffic particles */}
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="gradient4" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Funnel shapes */}
          <polygon
            points="100,50 700,50 650,130 150,130"
            fill="url(#gradient1)"
            className="funnel-segment"
          />
          <polygon
            points="150,130 650,130 600,200 200,200"
            fill="url(#gradient2)"
            className="funnel-segment"
          />
          <polygon
            points="200,200 600,200 550,270 250,270"
            fill="url(#gradient3)"
            className="funnel-segment"
          />
          <polygon
            points="250,270 550,270 520,340 280,340"
            fill="url(#gradient4)"
            className="funnel-segment"
          />

          {/* Animated circles (traffic) flowing through funnel */}
          {animate && (
            <>
              <circle cx="200" cy="60" r="4" fill="#3b82f6" className="traffic-particle traffic-1" />
              <circle cx="300" cy="75" r="4" fill="#3b82f6" className="traffic-particle traffic-2" />
              <circle cx="400" cy="70" r="4" fill="#3b82f6" className="traffic-particle traffic-3" />
              <circle cx="550" cy="80" r="4" fill="#3b82f6" className="traffic-particle traffic-4" />

              <circle cx="250" cy="150" r="4" fill="#f59e0b" className="traffic-particle traffic-5" />
              <circle cx="400" cy="160" r="4" fill="#f59e0b" className="traffic-particle traffic-6" />
              <circle cx="550" cy="155" r="4" fill="#f59e0b" className="traffic-particle traffic-7" />

              <circle cx="300" cy="230" r="4" fill="#10b981" className="traffic-particle traffic-8" />
              <circle cx="450" cy="240" r="4" fill="#10b981" className="traffic-particle traffic-9" />

              <circle cx="350" cy="300" r="4" fill="#8b5cf6" className="traffic-particle traffic-10" />
            </>
          )}

          {/* Drop-off indicators */}
          <g className="dropoff-indicator">
            <text x="720" y="95" fontSize="14" fill="#3b82f6" fontWeight="600">
              5%
            </text>
            <text x="710" y="115" fontSize="12" fill="#666" textAnchor="middle">
              converts
            </text>
          </g>

          <g className="dropoff-indicator">
            <text x="720" y="175" fontSize="14" fill="#f59e0b" fontWeight="600">
              3.3%
            </text>
            <text x="710" y="195" fontSize="12" fill="#666" textAnchor="middle">
              converts
            </text>
          </g>

          <g className="dropoff-indicator">
            <text x="720" y="250" fontSize="14" fill="#10b981" fontWeight="600">
              1.75%
            </text>
            <text x="710" y="270" fontSize="12" fill="#666" textAnchor="middle">
              converts
            </text>
          </g>

          <g className="dropoff-indicator">
            <text x="720" y="320" fontSize="14" fill="#8b5cf6" fontWeight="600">
              0.88%
            </text>
            <text x="710" y="340" fontSize="12" fill="#666" textAnchor="middle">
              converts
            </text>
          </g>
        </svg>
      </div>

      <div className="funnel-stages-detail">
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            className={`stage-detail ${activeStage === stage.id ? "active" : ""}`}
            onMouseEnter={() => setActiveStage(stage.id)}
            onMouseLeave={() => setActiveStage(null)}
          >
            <div className="stage-detail-header" style={{ borderLeftColor: stage.color }}>
              <div className="stage-color-dot" style={{ backgroundColor: stage.color }} />
              <div>
                <h3>{stage.name}</h3>
                <p className="stage-metrics">{stage.metrics}</p>
              </div>
            </div>
            <p className="stage-description">{stage.description}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        .funnel-visualizer {
          width: 100%;
        }

        .funnel-container {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
          margin-bottom: var(--ds-space-6);
          box-shadow: var(--ds-shadow-sm);
        }

        .funnel-svg {
          width: 100%;
          height: auto;
          display: block;
          max-height: 400px;
        }

        .funnel-segment {
          cursor: pointer;
          transition: opacity 0.3s ease;
        }

        .funnel-segment:hover {
          opacity: 0.9;
        }

        .traffic-particle {
          animation: flowDown 3s infinite ease-in-out;
        }

        .traffic-1 {
          animation-delay: 0s;
        }
        .traffic-2 {
          animation-delay: 0.3s;
        }
        .traffic-3 {
          animation-delay: 0.6s;
        }
        .traffic-4 {
          animation-delay: 0.9s;
        }
        .traffic-5 {
          animation-delay: 1.2s;
        }
        .traffic-6 {
          animation-delay: 1.5s;
        }
        .traffic-7 {
          animation-delay: 1.8s;
        }
        .traffic-8 {
          animation-delay: 2s;
        }
        .traffic-9 {
          animation-delay: 2.3s;
        }
        .traffic-10 {
          animation-delay: 2.6s;
        }

        @keyframes flowDown {
          0% {
            cy: 50;
            opacity: 1;
          }
          100% {
            cy: 340;
            opacity: 0.3;
          }
        }

        .funnel-stages-detail {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--ds-space-4);
        }

        .stage-detail {
          background: var(--ds-surface-subtle);
          border-left: 4px solid #ccc;
          border-radius: var(--ds-radius-md);
          padding: var(--ds-space-4);
          transition: all var(--ds-dur-hover);
          cursor: pointer;
        }

        .stage-detail.active {
          background: var(--ds-surface);
          box-shadow: var(--ds-shadow-md);
          transform: translateY(-2px);
        }

        .stage-detail-header {
          display: flex;
          align-items: center;
          gap: var(--ds-space-3);
          margin-bottom: var(--ds-space-3);
          border-left: 3px solid;
          padding-left: var(--ds-space-3);
          margin-left: calc(-1 * var(--ds-space-4));
          padding-right: var(--ds-space-3);
        }

        .stage-color-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .stage-detail h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .stage-metrics {
          margin: 4px 0 0 0;
          font-size: 0.85rem;
          color: var(--ds-text-tertiary);
          font-weight: 500;
        }

        .stage-description {
          margin: 0;
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
          line-height: 1.5;
        }

        .dropoff-indicator {
          pointer-events: none;
        }

        @media (max-width: 768px) {
          .funnel-container {
            padding: var(--ds-space-4);
          }

          .funnel-stages-detail {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
