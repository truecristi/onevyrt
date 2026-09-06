"use client";

import { useCallback, useEffect, useState } from "react";

interface DailyStats {
  date: string;
  pageViews: number;
  uniqueUsers: number;
  conversions: number;
  errors: number;
}

interface PageViewStats {
  pagePath: string;
  viewCount: number;
  uniqueUsers: number;
}

interface ActionStats {
  actionName: string;
  actionType: string;
  count: number;
  uniqueUsers: number;
}

interface ConversionStats {
  conversionType: string;
  conversionName: string;
  count: number;
  uniqueUsers: number;
  totalRevenue: number;
  avgRevenue: number;
}

interface ErrorStats {
  errorType: string;
  errorMessage: string;
  count: number;
  severity: string;
  lastOccurred: string;
}

interface PerformanceStats {
  metricName: string;
  metricType: string;
  avgValueMs: number;
  minValueMs: number;
  maxValueMs: number;
  p95ValueMs: number;
  sampleCount: number;
}

interface AnalyticsDashboard {
  windowDays: number;
  summary: {
    totalPageViews: number;
    totalUniqueUsers: number;
    totalConversions: number;
    totalErrors: number;
  };
  dailyStats: DailyStats[];
  pageViewStats: PageViewStats[];
  userActionStats: ActionStats[];
  conversionStats: ConversionStats[];
  errorStats: ErrorStats[];
  performanceStats: PerformanceStats[];
}

const Chart = ({
  title,
  data,
}: {
  title: string;
  data: { x: string; y: number }[];
  type?: "line" | "bar";
}) => {
  if (data.length === 0) {
    return <div className="p-4 text-gray-500">No data available</div>;
  }

  const maxY = Math.max(...data.map((d) => d.y));
  const height = 200;

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-white">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="flex gap-1 h-[200px] items-end">
        {data.map((point, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-blue-500 rounded-t"
              style={{
                height: `${(point.y / maxY) * height}px`,
                minHeight: point.y > 0 ? "2px" : "0px",
              }}
              title={`${point.x}: ${point.y}`}
            />
            {idx % Math.max(1, Math.floor(data.length / 5)) === 0 && (
              <span className="text-xs text-gray-500 text-center w-full truncate">
                {point.x}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  change,
}: {
  title: string;
  value: number | string;
  change?: number;
}) => (
  <div className="p-4 border border-gray-200 rounded-lg bg-white">
    <p className="text-sm text-gray-600">{title}</p>
    <p className="text-2xl font-bold mt-2">{value.toLocaleString()}</p>
    {change !== undefined && (
      <p className={`text-sm mt-1 ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
        {change >= 0 ? "+" : ""}{change}%
      </p>
    )}
  </div>
);

const Table = ({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}) => (
  <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
    <div className="p-4 border-b border-gray-200">
      <h3 className="font-semibold">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 text-left font-medium text-gray-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={`px-4 py-2 ${
                    cellIdx === 0 ? "font-medium text-gray-900" : "text-gray-600"
                  }`}
                >
                  {typeof cell === "number" ? cell.toLocaleString() : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/dashboard?windowDays=${windowDays}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-gray-500">No data available</div>;
  }

  const dailyChartData = data.dailyStats.map((d) => ({
    x: d.date.split("-").slice(1).join("-"),
    y: d.pageViews,
  }));

  const conversionChartData = data.dailyStats.map((d) => ({
    x: d.date.split("-").slice(1).join("-"),
    y: d.conversions,
  }));

  const errorChartData = data.dailyStats.map((d) => ({
    x: d.date.split("-").slice(1).join("-"),
    y: d.errors,
  }));

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex gap-4">
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Page Views" value={data.summary.totalPageViews} />
        <StatCard title="Unique Users" value={data.summary.totalUniqueUsers} />
        <StatCard title="Total Conversions" value={data.summary.totalConversions} />
        <StatCard title="Total Errors" value={data.summary.totalErrors} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Chart title="Daily Page Views" data={dailyChartData} />
        <Chart title="Daily Conversions" data={conversionChartData} />
        <Chart title="Daily Errors" data={errorChartData} />
        <Chart
          title="Users Over Time"
          data={data.dailyStats.map((d) => ({
            x: d.date.split("-").slice(1).join("-"),
            y: d.uniqueUsers,
          }))}
        />
      </div>

      {/* Page Views Table */}
      <Table
        title="Top Pages"
        columns={["Page", "Views", "Unique Users"]}
        rows={data.pageViewStats.map((p) => [
          p.pagePath,
          p.viewCount,
          p.uniqueUsers,
        ])}
      />

      {/* User Actions Table */}
      <Table
        title="Top User Actions"
        columns={["Action", "Type", "Count", "Unique Users"]}
        rows={data.userActionStats.map((a) => [
          a.actionName,
          a.actionType,
          a.count,
          a.uniqueUsers,
        ])}
      />

      {/* Conversions Table */}
      <Table
        title="Conversions"
        columns={[
          "Type",
          "Name",
          "Count",
          "Unique Users",
          "Total Revenue",
          "Avg Revenue",
        ]}
        rows={data.conversionStats.map((c) => [
          c.conversionType,
          c.conversionName,
          c.count,
          c.uniqueUsers,
          `$${c.totalRevenue.toFixed(2)}`,
          `$${c.avgRevenue.toFixed(2)}`,
        ])}
      />

      {/* Performance Metrics Table */}
      <Table
        title="Performance Metrics (Top 20)"
        columns={[
          "Metric",
          "Type",
          "Avg (ms)",
          "Min (ms)",
          "Max (ms)",
          "P95 (ms)",
          "Samples",
        ]}
        rows={data.performanceStats.map((p) => [
          p.metricName,
          p.metricType,
          p.avgValueMs,
          p.minValueMs,
          p.maxValueMs,
          p.p95ValueMs,
          p.sampleCount,
        ])}
      />

      {/* Errors Table */}
      {data.errorStats.length > 0 && (
        <Table
          title="Recent Errors"
          columns={["Type", "Message", "Count", "Severity", "Last Occurred"]}
          rows={data.errorStats.map((e) => [
            e.errorType,
            e.errorMessage.substring(0, 50),
            e.count,
            e.severity,
            new Date(e.lastOccurred).toLocaleDateString(),
          ])}
        />
      )}
    </div>
  );
}
