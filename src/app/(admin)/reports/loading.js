import {
  Download,
  Filter,
  Banknote,
  CreditCard,
  Calendar,
  FileText,
  Send,
} from 'lucide-react';

export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reports & Statements</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Strictly segregated payment allocations, portfolio health, installment schedules, and cash audits.
          </p>
        </div>

        {/* Export Button Placeholder */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-700/40 text-emerald-300/60 text-xs font-semibold rounded-lg border border-emerald-800/50">
            <Download className="w-3.5 h-3.5 animate-pulse" />
            <span>Export Audited CSV</span>
          </div>
        </div>
      </div>

      {/* 5 Real Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        {[
          { label: 'Payment Allocation', icon: Banknote, active: true },
          { label: 'Loan Portfolio', icon: CreditCard, active: false },
          { label: 'Due & Overdue Installments', icon: Calendar, active: false },
          { label: 'Cash Bag & Reconciliation', icon: FileText, active: false },
          { label: 'Disbursement Register', icon: Send, active: false },
        ].map((tab, i) => {
          const Icon = tab.icon;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab.active
                  ? 'border-blue-500 text-blue-400 bg-slate-900/60'
                  : 'border-transparent text-slate-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </div>
          );
        })}
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filters:</span>
        </div>
        <div className="h-9 w-36 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-slate-950 border border-slate-800 rounded-lg animate-pulse" />
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Collections', color: 'text-emerald-400' },
          { title: 'Principal Recovered', color: 'text-white' },
          { title: 'Finance Charges Paid', color: 'text-indigo-400' },
          { title: 'Advance Credits', color: 'text-blue-400' },
        ].map((card, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{card.title}</span>
            <div className="h-7 w-28 bg-slate-800/90 rounded animate-pulse" />
            <div className="h-3 w-20 bg-slate-800/50 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Report Table Wireframe */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="h-5 w-44 bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-28 bg-slate-800/60 rounded animate-pulse" />
        </div>

        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Receipt / Date</th>
              <th className="px-4 py-3">Customer & Phone</th>
              <th className="px-4 py-3">Loan Account</th>
              <th className="px-4 py-3">Line & Collector</th>
              <th className="px-4 py-3 text-right">Amount (INR)</th>
              <th className="px-4 py-3 text-right">Principal</th>
              <th className="px-4 py-3 text-right">Finance Charge</th>
              <th className="px-4 py-3">Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {[1, 2, 3, 4, 5, 6].map((r) => (
              <tr key={r} className="hover:bg-slate-800/40">
                <td className="px-4 py-3.5 space-y-1">
                  <div className="h-4 w-24 bg-slate-800 font-mono rounded animate-pulse" />
                  <div className="h-3 w-16 bg-slate-800/50 rounded animate-pulse" />
                </td>
                <td className="px-4 py-3.5 space-y-1">
                  <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-800/50 rounded animate-pulse" />
                </td>
                <td className="px-4 py-3.5">
                  <div className="h-4 w-28 bg-slate-800 font-mono rounded animate-pulse" />
                </td>
                <td className="px-4 py-3.5 space-y-1">
                  <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-slate-800/50 rounded animate-pulse" />
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="h-4 w-20 bg-emerald-950/80 rounded ml-auto animate-pulse" />
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="h-4 w-16 bg-slate-800 rounded ml-auto animate-pulse" />
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="h-4 w-16 bg-indigo-950/80 rounded ml-auto animate-pulse" />
                </td>
                <td className="px-4 py-3.5">
                  <div className="h-5 w-14 bg-slate-800 rounded-full animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
