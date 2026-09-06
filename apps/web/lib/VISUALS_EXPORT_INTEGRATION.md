# VisualsExportUtility Integration Guide for ONEVYRT

This guide shows how to integrate the visual export utilities into ONEVYRT's lesson curriculum, coaching workflows, and transformation reports.

## Quick Start

### 1. Import the Utility

```typescript
import { useExportVisual, ExportPresets } from '@/lib/visuals-export-utility';
import type { VisualElement, ExportOptions } from '@/lib/visuals-export-utility';
```

### 2. Add to Lesson Components

```typescript
// In Chapter lesson components
export function ChapterLesson() {
  const lessonVisualsRef = useRef<HTMLDivElement>(null);
  const { exportSingle, isExporting, error } = useExportVisual();

  const handleExportLesson = async () => {
    if (!lessonVisualsRef.current) return;

    const result = await exportSingle(lessonVisualsRef.current, {
      format: 'png',
      scale: 2,
      darkMode: false,
      filename: 'lesson-visual'
    });

    if (result.success) {
      // Optional: Track export in analytics
      trackEvent('lesson_visual_exported', {
        chapter: currentChapter,
        format: 'png'
      });
    }
  };

  return (
    <div>
      {/* Lesson Content */}
      <div ref={lessonVisualsRef} className="lesson-visual-container">
        {/* Exportable lesson visual */}
      </div>

      {/* Export Button */}
      <button
        onClick={handleExportLesson}
        disabled={isExporting}
        className="btn btn-primary"
      >
        {isExporting ? 'Exporting...' : 'Download Visual'}
      </button>

      {error && <Alert type="error">{error}</Alert>}
    </div>
  );
}
```

## Use Cases in ONEVYRT

### Use Case 1: Chapter Lesson Exports

Export individual lesson visuals from curriculum chapters.

**Files to modify:**
- `app/programme/[enrollmentId]/chapters/[chapterId]/page.tsx`
- `components/chapter/LessonContent.tsx`

**Implementation:**
```typescript
import { useExportVisual } from '@/lib/visuals-export-utility';

export function LessonContent({ chapterId, lessonId }) {
  const visualRef = useRef<HTMLDivElement>(null);
  const { exportSingle, printVisual, isExporting } = useExportVisual();

  return (
    <div className="space-y-4">
      {/* Lesson visual */}
      <div ref={visualRef} id={`lesson-${lessonId}`}>
        {/* Lesson content with diagrams, concepts, etc. */}
      </div>

      {/* Export controls */}
      <div className="flex gap-2">
        <button
          onClick={() => exportSingle(visualRef.current, { format: 'png' })}
          disabled={isExporting}
        >
          Save as PNG
        </button>
        <button onClick={() => printVisual(visualRef.current)}>
          Print
        </button>
      </div>
    </div>
  );
}
```

### Use Case 2: Business System Documentation

Export the Working Business System (Chapter 2) as organized visual worksheets.

**Files to modify:**
- `app/programme/[enrollmentId]/chapters/2-implement/business-system/page.tsx`

**Implementation:**
```typescript
import { useExportVisual, VisualElement } from '@/lib/visuals-export-utility';

export function BusinessSystemView() {
  const systemRefs = {
    sales: useRef<HTMLDivElement>(null),
    operations: useRef<HTMLDivElement>(null),
    team: useRef<HTMLDivElement>(null),
  };

  const { exportMultiple, isExporting, progress } = useExportVisual();

  const handleExportBusinessSystem = async () => {
    const visuals: VisualElement[] = [
      {
        id: 'sales-funnel',
        element: systemRefs.sales.current!,
        title: 'Sales Funnel',
        description: 'Customer journey from lead to client',
      },
      {
        id: 'operations',
        element: systemRefs.operations.current!,
        title: 'Operations System',
        description: 'Core business processes and workflows',
      },
      {
        id: 'team-structure',
        element: systemRefs.team.current!,
        title: 'Team Structure',
        description: 'Roles and responsibilities',
      },
    ];

    const result = await exportMultiple(visuals, {
      format: 'pdf',
      filename: 'business-system-manual',
      darkMode: false,
    });

    if (result.success) {
      // Log to activity
      logActivity('exported_business_system', {
        visuals: visuals.length,
        format: 'pdf',
      });
    }
  };

  return (
    <div className="space-y-8">
      <div ref={systemRefs.sales}>{/* Sales Funnel Diagram */}</div>
      <div ref={systemRefs.operations}>{/* Operations Diagram */}</div>
      <div ref={systemRefs.team}>{/* Team Structure Diagram */}</div>

      <button
        onClick={handleExportBusinessSystem}
        disabled={isExporting}
        className="btn btn-primary"
      >
        {isExporting ? `Exporting... ${progress}%` : 'Export System Manual'}
      </button>
    </div>
  );
}
```

