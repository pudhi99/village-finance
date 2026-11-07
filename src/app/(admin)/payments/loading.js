import { Banknote, PlusCircle, Search } from 'lucide-react';

export default function PaymentsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Banknote className="w-7 h-7 text-emerald-400" />
            Payments & Repayment Allocations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Module 04 — Real-time FIFO installment satisfaction, component breakdown & reversal controls
          </p>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700/50 text-white font-medium rounded-lg border border-emerald-800 shadow-lg shadow-emerald-950/40">
            <PlusCircle className="w-4 h-4" />
            <span>Record Repayment</span>
          </div>
        </div>
      </div>

      {/* Filter Bar with Mode Pills */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <div className="w-full h-10 pl-9 pr-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center text-sm text-slate-500">
            Search by receipt #, customer, loan code...
          </div>
        </div>

        {/* Payment Mode Pills */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {['ALL MODES', 'CASH', 'UPI', 'BANK TRANSFER'].map((mode, idx) => (
            <div
              key={idx}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                idx === 0
                  ? 'bg-blue-600/40 text-blue-200 border border-blue-500/50'
                  : 'bg-slate-950 border border-slate-800 text-slate-500'
              }`}
            >
              {mode}
            </div>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Borrower & Loan</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
                <th className="py-3 px-4 text-right">Principal</th>
                <th className="py-3 px-4 text-right">Finance Charge</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-mono font-medium">
                    <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 space-y-1">
                    <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-slate-800/50 rounded animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 space-y-1">
                    <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-slate-800/50 rounded font-mono animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-5 w-16 bg-slate-800 rounded-md animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 w-20 bg-emerald-950/80 rounded ml-auto animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 w-16 bg-slate-800 rounded ml-auto animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 w-16 bg-indigo-950/80 rounded ml-auto animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="h-5 w-20 bg-emerald-950/80 border border-emerald-900 rounded-full mx-auto animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 w-12 bg-slate-800 rounded ml-auto animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
