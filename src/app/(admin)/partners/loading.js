import {
  Users,
  Building,
  Coins,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Calendar,
} from 'lucide-react';

export default function PartnersLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-400" />
            Partner Capital, Equity & Profit/Loss
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track individual partner capital accounts, effective-dated equity ratios, and formal profit distributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700">
            <Plus className="w-3.5 h-3.5" />
            <span>New Partner</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-700/50 text-white text-xs font-semibold rounded-lg border border-indigo-800 shadow">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Record Capital</span>
          </div>
        </div>
      </div>

      {/* 4 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Deployed Capital</span>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="h-8 w-32 bg-emerald-950/80 rounded animate-pulse" />
          <div className="text-xs text-slate-400">Derived across all partners</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Active Partners</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="h-8 w-12 bg-slate-800 rounded animate-pulse" />
          <div className="text-xs text-slate-400">Equity shareholders & investors</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Distributed Profit</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="h-8 w-28 bg-amber-950/80 rounded animate-pulse" />
          <div className="text-xs text-slate-400">Net operating revenue returns</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Profit Ratio Health</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-400">100.0%</span>
            <span className="text-xs text-slate-400">of 100%</span>
          </div>
          <div className="text-xs text-slate-400">✓ Equilibrium verified</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-6">
        <div className="pb-3 text-sm font-medium border-b-2 border-indigo-500 text-indigo-400 flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>Partners & Equity</span>
        </div>
        <div className="pb-3 text-sm font-medium border-b-2 border-transparent text-slate-500 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>Profit Periods & Distributions</span>
        </div>
      </div>

      {/* Partner Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2].map((p) => (
          <div key={p} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="h-5 w-36 bg-slate-800 rounded font-semibold animate-pulse" />
                <div className="h-3 w-20 bg-slate-800/50 rounded font-mono animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-emerald-950/80 rounded-full animate-pulse" />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Equity Ratio Share:</span>
                <span className="font-semibold text-white">{p === 1 ? '60.0%' : '40.0%'}</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600/70 rounded-full" style={{ width: p === 1 ? '60%' : '40%' }} />
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex justify-between items-center">
              <span className="text-xs text-slate-400">Derived Capital Balance:</span>
              <div className="h-5 w-24 bg-emerald-950/80 rounded animate-pulse" />
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <div className="h-8 w-28 bg-slate-800 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
