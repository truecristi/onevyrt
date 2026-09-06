# VisualsExportUtility

Export capability for lesson visuals with PNG, PDF, and print formats. Built with native Canvas and PDF generation APIs—no external dependencies required.

## Overview

The `VisualsExportUtility.ts` provides a complete export system for lesson visuals:

- **PNG Export**: Convert SVG and HTML elements to high-quality PNG images
- **PDF Generation**: Bundle multiple visuals into a PDF worksheet with metadata
- **Print Optimization**: Apply print-friendly styling and trigger native print dialog
- **Bundle Download**: Export multiple visuals with an HTML manifest index
- **Dark Mode Support**: Preserve colors and styling in dark mode exports
- **React Hook**: `useExportVisual` for easy integration in components
- **Responsive**: Adjustable scale for mobile, standard, and hi-resolution exports

## Installation

The utility is already in place at:
```
/apps/web/lib/visuals-export-utility.ts
```

No additional npm packages required. Uses native browser APIs:
- `Canvas API` for image rendering
- `Blob API` for file handling
- Simplified `PDF` format generation (basic PDF 1.4 structure)

## Core Functions

### generatePNG()

Convert SVG or HTML element to PNG blob.

```typescript
import { generatePNG } from '@/lib/visuals-export-utility';

const pngBlob = await generatePNG(element, {
  scale: 2,           // Pixel ratio (1 = 96dpi, 2 = 192dpi)
  darkMode: false,    // Apply dark mode colors
  backgroundColor: 'white',
  quality: 0.95       // JPEG quality (0-1)
});
```

**Parameters:**
- `element`: `HTMLElement | SVGElement` - DOM element to convert
- `options.scale`: `number` - Output scale (default: 2)
- `options.darkMode`: `boolean` - Apply dark mode styling (default: false)
- `options.backgroundColor`: `string` - Background color (default: 'white')
- `options.quality`: `number` - PNG quality 0-1 (default: 0.95)

**Returns:** `Promise<Blob>` - PNG image blob

**Example:**
```typescript
const element = document.getElementById('lesson-visual');
const pngBlob = await generatePNG(element, {
  scale: 2,
  darkMode: true,
  quality: 0.95
});

// Download
const url = URL.createObjectURL(pngBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'visual.png';
link.click();
URL.revokeObjectURL(url);
```

### generatePDF()

Generate PDF document containing multiple visuals.

```typescript
import { generatePDF, VisualElement } from '@/lib/visuals-export-utility';

const visuals: VisualElement[] = [
  { id: 'v1', element: ref1, title: 'Concept 1' },
  { id: 'v2', element: ref2, title: 'Concept 2' }
];

const pdfBlob = await generatePDF(visuals, {
  title: 'Lesson Visuals',
  author: 'Coach Name',
  subject: 'Business Growth'
}, {
  darkMode: false,
  scale: 2
});
```

**Parameters:**
- `visuals`: `VisualElement[]` - Array of visual elements with id, element, title
- `metadata`: `PDFMetadata` - Document metadata (title, author, subject, creator)
- `options`: `ExportOptions` - Export settings (scale, darkMode, quality, backgroundColor)

**PDFMetadata:**
```typescript
interface PDFMetadata {
  title: string;
  author?: string;
  subject?: string;
  creator?: string;
  creationDate?: Date;
}
```

**Returns:** `Promise<Blob>` - PDF blob

### printVisuals()

Apply print-optimized styling and trigger native print dialog.

```typescript
import { printVisuals } from '@/lib/visuals-export-utility';

const element = document.getElementById('lesson-visual');
printVisuals(element);
// Opens native browser print dialog
```

**What it does:**
1. Injects print-optimized CSS (A4 page size, margins, color preservation)
2. Opens native print dialog (`window.print()`)
3. Cleans up injected styles after print

**CSS Applied:**
- Page size: A4 (210mm × 297mm)
- Margins: 20mm
- Color preservation for dark/light modes
- Page break optimization (avoid breaks inside elements)
- Maximum image width: 100% with auto height

### downloadFile()

Direct file download from blob.

```typescript
import { downloadFile } from '@/lib/visuals-export-utility';

const blob = new Blob(['content'], { type: 'text/plain' });
downloadFile(blob, 'filename.txt', 'text/plain');
// Triggers download in browser
```

**Parameters:**
- `blob`: `Blob` - File blob to download
- `filename`: `string` - Download filename
- `mimeType`: `string` - MIME type (default: blob.type)

### downloadBundle()

Download multiple visuals as individual files with HTML manifest.

```typescript
import { downloadBundle } from '@/lib/visuals-export-utility';

const visuals: VisualElement[] = [
  { id: 'visual-1', element: ref1, title: 'Concept 1' },
  { id: 'visual-2', element: ref2, title: 'Concept 2' }
];

const result = await downloadBundle(visuals, {
  filename: 'lesson-materials',
  format: 'png',
  darkMode: false
});

if (result.success) {
  console.log(`Downloaded: ${result.filename}`);
}
```

