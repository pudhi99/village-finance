import {
  Banknote,
  Clock,
  ArrowRightLeft,
  Receipt,
  Scale,
} from 'lucide-react';

export default function CashLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Banknote className="w-7 h-7 text-emerald-400" />
            Cash Bags & Cash Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Physical cash bag accountability, daily openings, inter-line transfers, and discrepancy reconciliations.
          </p>
        </div>

        {/* 4 Quick Actions Placeholder */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700">
            <Clock className="w-3.5 h-3.5" />
            <span>Record Opening</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Inter-Line Transfer</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700">
            <Receipt className="w-3.5 h-3.5" />
            <span>Field Expense</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700/50 text-white text-xs font-semibold rounded-lg border border-emerald-800 shadow-md">
            <Scale className="w-3.5 h-3.5" />
            <span>Reconcile Cash</span>
          </div>
        </div>
      </div>

      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium">Total Physical Cash</div>
          <div className="h-8 w-28 bg-emerald-950/80 rounded animate-pulse" />
          <div className="text-xs text-slate-400">Vault + line bags</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium">Today&apos;s Inflow (IN)</div>
          <div className="h-8 w-28 bg-blue-950/80 rounded animate-pulse" />
          <div className="text-xs text-blue-400/80">Collections + openings</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium">Today&apos;s Outflow (OUT)</div>
          <div className="h-8 w-28 bg-rose-950/80 rounded animate-pulse" />
          <div className="text-xs text-rose-400/80">Disbursements + expenses</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="text-xs text-slate-400 font-medium">Pending Approvals</div>
          <div className="h-8 w-12 bg-purple-950/80 rounded animate-pulse" />
          <div className="text-xs text-slate-400">Recon / Expense audits</div>
        </div>
      </div>

      {/* Cash Bags Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((b) => (
          <div key={b} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="h-5 w-32 bg-slate-800 rounded font-bold animate-pulse" />
                <div className="h-3 w-20 bg-slate-800/50 rounded font-mono animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-emerald-950/80 rounded-full animate-pulse" />
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">Derived Ledger Balance</span>
              <div className="h-7 w-28 bg-slate-800 rounded animate-pulse" />
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <div className="h-4 w-24 bg-slate-800/60 rounded animate-pulse" />
              <div className="h-7 w-24 bg-slate-800 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