### Use Case 3: Numbers & Control Dashboard Export

Export the Numbers & Control Dashboard (Chapter 3) as a printable worksheet.

**Files to modify:**
- `app/programme/[enrollmentId]/chapters/3-control/dashboard/page.tsx`

**Implementation:**
```typescript
import { useExportVisual, printVisuals } from '@/lib/visuals-export-utility';

export function ControlDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { exportSingle, printVisual, isExporting } = useExportVisual();

  const handleExportDashboard = async () => {
    const result = await exportSingle(dashboardRef.current!, {
      format: 'pdf',
      filename: 'numbers-and-control-dashboard',
      scale: 1.5,
      darkMode: false,
    });

    if (result.success) {
      trackEvent('dashboard_exported', { format: 'pdf' });
    }
  };

  const handlePrintDashboard = () => {
    // Optimizes for printing with A4 page size
    printVisual(dashboardRef.current!);
  };

  return (
    <div className="space-y-4">
      <div ref={dashboardRef} className="dashboard-container">
        {/* Dashboard with metrics, charts, KPIs */}
        {/* Include: Revenue, Margins, Conversion Rate, Customer Value, etc. */}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleExportDashboard}
          disabled={isExporting}
          className="btn btn-primary"
        >
          Download PDF
        </button>
        <button onClick={handlePrintDashboard} className="btn btn-secondary">
          Print Dashboard
        </button>
      </div>
    </div>
  );
}
```

### Use Case 4: Growth & Improvement Plan Export

Export the Growth & Improvement Plan (Chapter 4) as an organized workbook.

**Files to modify:**
- `app/programme/[enrollmentId]/chapters/4-improve/growth-plan/page.tsx`

**Implementation:**
```typescript
import { useExportVisual, VisualElement } from '@/lib/visuals-export-utility';

export function GrowthPlanView() {
  const planSections = {
    bottleneck: useRef<HTMLDivElement>(null),
    conversion: useRef<HTMLDivElement>(null),
    profit: useRef<HTMLDivElement>(null),
    systemise: useRef<HTMLDivElement>(null),
    roadmap: useRef<HTMLDivElement>(null),
  };

  const { exportMultiple, isExporting, progress } = useExportVisual();

  const handleExportGrowthPlan = async () => {
    const visuals: VisualElement[] = [
      {
        id: 'bottleneck-analysis',
        element: planSections.bottleneck.current!,
        title: 'Bottleneck Analysis',
        description: 'Primary constraint limiting growth',
      },
      {
        id: 'conversion-improvements',
        element: planSections.conversion.current!,
        title: 'Conversion Improvements',
        description: 'Lead to appointment to sale optimization',
      },
      {
        id: 'profit-optimization',
        element: planSections.profit.current!,
        title: 'Profit Optimization',
        description: 'Pricing, margins, and cost reduction',
      },
      {
        id: 'systemisation',
        element: planSections.systemise.current!,
        title: 'Systemisation Plan',
        description: 'Automation and delegation roadmap',
      },
      {
        id: 'ninety-day-roadmap',
        element: planSections.roadmap.current!,
        title: '90-Day Roadmap',
        description: 'Prioritized action plan for growth',
      },
    ];

    const result = await exportMultiple(visuals, {
      format: 'pdf',
      filename: 'growth-and-improvement-plan',
      darkMode: false,
    });

    if (result.success) {
      // Update enrollment with export timestamp
      await updateEnrollmentMetadata({
        lastGrowthPlanExport: new Date(),
      });

      // Create activity log entry
      logActivity('growth_plan_exported', {
        sections: visuals.length,
        format: 'pdf',
      });
    }
  };

  return (
    <div className="space-y-8">
      <button
        onClick={handleExportGrowthPlan}
        disabled={isExporting}
        className="btn btn-primary mb-6"
      >
        {isExporting ? `Exporting... ${progress}%` : 'Export Growth Plan'}
      </button>

      <div ref={planSections.bottleneck}>{/* Bottleneck */}</div>
      <div ref={planSections.conversion}>{/* Conversion */}</div>
      <div ref={planSections.profit}>{/* Profit */}</div>
      <div ref={planSections.systemise}>{/* Systemisation */}</div>
      <div ref={planSections.roadmap}>{/* Roadmap */}</div>
    </div>
  );
}
```