**Returns:** `ExportResult`
```typescript
interface ExportResult {
  success: boolean;
  message: string;
  url?: string;
  filename?: string;
}
```

**Output Files:**
- `lesson-materials-2025-09-03-manifest.html` - Index with links to all exports
- `lesson-materials-2025-09-03-visual-1.png` - Individual visual
- `lesson-materials-2025-09-03-visual-2.png` - Individual visual

## React Hook: useExportVisual

Complete hook for managing exports in React components.

```typescript
import { useExportVisual } from '@/lib/visuals-export-utility';

export function MyComponent() {
  const { exportSingle, exportMultiple, printVisual, isExporting, error, progress } = useExportVisual();

  return (
    <div>
      <button onClick={() => exportSingle(ref.current, { format: 'png' })}>
        Export PNG
      </button>
      {isExporting && <div>Progress: {progress}%</div>}
      {error && <div>Error: {error}</div>}
    </div>
  );
}
```

### Hook API

```typescript
interface UseExportVisualReturn {
  // Export single visual
  exportSingle(
    element: HTMLElement | SVGElement,
    options?: ExportOptions
  ): Promise<ExportResult>;

  // Export multiple visuals as bundle
  exportMultiple(
    visuals: VisualElement[],
    options?: ExportOptions
  ): Promise<ExportResult>;

  // Print visual with native dialog
  printVisual(element: HTMLElement): void;

  // State
  isExporting: boolean;           // Export in progress
  error: string | null;           // Error message
  progress: number;               // Export progress 0-100

  // Actions
  clearError(): void;             // Clear error message
}
```

## Export Presets

Pre-configured export options for common scenarios.

```typescript
import { ExportPresets } from '@/lib/visuals-export-utility';

// Dark mode with 2x scale (high quality)
const darkBlob = await ExportPresets.darkModePNG(element);

// Light mode with standard quality
const lightBlob = await ExportPresets.lightModePNG(element);

// Mobile-optimized (1x scale, smaller file)
const mobileBlob = await ExportPresets.mobilePNG(element);

// High resolution (3x scale, best quality)
const hiResBlob = await ExportPresets.hiResPNG(element);
```

**Available Presets:**
- `darkModePNG` - Dark background, 2x scale, 0.95 quality
- `lightModePNG` - Light background, 2x scale, 0.90 quality
- `mobilePNG` - Optimized for mobile, 1x scale, 0.85 quality
- `hiResPNG` - High resolution, 3x scale, 1.0 quality

## Complete Example: Component Usage

```typescript
'use client';

import React, { useRef, useState } from 'react';
import { useExportVisual, VisualElement, ExportPresets } from '@/lib/visuals-export-utility';

export function LessonVisualPanel() {
  const visualRef = useRef<HTMLDivElement>(null);
  const { exportSingle, exportMultiple, printVisual, isExporting, error, progress } =
    useExportVisual();

  const [darkMode, setDarkMode] = useState(false);

  // Export as PNG
  const handleExportPNG = async () => {
    if (!visualRef.current) return;

    const result = await exportSingle(visualRef.current, {
      format: 'png',
      darkMode,
      scale: 2,
      quality: 0.95
    });

    if (!result.success) {
      console.error(result.message);
    }
  };

  // Export as PDF
  const handleExportPDF = async () => {
    if (!visualRef.current) return;

    const result = await exportSingle(visualRef.current, {
      format: 'pdf',
      darkMode
    });

    if (!result.success) {
      console.error(result.message);
    }
  };

  // Export high-resolution
  const handleExportHiRes = async () => {
    if (!visualRef.current) return;

    try {
      const blob = await ExportPresets.hiResPNG(visualRef.current);
      // Handle blob...
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Print
  const handlePrint = () => {
    if (visualRef.current) {
      printVisual(visualRef.current);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2">
        <button onClick={handleExportPNG} disabled={isExporting}>
          PNG
        </button>
        <button onClick={handleExportPDF} disabled={isExporting}>
          PDF
        </button>
        <button onClick={handleExportHiRes} disabled={isExporting}>
          Hi-Res
        </button>
        <button onClick={handlePrint}>
          Print
        </button>

        <label>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
          />
          Dark Mode
        </label>
      </div>

      {/* Progress */}
      {isExporting && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {error && <div className="text-red-600">{error}</div>}

      {/* Visual */}
      <div ref={visualRef} className={`p-6 rounded-lg ${
        darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Your visual content */}
        <h2 className="text-2xl font-bold mb-4">Lesson Concept</h2>
        <p>Exportable content here...</p>
      </div>
    </div>
  );
}
```

## Dark Mode Color Preservation

Dark mode export automatically:

1. **For SVG elements:**
   - Adjusts text fill to light gray (#f3f4f6)
   - Inverts shapes from white to dark (#111827)
   - Updates stroke colors to light (#e5e7eb)

2. **For HTML elements:**
   - Background: #1f2937 (dark gray)
   - Text color: #f3f4f6 (light gray)
   - Applies print-friendly contrast

3. **Canvas rendering:**
   - Background fill: #1f2937 when darkMode=true
   - All colors render at native contrast

**Example:**
```typescript
// Light mode export
const lightBlob = await generatePNG(element, { darkMode: false });

