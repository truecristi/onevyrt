/**
 * VisualExportExample.tsx
 *
 * Example component demonstrating how to use the VisualsExportUtility
 * for exporting lesson visuals in various formats.
 */

'use client';

import { useRef, useState } from 'react';
import {
  useExportVisual,
  VisualElement,
  ExportPresets,
} from '@/lib/visuals-export-utility';

export function VisualExportExample() {
  const visualRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { exportSingle, exportMultiple, printVisual, isExporting, error, progress, clearError } =
    useExportVisual();

  const [darkMode, setDarkMode] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'pdf'>('png');

  // Export single visual as PNG
  const handleExportPNG = async () => {
    if (!visualRef.current) return;

    const result = await exportSingle(visualRef.current, {
      format: 'png',
      darkMode,
      scale: darkMode ? 2 : 1.5,
      quality: 0.95,
    });

    if (!result.success) {
      alert(result.message);
    }
  };

  // Export single visual as PDF
  const handleExportPDF = async () => {
    if (!visualRef.current) return;

    const result = await exportSingle(visualRef.current, {
      format: 'pdf',
      darkMode,
    });

    if (!result.success) {
      alert(result.message);
    }
  };

  // Export SVG visual
  const handleExportSVG = async () => {
    if (!svgRef.current) return;

    const result = await exportSingle(svgRef.current, {
      format: 'png',
      darkMode,
      scale: 2,
    });

    if (!result.success) {
      alert(result.message);
    }
  };

  // Export multiple visuals as bundle
  const handleExportBundle = async () => {
    if (!visualRef.current || !svgRef.current) return;

    const visuals: VisualElement[] = [
      { id: 'main-visual', element: visualRef.current, title: 'Main Lesson Visual' },
      { id: 'diagram', element: svgRef.current, title: 'Process Diagram' },
    ];

    const result = await exportMultiple(visuals, {
      format: selectedFormat,
      darkMode,
    });

    if (!result.success) {
      alert(result.message);
    }
  };

  // Print visual
  const handlePrint = () => {
    if (visualRef.current) {
      printVisual(visualRef.current);
    }
  };

  // Export using preset
  const handleExportDarkMode = async () => {
    if (!visualRef.current) return;

    try {
      const blob = await ExportPresets.darkModePNG(visualRef.current);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `visual-dark-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Visual Export Example</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Demonstrates all export capabilities: PNG, PDF, print, and bundles.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Dark Mode Export</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportPNG}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export as PNG'}
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Export as PDF
          </button>

          <button
            onClick={handleExportSVG}
            disabled={isExporting}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Export SVG
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Print
          </button>

          <button
            onClick={handleExportDarkMode}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Dark Mode Preset
          </button>
        </div>

        {/* Format selector for bundle export */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Bundle Format:</label>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as 'png' | 'pdf')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
          >
            <option value="png">PNG</option>
            <option value="pdf">PDF</option>
          </select>
          <button
            onClick={handleExportBundle}
            disabled={isExporting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Export Bundle
          </button>
        </div>

        {/* Progress bar */}
        {isExporting && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Visual to export - HTML Element */}
      <div
        ref={visualRef}
        id="export-target"
        className={`p-8 rounded-lg border-2 border-dashed transition-colors ${
          darkMode
            ? 'bg-gray-900 border-gray-700 text-white'
            : 'bg-white border-gray-300 text-gray-900'
        }`}
      >
        <h2 className="text-2xl font-bold mb-4">Lesson Concept Diagram</h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`p-4 rounded-lg ${
                darkMode
                  ? 'bg-gray-800 border border-gray-700'
                  : 'bg-gray-100 border border-gray-300'
              }`}
            >
              <div className="font-bold mb-2">Concept {i}</div>
              <p className="text-sm">This represents key concept {i} in the lesson.</p>
            </div>
          ))}
        </div>

        <div
          className={`p-4 rounded-lg border-l-4 ${
            darkMode
              ? 'bg-gray-800 border-l-blue-500'
              : 'bg-blue-50 border-l-blue-600'
          }`}
        >
          <p className="font-semibold mb-2">Key Insight</p>
          <p>These three concepts work together to create a comprehensive framework.</p>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-700 text-xs opacity-60">
          Ready for export - PNG, PDF, or print
        </div>
      </div>

      {/* SVG Element to export */}
      <div>
        <h3 className="text-lg font-bold mb-4">Process Diagram (SVG)</h3>
        <svg
          ref={svgRef}
          viewBox="0 0 400 300"
          className={`w-full ${darkMode ? 'bg-gray-900' : 'bg-white'} border rounded-lg`}
        >
          {/* Background */}
          <rect
            width="400"
            height="300"
            fill={darkMode ? '#111827' : '#ffffff'}
          />

          {/* Flow steps */}
          {[
            { x: 50, label: 'Start' },
            { x: 150, label: 'Define' },
            { x: 250, label: 'Implement' },
            { x: 350, label: 'Complete' },
          ].map((step, i) => (
            <g key={i}>
              <circle
                cx={step.x}
                cy="150"
                r="30"
                fill={darkMode ? '#1e40af' : '#3b82f6'}
                stroke={darkMode ? '#60a5fa' : '#1e40af'}
                strokeWidth="2"
              />
              <text
                x={step.x}
                y={155}
                textAnchor="middle"
                fill={darkMode ? '#f3f4f6' : '#ffffff'}
                fontSize="12"
                fontWeight="bold"
              >
                {step.label}
              </text>

              {/* Arrow to next step */}
              {i < 3 && (
                <line
                  x1={step.x + 30}
                  y1="150"
                  x2={step.x + 70}
                  y2="150"
                  stroke={darkMode ? '#4b5563' : '#d1d5db'}
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              )}
            </g>
          ))}

          {/* Arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3, 0 6"
                fill={darkMode ? '#4b5563' : '#d1d5db'}
              />
            </marker>
          </defs>

          {/* Title */}
          <text
            x="200"
            y="30"
            textAnchor="middle"
            fill={darkMode ? '#f3f4f6' : '#1f2937'}
            fontSize="18"
            fontWeight="bold"
          >
            Business Growth Process
          </text>
        </svg>
      </div>

      {/* Usage Documentation */}
      <div
        className={`p-6 rounded-lg ${
          darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-gray-50 border border-gray-200'
        }`}
      >
        <h3 className="text-lg font-bold mb-4">Usage Guide</h3>

        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">1. Single Visual Export</h4>
            <code className="block bg-gray-800 dark:bg-gray-950 text-gray-100 p-2 rounded text-xs overflow-x-auto">
              {`const { exportSingle } = useExportVisual();
await exportSingle(element, {
  format: 'png',
  darkMode: true,
  scale: 2,
  quality: 0.95
});`}
            </code>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2. Multiple Visuals Bundle</h4>
            <code className="block bg-gray-800 dark:bg-gray-950 text-gray-100 p-2 rounded text-xs overflow-x-auto">
              {`const visuals = [
  { id: 'v1', element: ref1, title: 'Concept 1' },
  { id: 'v2', element: ref2, title: 'Concept 2' }
];
await exportMultiple(visuals, { format: 'pdf' });`}
            </code>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. Print Optimization</h4>
            <code className="block bg-gray-800 dark:bg-gray-950 text-gray-100 p-2 rounded text-xs overflow-x-auto">
              {`const { printVisual } = useExportVisual();
printVisual(element); // Opens native print dialog`}
            </code>
          </div>

          <div>
            <h4 className="font-semibold mb-2">4. Using Presets</h4>
            <code className="block bg-gray-800 dark:bg-gray-950 text-gray-100 p-2 rounded text-xs overflow-x-auto">
              {`const blob = await ExportPresets.darkModePNG(element);
const blob = await ExportPresets.hiResPNG(element);
const blob = await ExportPresets.mobilePNG(element);`}
            </code>
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <h4 className="font-bold text-green-900 dark:text-green-100 mb-2">✓ Supported</h4>
          <ul className="text-sm space-y-1 text-green-800 dark:text-green-200">
            <li>• PNG export (SVG + HTML)</li>
            <li>• PDF generation</li>
            <li>• Dark mode styling</li>
            <li>• Print optimization</li>
            <li>• Multiple visual bundles</li>
            <li>• High resolution export</li>
            <li>• Mobile export (1x scale)</li>
          </ul>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">⚡ Features</h4>
          <ul className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
            <li>• No external dependencies</li>
            <li>• Native Canvas & PDF APIs</li>
            <li>• Progress tracking</li>
            <li>• Error handling</li>
            <li>• Responsive sizing</li>
            <li>• Dark mode colors preserved</li>
            <li>• React hook integration</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
