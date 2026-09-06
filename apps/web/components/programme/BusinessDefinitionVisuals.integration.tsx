/**
 * BusinessDefinitionVisuals.integration.tsx
 *
 * Example: How to integrate BusinessDefinitionVisuals into the actual
 * Chapter 1 (DEFINE) lesson page flow.
 *
 * This shows:
 * - Loading state while fetching enrollment data
 * - Combining visuals with lesson narrative
 * - Handling user updates (saving custom data)
 * - Coach approval flow integration
 * - Export/PDF generation entry points
 */

"use client";

import { useState, useEffect } from "react";
import { BusinessDefinitionVisuals, type CustomerAvatar, type CompetitorPosition, type LadderRung } from "./BusinessDefinitionVisuals";

/**
 * Represents the saved state of Chapter 1 lesson
 */
interface Chapter1Data {
  competitors?: CompetitorPosition[];
  yourPosition?: { priceScore: number; positionScore: number };
  ladder?: LadderRung[];
  avatar?: CustomerAvatar;
  completedAt?: string;
  submittedAt?: string;
  coachApproved?: boolean;
}

/**
 * Full Lesson Page Integration Example
 *
 * Usage in route: app/programme/chapter-1/define/page.tsx
 *
 * ```tsx
 * import { Chapter1DefinitionLessonPage } from "@/components/programme/BusinessDefinitionVisuals.integration";
 * export default Chapter1DefinitionLessonPage;
 * ```
 */
export async function Chapter1DefinitionLessonPage() {
  // In production: fetch from API/database
  // const enrollment = await getEnrollment(workspaceId);
  // const chapter1Data = enrollment.chapters[0].data as Chapter1Data;

  return (
    <div className="chapter-1-page">
      <Chapter1LessonContent />
    </div>
  );
}

/**
 * Client component that handles interactivity, state, and updates
 */