// Dark mode export with color preservation
const darkBlob = await generatePNG(element, { darkMode: true });
```

## Responsive Sizing for Mobile

Three scaling options:

```typescript
// 1x scale - Mobile optimized (smaller file, faster)
const blob = await generatePNG(element, { scale: 1 });

// 2x scale - Standard (default, balanced quality/size)
const blob = await generatePNG(element, { scale: 2 });

// 3x scale - High resolution (largest file, best detail)
const blob = await generatePNG(element, { scale: 3 });
```

**File Size Estimates:**
- 1x scale: ~50-100KB
- 2x scale: ~150-300KB
- 3x scale: ~300-600KB

(Varies with visual complexity and quality setting)

## Type Definitions

```typescript
interface ExportOptions {
  filename?: string;           // Download filename (without extension)
  format?: 'png' | 'pdf';     // Export format
  scale?: number;              // Pixel ratio for export
  backgroundColor?: string;    // Background color
  quality?: number;            // Quality 0-1
  darkMode?: boolean;          // Apply dark mode styling
}

interface VisualElement {
  id: string;                  // Unique identifier
  element: HTMLElement | SVGElement;  // DOM element
  title?: string;              // Display title
  description?: string;        // Description text
}

interface ExportResult {
  success: boolean;            // Success flag
  message: string;             // Status/error message
  url?: string;                // Blob URL (if applicable)
  filename?: string;           // Downloaded filename
}
```

## Best Practices

### 1. Use refs for stable element references
```typescript
const visualRef = useRef<HTMLDivElement>(null);
// Pass visualRef.current to export functions
```

### 2. Handle errors appropriately
```typescript
const result = await exportSingle(element);
if (!result.success) {
  // Show user-friendly error message
  showNotification(result.message);
}
```

### 3. Provide visual feedback
```typescript
{isExporting && <ProgressBar value={progress} />}
```

### 4. Use presets for common scenarios
```typescript
// Instead of specifying options every time
const blob = await ExportPresets.darkModePNG(element);
```

### 5. Clean up blob URLs
```typescript
const url = URL.createObjectURL(blob);
// Use it...
URL.revokeObjectURL(url);  // Clean up
```

### 6. Optimize for target format
```typescript
// PNG: Use for web sharing, screenshots
// PDF: Use for downloadable worksheets
// Print: Use for on-page printing
```

## Performance Considerations

- **Scale factor**: Higher scale = larger file, longer export time
- **Quality setting**: Lower quality = faster, smaller files
- **Element complexity**: Simpler SVGs render faster
- **Dark mode**: Minimal performance impact

**Typical performance:**
- Small visual (< 300px): 100-200ms
- Medium visual (300-600px): 200-500ms
- Large visual (> 600px): 500ms-1s

Use `progress` state to show export status for larger exports.

## Troubleshooting

### Export produces blank image
- Ensure element is rendered and visible
- Check for cross-origin issues (CORS)
- Verify SVG namespace attributes are correct

### Colors not preserved in dark mode
- Ensure darkMode option is set to true
- Check that element uses standard color values
- Verify SVG fill/stroke attributes exist

### PDF generation fails
- Check browser console for errors
- Ensure valid PDF metadata provided
- Verify all visual elements have valid DOM nodes

### Large file sizes
- Reduce scale factor (use 1 or 1.5 instead of 3)
- Lower quality setting (0.8 instead of 0.95)
- Simplify visual complexity

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 13+)
- **Mobile Safari**: Partial (limited PDF support)

Canvas API and Blob support required (available in all modern browsers).

## Files

- `lib/visuals-export-utility.ts` - Main utility module
- `components/examples/VisualExportExample.tsx` - Complete example component
- `lib/VISUALS_EXPORT_README.md` - This documentation

## Integration Checklist

- [ ] Import utility in your component
- [ ] Create ref to visual element
- [ ] Use `useExportVisual` hook
- [ ] Add export buttons to UI
- [ ] Handle export results and errors
- [ ] Test dark mode export
- [ ] Verify file downloads work
- [ ] Test print functionality
- [ ] Check mobile export sizing

## Next Steps

1. **Integrate into lesson components:**
   - Add export buttons to lesson views
   - Connect to curriculum export workflows

2. **Add to worksheets:**
   - Bundle visuals into lesson PDF workbooks
   - Include in transformation reports

3. **Coaching integration:**
   - Enable coaches to export student work
   - Generate visual submission proofs

4. **Analytics:**
   - Track export usage
   - Monitor format preferences

---

**Created:** September 2025  
**Status:** Ready to use - No external dependencies required  
**Maintenance:** Update color schemes as design system evolves
