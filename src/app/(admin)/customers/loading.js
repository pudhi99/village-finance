import { Plus, Search } from 'lucide-react';

export default function CustomersLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Title & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Directory</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage village borrower profiles, active phone numbers, and Line assignments.
          </p>
        </div>
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-700/50 text-white border border-blue-800 shadow">
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <div className="w-full h-9 pl-10 pr-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center text-sm text-slate-500">
            Search by name, phone, or customer ID (e.g. VF-CUST-...)...
          </div>
        </div>

        <div className="h-9 w-32 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
      </div>

      {/* Customers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact & Phone</th>
                <th className="py-3 px-4">Village & Area</th>
                <th className="py-3 px-4">Assigned Line</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 shrink-0 animate-pulse" />
                    <div className="space-y-1">
                      <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-slate-800/50 rounded font-mono animate-pulse" />
                    </div>
                  </td>
                  <td className="py-3.5 px-4 space-y-1">
                    <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-slate-800/50 rounded animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 space-y-1">
                    <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-slate-800/50 rounded animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-5 w-20 bg-slate-800 rounded-md animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="h-5 w-16 bg-emerald-950/80 border border-emerald-900 rounded-full mx-auto animate-pulse" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 w-8 bg-slate-800 rounded ml-auto animate-pulse" />
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
