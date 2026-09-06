"use client";

import { useState, useEffect } from "react";
import { PencilSquareIcon as EditIcon, ArrowDownTrayIcon as SaveIcon, XMarkIcon as XIcon } from "@heroicons/react/24/outline";
import { WhyAndCreedReflection } from "./WhyAndCreedReflection";

export interface WhyAndCreedData {
  workspaceId: string;
  why: string; // "Why are you doing this business?"
  creed: string; // Personal commitment/values statement
  lastUpdated?: string;
}

interface WhyAndCreedSectionProps {
  workspaceId: string;
  data?: WhyAndCreedData | null;
  onUpdate?: (data: WhyAndCreedData) => void;
}

/**
 * WhyAndCreedSection
 *
 * Displays a user's "Why" (purpose) and "Creed" (commitment) prominently on the dashboard.
 * Creates emotional energy and motivation for business work.
 *
 * Features:
 * - Beautiful, inspiring design with gradient backgrounds
 * - Large, readable text that captures attention
 * - Edit mode for updating why/creed
 * - Dark mode support
 * - Animated entrance
 */
export function WhyAndCreedSection({
  workspaceId,
  data,
  onUpdate,
}: WhyAndCreedSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editWhy, setEditWhy] = useState(data?.why || "");
  const [editCreed, setEditCreed] = useState(data?.creed || "");
  const [isSaving, setIsSaving] = useState(false);
  const [localData, setLocalData] = useState(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const isEmpty = !localData?.why && !localData?.creed;
  const [showReflection, setShowReflection] = useState(false);

  const handleReflectionComplete = (data: WhyAndCreedData) => {
    setLocalData(data);
    onUpdate?.(data);
    setShowReflection(false);
  };

  const handleSave = async () => {
    if (!editWhy.trim() && !editCreed.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/why-creed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          why: editWhy,
          creed: editCreed,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setLocalData(updated);
        onUpdate?.(updated);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to save why/creed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditWhy(data?.why || "");
    setEditCreed(data?.creed || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-2xl p-8 border border-blue-200 dark:border-blue-800 shadow-lg">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
              Why Are You Doing This?
            </h3>
            <textarea
              value={editWhy}
              onChange={(e) => setEditWhy(e.target.value)}
              placeholder="What's the deeper reason you're building this business? What impact do you want to make?"
              className="w-full min-h-24 p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
              Your Creed
            </h3>
            <textarea
              value={editCreed}
              onChange={(e) => setEditCreed(e.target.value)}
              placeholder="What values guide your work? What's your commitment to yourself and your customers?"
              className="w-full min-h-24 p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
            >
              <XIcon className="w-4 h-4 inline mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (!editWhy.trim() && !editCreed.trim())}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              <SaveIcon className="w-4 h-4 inline mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    if (showReflection) {
      return (
        <WhyAndCreedReflection
          workspaceId={workspaceId}
          onComplete={handleReflectionComplete}
          onCancel={() => setShowReflection(false)}
        />
      );
    }

    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
        <div className="text-center space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Why Are You Here?
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Connect with your deeper purpose. Start with your "Why" and define your "Creed".
            </p>
          </div>
          <button
            onClick={() => setShowReflection(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-md"
          >
            <EditIcon className="w-5 h-5" />
            Set Your Why & Creed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 dark:from-blue-700 dark:via-purple-700 dark:to-pink-700 rounded-2xl p-8 shadow-2xl border border-white/10 overflow-hidden transition-all hover:shadow-2xl">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full blur-3xl -ml-20 -mb-20 group-hover:scale-110 transition-transform duration-500" />

      <div className="relative z-10 space-y-6">
        {/* Why Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider opacity-90">
              🎯 Your Why
            </h3>
            <button
              onClick={() => {
                setEditWhy(localData?.why || "");
                setEditCreed(localData?.creed || "");
                setIsEditing(true);
              }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors opacity-0 group-hover:opacity-100"
              title="Edit why and creed"
            >
              <EditIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white leading-tight">
            {localData?.why}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/20" />

        {/* Creed Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider opacity-90">
            ⚡ Your Creed
          </h3>
          <p className="text-lg md:text-xl font-semibold text-white/95 leading-relaxed">
            {localData?.creed}
          </p>
        </div>

        {/* Energy indicator */}
        <div className="flex items-center gap-2 pt-2 opacity-75">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-white/60 animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-white/60 font-medium">
            Feeling the energy? Let's build.
          </span>
        </div>
      </div>
    </div>
  );
}