### Use Case 5: Transformation Report Export

Export the Transformation Report showing before/after progression.

**Files to modify:**
- `app/programme/[enrollmentId]/transformation-report/page.tsx`

**Implementation:**
```typescript
import { useExportVisual, VisualElement } from '@/lib/visuals-export-utility';

export function TransformationReport() {
  const reportSections = {
    summary: useRef<HTMLDivElement>(null),
    journey: useRef<HTMLDivElement>(null),
    achievements: useRef<HTMLDivElement>(null),
    metrics: useRef<HTMLDivElement>(null),
    nextSteps: useRef<HTMLDivElement>(null),
  };

  const { exportMultiple, exportSingle, printVisual, isExporting } = useExportVisual();

  const handleExportFullReport = async () => {
    const visuals: VisualElement[] = [
      {
        id: 'transformation-summary',
        element: reportSections.summary.current!,
        title: 'Executive Summary',
      },
      {
        id: 'transformation-journey',
        element: reportSections.journey.current!,
        title: 'Your Transformation Journey',
      },
      {
        id: 'key-achievements',
        element: reportSections.achievements.current!,
        title: 'Key Achievements',
      },
      {
        id: 'results-metrics',
        element: reportSections.metrics.current!,
        title: 'Results & Metrics',
      },
      {
        id: 'next-90-days',
        element: reportSections.nextSteps.current!,
        title: 'Your Next 90 Days',
      },
    ];

    const result = await exportMultiple(visuals, {
      format: 'pdf',
      filename: `transformation-report-${workspaceName}`,
      darkMode: false,
    });

    if (result.success) {
      // Email report to user
      await sendEmail({
        to: userEmail,
        subject: 'Your ONEVYRT Transformation Report',
        template: 'transformation-report-delivered',
        attachments: [result.filename],
      });
    }
  };

  const handlePrintReport = () => {
    printVisual(reportSections.summary.current!);
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-2 sticky top-0 bg-white p-4">
        <button
          onClick={handleExportFullReport}
          disabled={isExporting}
          className="btn btn-primary"
        >
          {isExporting ? 'Exporting...' : 'Download Report'}
        </button>
        <button onClick={handlePrintReport} className="btn btn-secondary">
          Print
        </button>
        <button
          onClick={() => shareReport()}
          className="btn btn-secondary"
        >
          Share
        </button>
      </div>

      <div ref={reportSections.summary}>{/* Summary */}</div>
      <div ref={reportSections.journey}>{/* Journey */}</div>
      <div ref={reportSections.achievements}>{/* Achievements */}</div>
      <div ref={reportSections.metrics}>{/* Metrics */}</div>
      <div ref={reportSections.nextSteps}>{/* Next 90 Days */}</div>
    </div>
  );
}
```

### Use Case 6: Coaching Submission Exports

Export learner submissions for coach review and approval documentation.

**Files to modify:**
- `app/api/coaching/submissions/export/route.ts`
- `components/coaching/SubmissionReview.tsx`

**Implementation:**
```typescript
// API route for batch export
export async function POST(req: Request) {
  const { enrollmentId, chapterId, format = 'pdf' } = await req.json();

  const submission = await getChapterSubmission(enrollmentId, chapterId);
  const visualElements = await renderSubmissionVisuals(submission);

  const pdfBlob = await generatePDF(visualElements, {
    title: `Chapter ${chapterId} Submission`,
    author: 'Coach Review',
    subject: `Review for ${enrollmentId}`,
  });

  return new Response(pdfBlob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="submission-${chapterId}.pdf"`,
    },
  });
}

