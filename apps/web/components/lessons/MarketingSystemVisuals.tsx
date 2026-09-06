'use client';

/**
 * Marketing System Lesson — Visual Diagrams
 * Proof-of-concept for scaling visual learning across all lessons.
 *
 * Includes:
 * - Traffic Channel Comparison (cost-per-visitor)
 * - Channel ROI Analysis
 * - Budget Allocation Flow
 * - Decision Framework
 */

export function ChannelComparisonChart() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Real Channels, Real Numbers
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Each marketing channel costs differently. See where your dollar actually goes.
        </p>
      </div>

      {/* Channel Comparison */}
      <div className="space-y-4">
        {/* Instagram */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                IG
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Instagram</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Paid ads + organic</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900 dark:text-white">$6.40</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">per visitor</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-gradient-to-r from-pink-400 to-purple-500 h-2 rounded-full" style={{ width: '77%' }}></div>
          </div>
        </div>

        {/* Newsletter */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                📧
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Newsletter</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Email to list</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">$1.90</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">per visitor</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-400 to-cyan-500 h-2 rounded-full" style={{ width: '23%' }}></div>
          </div>
        </div>

        {/* Google Ads */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-yellow-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                G
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Google Ads</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Search + display</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900 dark:text-white">$3.20</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">per visitor</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-gradient-to-r from-red-400 to-yellow-500 h-2 rounded-full" style={{ width: '39%' }}></div>
          </div>
        </div>
      </div>

      {/* Key Insight */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-blue-600 dark:text-blue-400 font-bold">💡</div>
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">The Insight</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Your gut says Instagram is working. Your data says the newsletter is actually earning its budget 3.4x better. The next dollar goes where the data points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChannelFlowDiagram() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          From Traffic to Customer
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Every channel feeds the funnel. But not equally.
        </p>
      </div>

      {/* Flow Diagram */}
      <div className="space-y-3">
        {/* Stage 1: Awareness */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            1
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">Awareness</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">You reach them where they are</p>
            <div className="mt-2 flex gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">Instagram</span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Google</span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Newsletter</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="text-gray-400 dark:text-gray-600">↓</div>
        </div>

        {/* Stage 2: Traffic */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            2
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">Landing Page</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">They click. You convert (or lose them)</p>
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              💰 Cost: $1.90 - $6.40 per click
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="text-gray-400 dark:text-gray-600">↓</div>
        </div>

        {/* Stage 3: Conversion */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center text-white font-bold">
            3
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">Customer</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">They buy. Profit comes from the difference</p>
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              💵 Revenue: $500+ per customer
            </div>
          </div>
        </div>
      </div>

      {/* Decision Box */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-amber-600 dark:text-amber-400 font-bold">⚡</div>
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-100">Decision Rule</h4>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
              Which channel converts at the highest rate? Which has the lowest cost-per-visitor? The next dollar goes there.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DecisionFramework() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          How to Make the Call
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Stop guessing. Use this framework.
        </p>
      </div>

      {/* Decision Matrix */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* High Spend, High Visitors */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="text-2xl mb-2">🔴</div>
            <h4 className="font-semibold text-red-900 dark:text-red-100 text-sm mb-1">High Spend</h4>
            <p className="text-xs text-red-800 dark:text-red-200">
              Costing too much per visitor. Optimize or pause.
            </p>
          </div>

          {/* High Spend, Low Visitors */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="text-2xl mb-2">🟢</div>
            <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm mb-1">Low Cost</h4>
            <p className="text-xs text-green-800 dark:text-green-200">
              Earning its budget. Increase spend here.
            </p>
          </div>

          {/* Low Spend, High Visitors */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="text-2xl mb-2">🟡</div>
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 text-sm mb-1">Watch</h4>
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              Could work but volume is low. Monitor.
            </p>
          </div>

          {/* Low Spend, Low Visitors */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-900/10 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="text-2xl mb-2">⚪</div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">Pause</h4>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Not working. Stop and redeploy budget.
            </p>
          </div>
        </div>
      </div>

      {/* Action Box */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
        <h4 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">This Week</h4>
        <ol className="text-sm text-indigo-800 dark:text-indigo-200 space-y-1">
          <li>✓ Pull your actual spend and visitor data per channel</li>
          <li>✓ Calculate cost-per-visitor for each</li>
          <li>✓ Plot where each one lands in the framework</li>
          <li>✓ Reallocate budget to the green zone</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * Master component — include all visuals in the lesson
 */
export function MarketingSystemLessonVisuals() {
  return (
    <div className="space-y-8">
      <ChannelComparisonChart />
      <hr className="border-gray-200 dark:border-gray-800" />
      <ChannelFlowDiagram />
      <hr className="border-gray-200 dark:border-gray-800" />
      <DecisionFramework />
    </div>
  );
}
