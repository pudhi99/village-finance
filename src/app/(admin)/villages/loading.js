import { MapPin, Route, Plus, Search } from 'lucide-react';

export default function VillagesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <MapPin className="w-7 h-7 text-emerald-400" />
            Villages, Areas & Collection Lines
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Organize borrower geography, operational clusters, and weekly line collection schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Area</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-700/50 text-white border border-blue-800 shadow">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Village</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6">
        <div className="pb-3 text-sm font-semibold border-b-2 border-blue-500 text-blue-400 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>Villages & Areas</span>
        </div>
        <div className="pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 flex items-center gap-2">
          <Route className="w-4 h-4" />
          <span>Collection Lines</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <div className="w-full h-10 pl-10 pr-4 bg-slate-900 border border-slate-800 rounded-lg flex items-center text-sm text-slate-500">
          Search villages, districts, or areas...
        </div>
      </div>

      {/* Villages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((v) => (
          <div key={v} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="h-5 w-32 bg-slate-800 rounded font-bold animate-pulse" />
                <div className="h-3 w-24 bg-slate-800/50 rounded animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-slate-800 rounded-md font-mono animate-pulse" />
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Areas in Village:</span>
                <div className="h-3.5 w-12 bg-slate-800 rounded animate-pulse" />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Registered Borrowers:</span>
                <div className="h-3.5 w-16 bg-emerald-950/80 rounded animate-pulse" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-xs">
              <div className="h-4 w-20 bg-slate-800/60 rounded animate-pulse" />
              <div className="h-7 w-20 bg-slate-800 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