function Chapter1LessonContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [chapter1Data, setChapter1Data] = useState<Chapter1Data | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Simulate fetching enrollment data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // In real app:
        // const res = await fetch(`/api/programme/chapters?chapterId=1`);
        // const data = await res.json();
        // setChapter1Data(data);

        // Demo: simulate network delay
        await new Promise((r) => setTimeout(r, 500));
        setChapter1Data({
          competitors: [
            { name: "Budget Competitor", priceScore: 20, positionScore: 15, size: "sm" },
            { name: "Mid-Market Player", priceScore: 55, positionScore: 50, size: "md" },
            { name: "Premium Leader", priceScore: 85, positionScore: 90, size: "lg" },
          ],
          yourPosition: { priceScore: 60, positionScore: 75 },
          ladder: [
            { stage: "lead", name: "Lead Magnet", description: "Free template/guide", price: "Free" },
            { stage: "frontend", name: "Frontend Offer", description: "Low-ticket entry", price: "$97" },
            { stage: "core", name: "Core Offer", description: "Main product/service", price: "$5k–$25k" },
            { stage: "backend", name: "Backend Offer", description: "High-ticket done-for-you", price: "$50k+" },
            { stage: "upsell", name: "Upsell", description: "Annual premium support", price: "$200/mo" },
          ],
          avatar: {
            name: "Sarah",
            role: "Small Business Owner",
            ageRange: "35–50",
            incomeLevel: "£50k–£120k annual revenue",
            painPoints: [
              "Unclear how to price services",
              "Losing leads in the sales funnel",
              "No systematic way to track metrics",
            ],
            desiredOutcome: "A documented, systemized business model with predictable revenue",
          },
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Failed to load lesson data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveCustomData = async (updatedData: Chapter1Data) => {
    setIsSaving(true);
    try {
      // In real app:
      // await fetch(`/api/programme/chapters/1`, {
      //   method: "PUT",
      //   body: JSON.stringify(updatedData),
      // });

      // Simulate save
      await new Promise((r) => setTimeout(r, 800));
      setChapter1Data(updatedData);
      setEditMode(false);

      // Show toast
      console.log("Chapter 1 data saved!");
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    try {
      // In real app:
      // await fetch(`/api/programme/chapters/1/submit`, { method: "POST" });

      console.log("Chapter 1 submitted to coach for review");
      // Trigger notification, update status, etc.
    } catch (error) {
      console.error("Failed to submit:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="lesson-loading" style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#475569", fontSize: "16px" }}>Loading lesson...</p>
      </div>
    );
  }

  return (
    <div className="lesson-container" style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
      {/* Header */}
      <header className="lesson-header" style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#586173", marginBottom: "8px" }}>
              Chapter 1: DEFINE
            </div>
            <h1 style={{ fontSize: "32px", fontWeight: 700, margin: "0 0 8px 0" }}>
              Business Psychology Blueprint
            </h1>
            <p style={{ fontSize: "16px", color: "#475569", margin: "0" }}>
              Define your market position, value ladder, and ideal customer
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {editMode ? (
              <>
                <button
                  onClick={() => setEditMode(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #dde3eb",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveCustomData(chapter1Data!)}
                  disabled={isSaving}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#088057",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #dde3eb",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={handleSubmitForReview}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Submit for Review
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Lesson Intro */}
      <section className="lesson-intro" style={{ marginBottom: "48px", background: "#f7f8fc", padding: "24px", borderRadius: "12px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginTop: "0", marginBottom: "12px" }}>
          Three Foundations of Business Definition
        </h2>
        <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#475569", marginBottom: "16px" }}>
          Every successful business is built on clarity in three dimensions:
        </p>
        <ol style={{ fontSize: "15px", lineHeight: "1.8", color: "#475569", paddingLeft: "20px" }}>
          <li style={{ marginBottom: "12px" }}>
            <strong>Positioning:</strong> Where you sit in the market relative to competitors (your price point, positioning on premium-to-budget spectrum)
          </li>
          <li style={{ marginBottom: "12px" }}>
            <strong>Value Ladder:</strong> The journey you take a customer on, from free/low-ticket to your highest-value offer
          </li>
          <li>
            <strong>Customer Avatar:</strong> The one person you serve best (their demographics, pain points, desired outcome)
          </li>
        </ol>
        <p style={{ fontSize: "15px", color: "#586173", fontStyle: "italic", marginTop: "16px", marginBottom: "0" }}>
          Below, you'll see three visuals. The defaults show what a well-defined business looks like. Customize them to match your strategy.
        </p>
      </section>

      {/* Main Visuals */}
      <section className="lesson-visuals" style={{ marginBottom: "48px" }}>
        {chapter1Data ? (
          <BusinessDefinitionVisuals
            competitors={chapter1Data.competitors}
            yourPosition={chapter1Data.yourPosition}
            ladder={chapter1Data.ladder}
            avatar={chapter1Data.avatar}
            title="Your Business Definition"
          />
        ) : (
          <p style={{ color: "#586173" }}>No data available</p>
        )}
      </section>

      {/* Reflection Questions */}
      <section className="lesson-reflection" style={{ marginBottom: "48px", background: "#eff6ff", padding: "24px", borderRadius: "12px", borderLeft: "4px solid #2563eb" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginTop: "0", marginBottom: "16px", color: "#1e40af" }}>
          Reflection: Test Your Definition
        </h3>
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px 0" }}>1. Positioning</h4>
            <p style={{ fontSize: "14px", color: "#475569", margin: "0" }}>
              Look at your position on the map. Is it intentional, or did you fall into it by accident? Could you move up/down or left/right on purpose?
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px 0" }}>2. Value Ladder</h4>
            <p style={{ fontSize: "14px", color: "#475569", margin: "0" }}>
              Does each rung have a clear purpose? Are any rungs missing? Is the price progression logical?
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px 0" }}>3. Avatar</h4>
            <p style={{ fontSize: "14px", color: "#475569", margin: "0" }}>
              Can you describe your customer avatar in 30 seconds? Can your team do the same? If not, dig deeper.
            </p>
          </div>
        </div>
      </section>

      {/* Key Takeaways */}
      <section className="lesson-takeaways" style={{ background: "#ecfdf3", padding: "24px", borderRadius: "12px", borderLeft: "4px solid #12703a" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginTop: "0", marginBottom: "16px", color: "#12703a" }}>
          ✓ Key Takeaways
        </h3>
        <ul style={{ fontSize: "14px", color: "#475569", paddingLeft: "20px", margin: "0" }}>
          <li style={{ marginBottom: "8px" }}>Positioning is a strategic choice, not luck—decide where you belong</li>
          <li style={{ marginBottom: "8px" }}>Your value ladder is the revenue engine of your business</li>
          <li>A clear avatar guides every decision: pricing, marketing, product, team</li>
        </ul>
      </section>

      {/* Footer / CTA */}
      <footer style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #dde3eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "14px", color: "#586173" }}>
            Last saved: {chapter1Data?.completedAt ? new Date(chapter1Data.completedAt).toLocaleDateString() : "Not saved"}
          </span>
          <button
            onClick={handleSubmitForReview}
            style={{
              padding: "12px 24px",
              borderRadius: "6px",
              border: "none",
              background: "#088057",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Submit for Coach Review →
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Example: Minimal integration (just the visuals, no wrapper)
 */
export function Chapter1MinimalExample() {
  return (
    <BusinessDefinitionVisuals
      title="Chapter 1: Define Your Business"
    />
  );
}

/**
 * Example: With custom data from props
 */
export function Chapter1WithCustomData({
  data,
}: {
  data: Chapter1Data;
}) {
  return (
    <div>
      <h1>Chapter 1: DEFINE</h1>
      <BusinessDefinitionVisuals
        competitors={data.competitors}
        yourPosition={data.yourPosition}
        ladder={data.ladder}
        avatar={data.avatar}
        title="Business Psychology Blueprint"
      />
    </div>
  );
}
