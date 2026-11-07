import { CreditCard, Plus, Search, Filter } from 'lucide-react';

export default function LoansLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-emerald-400" />
            Loan Accounts & Sanctions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track applications, approvals, multi-tranche disbursements, and fixed schedules.
          </p>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700/50 text-white text-sm font-semibold rounded-lg shadow-sm border border-emerald-800">
            <Plus className="w-4 h-4" />
            <span>New Loan Application</span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <div className="w-full h-10 pl-9 pr-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center text-sm text-slate-500">
              Search by loan #, customer name, ID, or phone...
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="h-10 w-36 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
            <div className="h-10 w-36 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Loan #</th>
                <th className="py-3 px-4">Borrower</th>
                <th className="py-3 px-4">Scheme</th>
                <th className="py-3 px-4 text-right">Sanctioned</th>
                <th className="py-3 px-4 text-right">Disbursed</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-mono font-medium">
                    <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 space-y-1">
                    <div className="h-4 w-36 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-slate-800/50 rounded animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 w-20 bg-slate-800 rounded ml-auto animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 w-20 bg-emerald-950/80 rounded ml-auto animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="h-5 w-20 bg-slate-800 rounded-full mx-auto animate-pulse" />
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
