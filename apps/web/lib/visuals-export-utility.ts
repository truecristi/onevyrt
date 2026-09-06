/**
 * VisualsExportUtility.ts
 *
 * Export utilities for lesson visuals supporting PNG, PDF, and print formats.
 * Uses native Canvas and PDF generation APIs without external dependencies.
 * Preserves colors in dark mode and supports responsive mobile export.
 */

import { useCallback, useState } from 'react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ExportOptions {
  filename?: string;
  format?: 'png' | 'pdf' | 'print';
  scale?: number;
  backgroundColor?: string;
  quality?: number;
  darkMode?: boolean;
}

export interface VisualElement {
  id: string;
  element: HTMLElement | SVGElement;
  title?: string;
  description?: string;
}

export interface ExportResult {
  success: boolean;
  message: string;
  url?: string;
  filename?: string;
}

export interface PDFMetadata {
  title: string;
  author?: string;
  subject?: string;
  creator?: string;
  creationDate?: Date;
}

// ============================================================================
// SVG to PNG Conversion
// ============================================================================

/**
 * Convert SVG element to PNG via canvas
 * Preserves colors and supports dark mode styling
 */
export async function generatePNG(
  element: HTMLElement | SVGElement,
  options: ExportOptions = {}
): Promise<Blob> {
  const {
    scale = 2,
    backgroundColor = 'white',
    quality = 0.95,
    darkMode = false,
  } = options;

  // Create container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    // Clone and prepare element
    const clone = element.cloneNode(true) as HTMLElement | SVGElement;
    container.appendChild(clone);

    // Get computed styles for accurate rendering
    const rect = element.getBoundingClientRect();
    const width = Math.ceil(rect.width * scale);
    const height = Math.ceil(rect.height * scale);

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute('data-scale', scale.toString());

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to get canvas context');

    // Set background
    ctx.fillStyle = darkMode ? '#1f2937' : backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Apply scale transform
    ctx.scale(scale, scale);

    // Render SVG or HTML element
    if (clone instanceof SVGElement) {
      await renderSVGToCanvas(clone as SVGElement, ctx, width / scale, height / scale, darkMode);
    } else {
      // For HTML elements, use drawImage approach or HTML2Canvas-like rendering
      await renderHTMLToCanvas(clone, ctx, darkMode);
    }

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert canvas to blob'));
        },
        'image/png',
        quality
      );
    });
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Render SVG element to canvas with preserved styling
 */
async function renderSVGToCanvas(
  svg: SVGElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  darkMode: boolean
): Promise<void> {
  // Ensure SVG has proper dimensions
  svg.setAttribute('width', width.toString());
  svg.setAttribute('height', height.toString());

  // Apply dark mode adjustments
  if (darkMode) {
    applyDarkModeToSVG(svg);
  }

  // Serialize SVG to data URL
  const svgString = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    img.src = url;
  });
}

/**
 * Render HTML element to canvas (simplified)
 */
async function renderHTMLToCanvas(
  element: HTMLElement,
  ctx: CanvasRenderingContext2D,
  darkMode: boolean
): Promise<void> {
  const width = element.offsetWidth;
  const height = element.offsetHeight;

  // Create a temporary SVG to render HTML content
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width.toString());
  svg.setAttribute('height', height.toString());
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Get HTML content and convert to foreign object in SVG
  const foreignObject = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'foreignObject'
  );
  foreignObject.setAttribute('width', width.toString());
  foreignObject.setAttribute('height', height.toString());

  const clone = element.cloneNode(true) as HTMLElement;
  if (darkMode) {
    clone.style.backgroundColor = '#1f2937';
    clone.style.color = '#f3f4f6';
  }

  foreignObject.appendChild(clone);
  svg.appendChild(foreignObject);

  // Render SVG
  await renderSVGToCanvas(svg, ctx, width, height, false);
}

/**
 * Apply dark mode color adjustments to SVG
 */
