"use client";
/**
 * Why & Creed Guided Reflection
 *
 * A step-by-step reflection journey that guides users through questions
 * to deeply connect with their purpose and business commitment.
 * Transforms blank text fields into meaningful, guided introspection.
 */

import { useState } from "react";
import type { WhyAndCreedData } from "../../lib/dashboard/why-creed";

interface Props {
  workspaceId: string;
  onComplete: (data: WhyAndCreedData) => void;
  onCancel: () => void;
}

type ReflectionStep = "why-context" | "why-answer" | "creed-context" | "creed-answer" | "review";

const REFLECTION_PROMPTS = {
  "why-context": {
    title: "What's Your Why?",
    description: "Your WHY is the transformation you want to create. Not what you do, but who you serve and what changes.",
    questions: [
      "What transformation do you want to create?",
      "Who are you really serving?",
      "What will be different in 3 years because of your work?",
    ],
  },
  "creed-context": {
    title: "What's Your Creed?",
    description: "Your CREED is your non-negotiable business principle. It's what you will NOT do, no matter what.",
    questions: [
      "What's your non-negotiable principle?",
      "What will you NOT do, even if it costs money?",
      "How will you show up in your business?",
    ],
  },
};

export function WhyAndCreedReflection({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<ReflectionStep>("why-context");
  const [why, setWhy] = useState("");
  const [creed, setCreed] = useState("");
  const [whyReflection, setWhyReflection] = useState("");
  const [creedReflection, setCreedReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleNext = async () => {
    setError("");

    if (step === "why-context" && !whyReflection.trim()) {
      setError("Take a moment to reflect on these questions");
      return;
    }
    if (step === "why-answer" && !why.trim()) {
      setError("Write your why statement");
      return;
    }
    if (step === "creed-context" && !creedReflection.trim()) {
      setError("Reflect on your creed");
      return;
    }
    if (step === "creed-answer" && !creed.trim()) {
      setError("Write your creed");
      return;
    }

    if (step === "why-context") setStep("why-answer");
    else if (step === "why-answer") setStep("creed-context");
    else if (step === "creed-context") setStep("creed-answer");
    else if (step === "creed-answer") setStep("review");
    else if (step === "review") await save();
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/command-center/why-creed", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ why, creed }),
      });

      if (!response.ok) {
        setError("Couldn't save your why & creed. Please try again.");
        setSaving(false);
        return;
      }

      const data = await response.json();
      onComplete(data);
    } catch (err) {
      setError("Network error. Please check your connection.");
      setSaving(false);
    }
  };

  const progress = {
    "why-context": 25,
    "why-answer": 40,
    "creed-context": 60,
    "creed-answer": 75,
    "review": 90,
  };

  return (
    <div className="wacr-root">
      <style>{css}</style>

      {/* Progress bar */}
      <div className="wacr-progress">
        <div className="wacr-progress-bar" style={{ width: `${progress[step]}%` }} />
      </div>

      {/* Step content */}
      <div className="wacr-content">
        {step === "why-context" && (
          <div className="wacr-step">
            <div className="wacr-step-header">
              <h2>{REFLECTION_PROMPTS["why-context"].title}</h2>
              <p>{REFLECTION_PROMPTS["why-context"].description}</p>
            </div>
            <div className="wacr-reflection-box">
              <p className="wacr-label">Take a moment to reflect on these questions:</p>
              <ul className="wacr-questions">
                {REFLECTION_PROMPTS["why-context"].questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <textarea
                className="wacr-textarea"
                placeholder="Write what comes to mind... no need to be perfect"
                value={whyReflection}
                onChange={(e) => setWhyReflection(e.target.value)}
                rows={5}
              />
            </div>
          </div>
        )}

        {step === "why-answer" && (
          <div className="wacr-step">
            <div className="wacr-step-header">
              <h2>Your Why Statement</h2>
              <p>Now, distill your reflection into one clear statement. This is what you'll see every day.</p>
            </div>
            <textarea
              className="wacr-textarea wacr-textarea-why"
              placeholder="e.g., 'Transform 100 struggling businesses in 3 years'"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={3}
            />
            <div className="wacr-preview">
              <p className="wacr-preview-label">Preview on your dashboard:</p>
              <div className="wacr-preview-card">
                <p className="wacr-preview-why">🎯 {why || "Your why will appear here"}</p>
              </div>
            </div>
          </div>
        )}

        {step === "creed-context" && (
          <div className="wacr-step">
            <div className="wacr-step-header">
              <h2>{REFLECTION_PROMPTS["creed-context"].title}</h2>
              <p>{REFLECTION_PROMPTS["creed-context"].description}</p>
            </div>
            <div className="wacr-reflection-box">
              <p className="wacr-label">Reflect on your boundaries and principles:</p>
              <ul className="wacr-questions">
                {REFLECTION_PROMPTS["creed-context"].questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <textarea
                className="wacr-textarea"
                placeholder="Write what comes to mind..."
                value={creedReflection}
                onChange={(e) => setCreedReflection(e.target.value)}
                rows={5}
              />
            </div>
          </div>
        )}

        {step === "creed-answer" && (
          <div className="wacr-step">
            <div className="wacr-step-header">
              <h2>Your Creed</h2>
              <p>Express your commitment in one clear statement. This guides every decision.</p>
            </div>
            <textarea
              className="wacr-textarea wacr-textarea-creed"
              placeholder="e.g., 'Systems don't scale. People do. Build the team.'"
              value={creed}
              onChange={(e) => setCreed(e.target.value)}
              rows={3}
            />
            <div className="wacr-preview">
              <p className="wacr-preview-label">Preview on your dashboard:</p>
              <div className="wacr-preview-card">
                <p className="wacr-preview-why">🎯 {why || "Your why"}</p>
                <p className="wacr-preview-creed">⚡ {creed || "Your creed will appear here"}</p>
              </div>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="wacr-step">
            <div className="wacr-step-header">
              <h2>Ready?</h2>
              <p>This is your emotional north star. You'll see it every time you log in.</p>
            </div>
            <div className="wacr-review">
              <div className="wacr-review-card">
                <p className="wacr-review-label">Your Why</p>
                <p className="wacr-review-text">{why}</p>
              </div>
              <div className="wacr-review-card">
                <p className="wacr-review-label">Your Creed</p>
                <p className="wacr-review-text">{creed}</p>
              </div>
              <p className="wacr-review-note">
                💡 You can edit these anytime. Your why & creed can evolve as your business grows.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="wacr-error">{error}</div>}

        {/* Actions */}
        <div className="wacr-actions">
          <button className="wacr-btn secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="wacr-btn primary"
            onClick={handleNext}
            disabled={saving}
          >
            {step === "review" ? (saving ? "Saving..." : "Save & continue") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

const css = `
.wacr-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.wacr-progress {
  height: 6px;
  background: var(--ds-surface-subtle);
  border-radius: 3px;
  overflow: hidden;
}

.wacr-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #a855f7, #ec4899);
  transition: width 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
}

.wacr-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.wacr-step {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wacr-step-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wacr-step-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--ds-text-primary);
  margin: 0;
}

.wacr-step-header p {
  font-size: 14px;
  color: var(--ds-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.wacr-reflection-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--ds-surface-subtle);
  border-radius: 8px;
  border: 1px solid var(--ds-border-subtle);
}

.wacr-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ds-text-secondary);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.wacr-questions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wacr-questions li {
  font-size: 13px;
  color: var(--ds-text-secondary);
  line-height: 1.5;
  padding-left: 20px;
  position: relative;
}

.wacr-questions li::before {
  content: "→";
  position: absolute;
  left: 0;
  color: var(--ds-brand);
  font-weight: 700;
}

.wacr-textarea {
  padding: 12px;
  border: 1px solid var(--ds-border-default);
  border-radius: 6px;
  background: var(--ds-surface);
  color: var(--ds-text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  transition: border-color 0.2s;
}

.wacr-textarea:focus {
  outline: none;
  border-color: var(--ds-brand);
  box-shadow: 0 0 0 3px var(--ds-brand-soft);
}

.wacr-textarea-why,
.wacr-textarea-creed {
  font-size: 16px;
  font-weight: 600;
}

.wacr-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wacr-preview-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ds-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.wacr-preview-card {
  padding: 16px;
  background: linear-gradient(135deg, #2563eb, #a855f7, #ec4899);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: white;
}

.wacr-preview-why {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  line-height: 1.4;
}

.wacr-preview-creed {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  opacity: 0.94;
  line-height: 1.4;
}

.wacr-review {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wacr-review-card {
  padding: 16px;
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-default);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wacr-review-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-brand);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.wacr-review-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--ds-text-primary);
  margin: 0;
  line-height: 1.5;
}

.wacr-review-note {
  font-size: 13px;
  color: var(--ds-text-secondary);
  line-height: 1.5;
  margin: 8px 0 0;
  padding: 12px;
  background: var(--ds-info-soft);
  border-radius: 6px;
  border-left: 3px solid var(--ds-info);
}

.wacr-error {
  padding: 12px;
  background: var(--ds-danger-soft);
  border: 1px solid var(--ds-danger);
  border-left: 3px solid var(--ds-danger);
  border-radius: 6px;
  color: var(--ds-danger);
  font-size: 13px;
  font-weight: 500;
}

.wacr-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--ds-border-subtle);
}

.wacr-btn {
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.wacr-btn.primary {
  background: var(--ds-brand);
  color: white;
}

.wacr-btn.primary:hover:not(:disabled) {
  background: var(--ds-brand-hover);
  transform: translateY(-1px);
}

.wacr-btn.secondary {
  background: var(--ds-surface);
  color: var(--ds-text-primary);
  border: 1px solid var(--ds-border-default);
}

.wacr-btn.secondary:hover:not(:disabled) {
  border-color: var(--ds-border-strong);
  background: var(--ds-surface-subtle);
}

.wacr-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .wacr-progress-bar {
    transition: none;
  }
  .wacr-btn {
    transition: none;
  }
}
`;
