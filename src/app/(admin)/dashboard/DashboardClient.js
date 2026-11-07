'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Banknote,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Wallet,
  Users,
  CreditCard,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatPaise as formatINR } from '@/lib/money';
import { getDashboardMetrics } from '@/features/dashboard/server-actions';

export default function DashboardClient({ initialMetrics, profile, user }) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [loading, setLoading] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('TODAY'); // 'TODAY', 'WEEK', 'MONTH', 'ALL'

  async function handleFilterChange(range) {
    setPeriodFilter(range);
    setLoading(true);
    try {
      const now = new Date();
      let startDate = null;
      let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      if (range === 'TODAY') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      } else if (range === 'WEEK') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        startDate = d;
      } else if (range === 'MONTH') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        startDate = d;
      } else if (range === 'ALL') {
        startDate = new Date(2020, 0, 1);
      }

      const res = await getDashboardMetrics({
        startDate: startDate?.toISOString(),
        endDate: endDate.toISOString(),
      });
      setMetrics(res);
    } catch (err) {
      console.error('Failed to update dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate payment method percentage shares
  const totalPeriod = metrics.period.totalCollectedPaise || 1;
  const cashShare = Math.round((metrics.period.cashCollectionsPaise / totalPeriod) * 100);
  const upiShare = Math.round((metrics.period.upiCollectionsPaise / totalPeriod) * 100);
  const bankShare = Math.round((metrics.period.bankCollectionsPaise / totalPeriod) * 100);

  return (
    <div className="space-y-8">
      {/* Top Welcome Bar & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Financial & Operational Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Real-time portfolio receivables, physical cash bags, collection splits, and line performance.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'WEEK', label: '7 Days' },
            { id: 'MONTH', label: '30 Days' },
            { id: 'ALL', label: 'All-Time' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleFilterChange(item.id)}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                periodFilter === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => handleFilterChange(periodFilter)}
            disabled={loading}
            title="Refresh Metrics"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Discrepancy & Reconciliation Alerts Banner */}
      {metrics.reconciliationExceptions?.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-200">
                Action Required: {metrics.reconciliationExceptions.length} Cash Reconciliation Exception(s)
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                Discrepancies (Shortage/Excess) or pending manager sign-offs detected in Cash Bags.
              </p>
            </div>
          </div>
          <Link
            href="/cash"
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>Review in Cash Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Primary KPI Metrics Cards (2x2 Grid on Mobile, 4 Columns on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* KPI 1: Collections In Selected Period */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span className="truncate">Period Collections</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white truncate">
            {formatINR(metrics.period.totalCollectedPaise)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60 truncate">
            <span className="hidden sm:inline">Today&apos;s Inflow:</span>
            <span className="text-emerald-400 font-medium truncate">
              {formatINR(metrics.today.totalCollectedPaise)}
            </span>
          </div>
        </div>

        {/* KPI 2: Physical Cash In Hand */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span className="truncate">Physical Cash</span>
            <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white truncate">
            {formatINR(metrics.physicalCash.totalPhysicalCashPaise)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60 truncate">
            <span className="hidden sm:inline">Vault:</span>
            <span className="text-blue-400 font-medium truncate">
              Lines: {formatINR(metrics.physicalCash.linesCashPaise)}
            </span>
          </div>
        </div>

        {/* KPI 3: Outstanding Principal (Receivable Asset) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span className="truncate">Outstanding Principal</span>
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white truncate">
            {formatINR(metrics.portfolio.outstandingPrincipalPaise)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60 truncate">
            <span className="hidden sm:inline">Active:</span>
            <span className="text-indigo-400 font-medium truncate">{metrics.portfolio.activeLoansCount} loans</span>
          </div>
        </div>

        {/* KPI 4: Earned Finance Charges (Operating Revenue) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span className="truncate">Collected Charges</span>
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white truncate">
            {formatINR(metrics.portfolio.financeChargeCollectedPaise)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60 truncate">
            <span className="hidden sm:inline">Unearned:</span>
            <span className="text-purple-300 font-medium truncate">
              {formatINR(metrics.portfolio.uncollectedFinanceChargePaise)}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Section: Collection Breakdown & Portfolio Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Collections Mode & Split */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Payment Method Allocation</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Breakdown of collections for the selected period ({periodFilter.toLowerCase()})
              </p>
            </div>
            <Link
              href="/payments"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>View Payments</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Allocation Progress Bar */}
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${cashShare}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title={`Cash: ${cashShare}%`}
            />
            <div
              style={{ width: `${upiShare}%` }}
              className="bg-blue-500 h-full transition-all duration-500"
              title={`UPI: ${upiShare}%`}
            />
            <div
              style={{ width: `${bankShare}%` }}
              className="bg-purple-500 h-full transition-all duration-500"
              title={`Bank: ${bankShare}%`}
            />
          </div>

          {/* Method Chips */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="font-medium">Cash</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {formatINR(metrics.period.cashCollectionsPaise)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{cashShare}% share</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                <span className="font-medium">UPI</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {formatINR(metrics.period.upiCollectionsPaise)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{upiShare}% share</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                <span className="font-medium">Bank</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {formatINR(metrics.period.bankCollectionsPaise)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{bankShare}% share</div>
            </div>
          </div>

          {/* Principal Recovery vs Finance Charge Paid */}
          <div className="border-t border-slate-800/80 pt-4 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Principal Asset Recovered:</span>
              <span className="font-semibold text-white">
                {formatINR(metrics.period.principalCollectedPaise)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Finance Charge Operating Revenue:</span>
              <span className="font-semibold text-emerald-400">
                {formatINR(metrics.period.financeChargeCollectedPaise)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Customer Advance Credits Held:</span>
              <span className="font-semibold text-blue-400">
                {formatINR(metrics.period.advanceCreditPaise)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Portfolio Receivables & Overdue Risk */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Receivables & Portfolio Health</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Full lifecycle exposure across active loan agreements
              </p>
            </div>
            <Link
              href="/loans"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>View Loans</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400 font-medium">Total Receivable Exposure</div>
                <div className="text-lg font-bold text-white">
                  {formatINR(metrics.portfolio.totalReceivablePaise)}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Principal: {formatINR(metrics.portfolio.outstandingPrincipalPaise)}</div>
                <div>Unearned Charges: {formatINR(metrics.portfolio.uncollectedFinanceChargePaise)}</div>
              </div>
            </div>

            <div className="bg-red-950/20 border border-red-900/40 rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="text-xs text-red-300 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>Overdue Installments</span>
                </div>
                <div className="text-lg font-bold text-red-400">
                  {formatINR(metrics.portfolio.overdueInstallmentsPaise)}
                </div>
              </div>
              <div className="text-right text-xs text-red-400/80 font-medium">
                {metrics.portfolio.overdueCount} installment(s) late
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400 font-medium">Upcoming Installments (On-time)</div>
                <div className="text-base font-semibold text-slate-200">
                  {formatINR(metrics.portfolio.upcomingInstallmentsPaise)}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                Scheduled for future due dates
              </div>
            </div>
          </div>

          {/* Active Footprint Counters */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-center">
            <div>
              <div className="text-xs text-slate-500">Active Customers</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {metrics.portfolio.activeCustomersCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Active Loans</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {metrics.portfolio.activeLoansCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Disbursed Volume</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {formatINR(metrics.portfolio.totalDisbursedPaise)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Line-Wise Collection Performance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Line-Wise Field Performance</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Collections achieved across designated weekday collection routes.
            </p>
          </div>
          <Link
            href="/collections"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <span>Live Field Sessions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Line Name</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3 text-right">Active Loans</th>
                <th className="px-4 py-3 text-right">Payments In Period</th>
                <th className="px-4 py-3 text-right">Amount Collected</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {metrics.lineWisePerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No active collection lines configured.
                  </td>
                </tr>
              ) : (
                metrics.lineWisePerformance.map((line) => (
                  <tr key={line.lineId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">
                      <div>{line.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{line.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {line.weekday} {line.session}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-200">
                      {line.activeLoansCount}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {line.paymentsCount} payments
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {formatINR(line.collectedPaise)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/reports?lineId=${line.lineId}`}
                        className="text-blue-400 hover:text-blue-300 font-medium text-[11px]"
                      >
                        Line Report
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Bag Balances Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>Physical Cash Bags & Balances</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live balances derived from verified cash ledger inflows and outflows.
            </p>
          </div>
          <Link
            href="/cash"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <span>Manage Bags</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.physicalCash.bags.map((bag) => (
            <div
              key={bag.id}
              className={`p-4 rounded-xl border ${
                bag.isVault
                  ? 'bg-blue-950/20 border-blue-900/50'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 truncate">{bag.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    bag.isVault
                      ? 'bg-blue-900/50 text-blue-300 border border-blue-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {bag.code}
                </span>
              </div>
              <div className="text-xl font-bold text-white mt-2">
                {formatINR(bag.balancePaise)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {bag.isVault ? 'Main Vault Reserve' : 'Collector Field Bag'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