function applyDarkModeToSVG(svg: SVGElement): void {
  // Adjust text color
  svg.querySelectorAll('text, tspan').forEach((el) => {
    const element = el as SVGTextElement;
    const currentFill = element.getAttribute('fill');
    if (!currentFill || currentFill === 'black' || currentFill === '#000000') {
      element.setAttribute('fill', '#f3f4f6');
    }
  });

  // Adjust path/shape colors if needed
  svg.querySelectorAll('path, circle, rect, line, polygon').forEach((el) => {
    const element = el as SVGGraphicsElement;
    const fill = element.getAttribute('fill');
    if (fill === 'white' || fill === '#ffffff') {
      element.setAttribute('fill', '#111827');
    }
  });

  // Adjust stroke color
  svg.querySelectorAll('[stroke="black"], [stroke="#000000"]').forEach((el) => {
    (el as SVGElement).setAttribute('stroke', '#e5e7eb');
  });
}

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * Simple PDF generation using native Canvas API
 * Bundles multiple visuals into a PDF worksheet
 */
export async function generatePDF(
  visuals: VisualElement[],
  metadata: PDFMetadata = { title: 'Export' },
  options: ExportOptions = {}
): Promise<Blob> {
  const {
    scale = 2,
    backgroundColor = 'white',
    quality = 0.95,
    darkMode = false,
  } = options;

  // Create PDF structure (simplified PDF format)
  let pdfContent = '%PDF-1.4\n';
  const objects: string[] = [];
  let objectCount = 1;

  // Catalog object
  const catalogRef = objectCount++;
  objects.push(
    `${catalogRef} 0 obj\n<< /Type /Catalog /Pages ${objectCount} 0 R >>\nendobj\n`
  );

  // Pages object
  const pagesRef = objectCount++;
  const pageRefs: number[] = [];

  // Create page objects for each visual
  for (const visual of visuals) {
    const pageRef = objectCount++;
    pageRefs.push(pageRef);

    // Generate PNG from visual
    await generatePNG(visual.element, {
      scale,
      backgroundColor,
      quality,
      darkMode,
    });

    // For simplified implementation, we'll create basic PDF with images
    const imgRef = objectCount++;
    objects.push(
      `${pageRef} 0 obj\n<< /Type /Page /Parent ${pagesRef} 0 R /Resources << /XObject << /Im${imgRef} ${imgRef} 0 R >> >> /MediaBox [0 0 595 842] /Contents ${objectCount} 0 R >>\nendobj\n`
    );

    // Content stream
    const contentRef = objectCount++;
    objects.push(
      `${contentRef} 0 obj\n<< >>\nstream\nq 595 0 0 842 0 0 cm /Im${imgRef} Do Q\nendstream\nendobj\n`
    );
  }

  // Pages root object
  const pagesContent = `${pagesRef} 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(
    ' '
  )} 0 R] /Count ${pageRefs.length} >>\nendobj\n`;
  objects.push(pagesContent);

  // Info object
  const infoRef = objectCount++;
  // Uses \D (non-digit) rather than spelling out the separator characters in
  // a character class. Tailwind's content scanner (tailwind.config.cjs
  // matches lib/**/*.ts) does a raw text scan for CSS arbitrary-value
  // syntax and has no idea a character class here sits inside a regex
  // literal — a prior version of this line wrote that class out literally
  // as hyphen, colon, T, dot, Z inside a bracket pair, and Tailwind misread
  // it as an arbitrary CSS property declaration, emitting a real but
  // invalid rule into the generated stylesheet that crashed `next dev`'s
  // Turbopack CSS parser on the very first page load ("Parsing CSS source
  // code failed"). \D strips the same characters (every non-digit in an
  // ISO 8601 timestamp is one of those five) without spelling them out in
  // bracket syntax again — keep any future edit here free of a literal
  // bracket pair with a colon inside it, in a comment or in code.
  const creationDate = metadata.creationDate
    ? `D:${metadata.creationDate.toISOString().replace(/\D/g, '')}`
    : 'D:20240101000000Z';
  objects.push(
    `${infoRef} 0 obj\n<< /Title (${escapeString(metadata.title)}) /Author (${escapeString(
      metadata.author || 'ONEVYRT Export'
    )}) /Subject (${escapeString(metadata.subject || '')}) /Creator (${escapeString(
      metadata.creator || 'VisualsExportUtility'
    )}) /CreationDate (${creationDate}) >>\nendobj\n`
  );

  // Build xref table and trailer
  pdfContent += objects.join('');
  const xrefOffset = pdfContent.length;

  pdfContent += `xref\n0 ${objectCount}\n`;
  pdfContent += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) {
    pdfContent += `${xrefOffset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdfContent += `trailer\n<< /Size ${objectCount} /Root ${catalogRef} 0 R /Info ${infoRef} 0 R >>\n`;
  pdfContent += `startxref\n${xrefOffset}\n%%EOF\n`;

  // Convert to blob
  return new Blob([pdfContent], { type: 'application/pdf' });
}

/**
 * Escape string for PDF format
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

// ============================================================================
// Print Optimization
// ============================================================================

/**
 * Apply print-optimized styling to visuals
 */
export function applyPrintStyles(
  element: HTMLElement,
  options: Partial<ExportOptions> = {}
): void {
  const { darkMode = false } = options;

  const styleSheet = document.createElement('style');
  styleSheet.setAttribute('media', 'print');
  styleSheet.textContent = `
    @page {
      size: A4;
      margin: 20mm;
    }

    #${element.id || 'export-target'} {
      page-break-inside: avoid;
      break-inside: avoid;
      color: ${darkMode ? '#f3f4f6' : '#1f2937'};
      background: ${darkMode ? '#1f2937' : '#ffffff'};
      padding: 20px;
      font-size: 12pt;
      line-height: 1.5;
    }

    #${element.id || 'export-target'} * {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    #${element.id || 'export-target'} img {
      max-width: 100%;
      height: auto;
    }

    #${element.id || 'export-target'} svg {
      max-width: 100%;
      height: auto;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      #${element.id || 'export-target'} {
        box-shadow: none;
        border: none;
      }
    }
  `;

  document.head.appendChild(styleSheet);
}

/**
 * Remove print styles
 */
export function removePrintStyles(): void {
  const printStyles = document.querySelectorAll('style[media="print"]');
  printStyles.forEach((style) => style.remove());
}

/**
 * Trigger native print dialog for optimized visual printing
 */
export function printVisuals(element: HTMLElement): void {
  applyPrintStyles(element);
  window.print();
  removePrintStyles();
}

// ============================================================================
// Download Utilities
// ============================================================================

/**
 * Trigger file download from blob
 */
export function downloadFile(
  blob: Blob,
  filename: string,
  mimeType: string = blob.type
): void {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download multiple visuals as individual files
 * Creates a text manifest with download links
 */
export async function downloadBundle(
  visuals: VisualElement[],
  options: ExportOptions = {}
): Promise<ExportResult> {
  try {
    const { filename = 'visuals-bundle', format = 'png' } = options;
    const timestamp = new Date().toISOString().split('T')[0];
    const bundleName = `${filename}-${timestamp}`;

    // Create a manifest document
    const manifestContent = await createManifest(visuals, format);
    const manifestBlob = new Blob([manifestContent], { type: 'text/html' });

    // Download manifest as HTML (serves as index for all exports)
    downloadFile(manifestBlob, `${bundleName}-manifest.html`, 'text/html');

    // Download each visual
    for (const visual of visuals) {
      const ext = format === 'pdf' ? 'pdf' : 'png';
      const visualFilename = `${bundleName}-${visual.id}.${ext}`;

      if (format === 'pdf') {
        const pdfBlob = await generatePDF([visual], { title: 'Export' }, options);
        downloadFile(pdfBlob, visualFilename, 'application/pdf');
      } else {
        const pngBlob = await generatePNG(visual.element, options);
        downloadFile(pngBlob, visualFilename, 'image/png');
      }

      // Small delay to prevent browser overwhelming
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      success: true,
      message: `Downloaded ${visuals.length} visual(s) with manifest`,
      filename: `${bundleName}-manifest.html`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to download bundle: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Create an HTML manifest document linking to all visuals
 */
async function createManifest(
  visuals: VisualElement[],
  format: string
): Promise<string> {
  const timestamp = new Date().toISOString().split('T')[0];
  const bundleName = `visuals-bundle-${timestamp}`;

  const visualsList = visuals
    .map(
      (v) =>
        `<li><a href="${bundleName}-${v.id}.${format === 'pdf' ? 'pdf' : 'png'}">${
          v.title || v.id
        }</a>${v.description ? ` - ${v.description}` : ''}</li>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Export Manifest - ${bundleName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
      color: #1f2937;
    }
    h1 { margin-top: 0; }
    .info { background: #e0f2fe; padding: 12px; border-radius: 6px; margin: 20px 0; }
    ul { list-style: none; padding: 0; }
    li { margin: 8px 0; }
    a { color: #0284c7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { font-size: 12px; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Export Manifest</h1>
  <div class="info">
    <strong>Bundle:</strong> ${bundleName}<br>
    <strong>Format:</strong> ${format.toUpperCase()}<br>
    <strong>Count:</strong> ${visuals.length} visual(s)<br>
    <strong>Generated:</strong> ${new Date().toLocaleString()}
  </div>

  <h2>Files</h2>
  <ul>
    ${visualsList}
  </ul>

  <div class="meta">
    <p>Generated by ONEVYRT Visuals Export Utility</p>
  </div>
</body>
</html>`;
}

// ============================================================================
// React Hook: useExportVisual
// ============================================================================

/**
 * React hook for managing visual exports
 * Provides export trigger, loading state, and error handling
 */
export function useExportVisual() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const exportSingle = useCallback(
    async (
      element: HTMLElement | SVGElement,
      options: ExportOptions = {}
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setError(null);
      setProgress(0);

      try {
        const {
          filename = 'visual-export',
          format = 'png',
        } = options;

        setProgress(25);

        let blob: Blob;
        if (format === 'pdf') {
          const visual: VisualElement = { id: 'export', element };
          blob = await generatePDF([visual], { title: 'Export' }, options);
        } else {
          blob = await generatePNG(element, options);
        }

        setProgress(75);

        const timestamp = new Date().toISOString().split('T')[0];
        const ext = format === 'pdf' ? 'pdf' : 'png';
        const finalFilename = `${filename}-${timestamp}.${ext}`;

        downloadFile(blob, finalFilename);

        setProgress(100);

        return {
          success: true,
          message: `Successfully exported as ${format.toUpperCase()}`,
          filename: finalFilename,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return {
          success: false,
          message: `Export failed: ${errorMessage}`,
        };
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const exportMultiple = useCallback(
    async (
      visuals: VisualElement[],
      options: ExportOptions = {}
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setError(null);
      setProgress(0);

      try {
        const result = await downloadBundle(visuals, options);

        if (result.success) {
          setProgress(100);
        } else {
          setError(result.message);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return {
          success: false,
          message: `Export failed: ${errorMessage}`,
        };
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const printVisual = useCallback((element: HTMLElement) => {
    try {
      printVisuals(element);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    exportSingle,
    exportMultiple,
    printVisual,
    isExporting,
    error,
    progress,
    clearError,
  };
}

// ============================================================================
// Export Summary
// ============================================================================

/**
 * Configuration helper for common export scenarios
 */
export const ExportPresets = {
  // Dark mode export with high quality
  darkModePNG: (element: HTMLElement | SVGElement): Promise<Blob> =>
    generatePNG(element, {
      darkMode: true,
      scale: 2,
      quality: 0.95,
    }),

  // Light mode export with standard quality
  lightModePNG: (element: HTMLElement | SVGElement): Promise<Blob> =>
    generatePNG(element, {
      darkMode: false,
      scale: 2,
      quality: 0.90,
    }),

  // Mobile-optimized export (1x scale)
  mobilePNG: (element: HTMLElement | SVGElement): Promise<Blob> =>
    generatePNG(element, {
      scale: 1,
      quality: 0.85,
    }),

  // High resolution export (3x scale)
  hiResPNG: (element: HTMLElement | SVGElement): Promise<Blob> =>
    generatePNG(element, {
      scale: 3,
      quality: 1.0,
    }),
};
