import {
  TrendingUp,
  Banknote,
  Wallet,
  Building2,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Top Welcome Bar & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-80 bg-slate-800/80 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-slate-800/50 rounded mt-2 animate-pulse" />
        </div>

        {/* Period Selector Skeleton */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          {['Today', '7 Days', '30 Days', 'All-Time'].map((label, i) => (
            <div
              key={i}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                i === 0 ? 'bg-blue-600/40 text-blue-200' : 'text-slate-500'
              }`}
            >
              {label}
            </div>
          ))}
          <div className="p-1.5 text-slate-600 ml-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500/60" />
          </div>
        </div>
      </div>

      {/* 4 Primary KPI Cards (2x2 Grid on Mobile, 4 Columns on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* KPI 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Period Collections</span>
            <TrendingUp className="w-4 h-4 text-emerald-500/40" />
          </div>
          <div className="h-8 w-36 bg-slate-800/90 rounded-lg animate-pulse" />
          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
            <div className="h-3 w-20 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-3 w-24 bg-emerald-950/80 rounded animate-pulse" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Physical Cash In Hand</span>
            <Banknote className="w-4 h-4 text-blue-500/40" />
          </div>
          <div className="h-8 w-36 bg-slate-800/90 rounded-lg animate-pulse" />
          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
            <div className="h-3 w-16 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-3 w-20 bg-blue-950/80 rounded animate-pulse" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Outstanding Principal</span>
            <Wallet className="w-4 h-4 text-indigo-500/40" />
          </div>
          <div className="h-8 w-36 bg-slate-800/90 rounded-lg animate-pulse" />
          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
            <div className="h-3 w-20 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-3 w-16 bg-indigo-950/80 rounded animate-pulse" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Collected Finance Charges</span>
            <Building2 className="w-4 h-4 text-purple-500/40" />
          </div>
          <div className="h-8 w-36 bg-slate-800/90 rounded-lg animate-pulse" />
          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
            <div className="h-3 w-24 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-3 w-20 bg-purple-950/80 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Collections Mode & Split */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-5 w-48 bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-56 bg-slate-800/50 rounded animate-pulse" />
            </div>
            <div className="h-4 w-24 bg-slate-800/60 rounded animate-pulse" />
          </div>

          {/* Allocation Progress Bar Skeleton */}
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex animate-pulse">
            <div className="bg-emerald-600/50 w-3/5 h-full" />
            <div className="bg-blue-600/50 w-1/4 h-full" />
            <div className="bg-purple-600/50 w-3/20 h-full" />
          </div>

          {/* Method Chips */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Cash', color: 'bg-emerald-500/40' },
              { label: 'UPI', color: 'bg-blue-500/40' },
              { label: 'Bank', color: 'bg-purple-500/40' },
            ].map((m, i) => (
              <div key={i} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                  <span>{m.label}</span>
                </div>
                <div className="h-5 w-20 bg-slate-800 rounded animate-pulse" />
                <div className="h-3 w-12 bg-slate-800/50 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Lines Breakdown */}
          <div className="border-t border-slate-800/80 pt-4 space-y-2.5">
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-36 bg-slate-800/70 rounded animate-pulse" />
              <div className="h-3.5 w-24 bg-slate-800/90 rounded animate-pulse" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-48 bg-slate-800/70 rounded animate-pulse" />
              <div className="h-3.5 w-24 bg-emerald-950/80 rounded animate-pulse" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-40 bg-slate-800/70 rounded animate-pulse" />
              <div className="h-3.5 w-20 bg-blue-950/80 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Right: Portfolio Receivables & Overdue Risk */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-5 w-52 bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-60 bg-slate-800/50 rounded animate-pulse" />
            </div>
            <div className="h-4 w-20 bg-slate-800/60 rounded animate-pulse" />
          </div>

          {/* Exposure rows */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-slate-800/90 rounded animate-pulse" />
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600/40 rounded-full animate-pulse" style={{ width: `${80 - i * 20}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800/80 pt-4 flex justify-between items-center">
            <div className="h-4 w-36 bg-slate-800/70 rounded animate-pulse" />
            <div className="h-4 w-28 bg-emerald-950/80 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