// Component usage
export function SubmissionReview({ submission }) {
  const { exportSingle, isExporting } = useExportVisual();

  const handleExportSubmission = async () => {
    const element = document.getElementById(`submission-${submission.id}`);
    if (!element) return;

    const result = await exportSingle(element, {
      format: 'pdf',
      filename: `submission-review-${submission.id}`,
    });

    if (result.success) {
      // Log coach action
      logCoachingActivity('submission_exported', {
        submissionId: submission.id,
        coachId: currentCoach.id,
      });
    }
  };

  return (
    <div>
      <button onClick={handleExportSubmission} disabled={isExporting}>
        Export for Review
      </button>
    </div>
  );
}
```

## Dark Mode Integration

ONEVYRT supports dark mode—ensure exports preserve styling:

```typescript
// Check if user prefers dark mode
const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Or from ONEVYRT theme context
const { theme } = useTheme(); // 'dark' | 'light' | 'system'

// Export with appropriate mode
const result = await exportSingle(element, {
  darkMode: theme === 'dark' || isDarkMode,
  format: 'png'
});
```

## Analytics & Activity Logging

Track export usage:

```typescript
// In your tracking service
import { logActivity } from '@/lib/activity';

const handleExport = async (element, options) => {
  const result = await exportSingle(element, options);

  if (result.success) {
    await logActivity('visual_exported', {
      chapter: currentChapter,
      format: options.format,
      filename: result.filename,
      timestamp: new Date(),
    });
  }
};
```

## Performance Optimization

For large exports:

```typescript
// Use lower quality for faster export
const result = await exportSingle(element, {
  scale: 1,           // Mobile scale
  quality: 0.85,      // Lower quality
  format: 'png'       // PNG is faster than PDF
});

// Or use preset
const blob = await ExportPresets.mobilePNG(element);
```

## Error Handling

Implement user-friendly error recovery:

```typescript
const { error, clearError } = useExportVisual();

return (
  <div>
    {error && (
      <Alert type="error" dismissible onDismiss={clearError}>
        <p>Export failed: {error}</p>
        <button onClick={retryExport}>Try again</button>
      </Alert>
    )}
  </div>
);
```

## Testing Exports

```typescript
// In test files
import { generatePNG, generatePDF } from '@/lib/visuals-export-utility';

describe('Visual Exports', () => {
  test('exports PNG successfully', async () => {
    const element = document.createElement('div');
    element.innerHTML = '<p>Test</p>';

    const blob = await generatePNG(element);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  test('exports PDF successfully', async () => {
    const element = document.createElement('div');
    const visuals = [{ id: 'test', element, title: 'Test' }];

    const blob = await generatePDF(visuals);
    expect(blob.type).toBe('application/pdf');
  });
});
```

## Deployment Checklist

- [ ] Add export buttons to all lesson components
- [ ] Test dark mode exports
- [ ] Verify PDF generation in production
- [ ] Test print functionality across browsers
- [ ] Add analytics tracking for exports
- [ ] Create user documentation for export features
- [ ] Test on mobile devices
- [ ] Verify file download works on all platforms
- [ ] Test bundle exports with multiple visuals
- [ ] Performance test with large visuals

## Configuration

No configuration needed—utility works with defaults. Optional customizations:

```typescript
// In your app configuration
export const EXPORT_CONFIG = {
  DEFAULT_SCALE: 2,
  DEFAULT_QUALITY: 0.95,
  DEFAULT_FORMAT: 'png' as const,
  BUNDLE_DELAY_MS: 100,
  MAX_CONCURRENT_EXPORTS: 1,
};
```

## Next Steps

1. **Immediate:** Integrate into Chapter 1 lessons
2. **Week 1:** Add to Business System (Chapter 2)
3. **Week 2:** Add to Dashboard (Chapter 3)
4. **Week 3:** Add to Growth Plan (Chapter 4)
5. **Week 4:** Add Transformation Report
6. **Week 5:** Enable coaching exports
7. **Week 6:** Add to community/templates

## Support

For issues or questions:
- Check `VISUALS_EXPORT_README.md` for technical details
- Review example component: `VisualExportExample.tsx`
- See browser console for detailed error messages

---

**Integration Status:** Ready to implement  
**Next Review:** After first 10 exports in production  
**Maintenance:** Monthly audit of export quality and performance
