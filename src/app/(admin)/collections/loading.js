import { Compass, Plus, TrendingUp, Search } from 'lucide-react';

export default function CollectionsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Compass className="w-7 h-7 text-emerald-400" />
            Field Collection Sessions & GPS
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dispatch daily lines, manage active collection sessions, track GPS visits, and collect repayments.
          </p>
        </div>

        <div>
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700/50 text-white font-medium rounded-lg text-sm border border-emerald-800 shadow-lg shadow-emerald-950/40">
            <Plus className="w-4 h-4" />
            <span>New Collection Session</span>
          </div>
        </div>
      </div>

      {/* 4 Realistic Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>In-Progress Sessions</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 animate-ping" />
          </div>
          <div className="h-8 w-12 bg-slate-800 rounded animate-pulse" />
          <div className="text-xs text-emerald-400/80">Live in the field</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium">Planned / Pending</div>
          <div className="h-8 w-12 bg-slate-800 rounded animate-pulse" />
          <div className="text-xs text-blue-400/80">Ready for dispatch</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium">Completed Sessions</div>
          <div className="h-8 w-12 bg-slate-800 rounded animate-pulse" />
          <div className="text-xs text-slate-400">Fully closed & audited</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Collections</span>
          </div>
          <div className="h-8 w-28 bg-emerald-950/80 rounded animate-pulse" />
          <div className="text-xs text-slate-400">Across sessions</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <div className="w-full h-10 pl-9 pr-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center text-sm text-slate-500">
            Search session #, line, collector...
          </div>
        </div>

        <div className="flex gap-2">
          <div className="h-10 w-36 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="h-5 w-28 bg-slate-800 rounded font-mono animate-pulse" />
                <div className="h-3 w-20 bg-slate-800/50 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-emerald-950/80 border border-emerald-900 rounded-full animate-pulse" />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/60 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Collection Line:</span>
                <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Collector Team:</span>
                <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Collected Amount:</span>
                <div className="h-4 w-20 bg-emerald-950/80 rounded animate-pulse" />
              </div>
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
