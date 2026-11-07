'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  PieChart,
  Building,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Receipt,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function PartnerDetailsClient({ partner }) {
  const [activeTab, setActiveTab] = useState('capital'); // 'capital' | 'ratios' | 'distributions' | 'withdrawals'

  const activeRatio = partner.ratios?.find(
    (r) =>
      new Date(r.effectiveFrom) <= new Date() &&
      (!r.effectiveTo || new Date(r.effectiveTo) > new Date())
  ) || partner.ratios?.[0];

  const totalInflowPaise = partner.capitalEntries
    ?.filter((e) => ['INITIAL_CONTRIBUTION', 'ADDITIONAL_CONTRIBUTION', 'CAPITAL_ADJUSTMENT'].includes(e.entryType))
    .reduce((sum, e) => sum + e.amountPaise, 0) || 0;

  const totalOutflowPaise = partner.capitalEntries
    ?.filter((e) => e.entryType === 'CAPITAL_WITHDRAWAL')
    .reduce((sum, e) => sum + e.amountPaise, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/partners"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 mb-2 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Partners Hub
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-400" />
              {partner.name}
            </h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-semibold">
              {partner.partnerCode}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                partner.status === 'ACTIVE'
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {partner.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Joined on {new Date(partner.joinDate).toLocaleDateString()} &bull; Phone: {partner.phone || '—'} &bull; Email:{' '}
            {partner.email || '—'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Derived Capital Balance</span>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
            {formatINR(partner.capitalBalancePaise / 100)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Authoritative derived equity</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Active Profit Ratio</span>
            <PieChart className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-300 mt-2">
            {activeRatio?.profitRatio ? `${Number(activeRatio.profitRatio).toFixed(1)}%` : '0.0%'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cap: {activeRatio?.capitalRatio ? `${Number(activeRatio.capitalRatio).toFixed(1)}%` : '0%'} | Loss:{' '}
            {activeRatio?.lossRatio ? `${Number(activeRatio.lossRatio).toFixed(1)}%` : '0%'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Capital Inflow</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-200 mt-2 font-mono">
            {formatINR(totalInflowPaise / 100)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Contributions & positive adjustments</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Withdrawals</span>
            <ArrowDownLeft className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-2 font-mono">
            {formatINR(totalOutflowPaise / 100)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Paid drawings & capital reductions</p>
        </div>
      </div>

      {/* Detail Navigation Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('capital')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'capital'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          Capital Entries ({partner.capitalEntries?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('ratios')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'ratios'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Ratio History ({partner.ratios?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('distributions')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'distributions'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Profit Distributions ({partner.distributionDetails?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'withdrawals'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Withdrawals ({partner.withdrawals?.length || 0})
        </button>
      </div>

      {/* TAB 1: CAPITAL ENTRIES */}
      {activeTab === 'capital' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Capital Ledger History</h2>
            <span className="text-xs text-slate-400">
              Immutable records &bull; Derived balance reflects net contributions minus paid withdrawals
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Entry #</th>
                  <th className="py-3 px-4">Effective Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {partner.capitalEntries?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No capital transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  partner.capitalEntries?.map((entry) => {
                    const isOutflow = entry.entryType === 'CAPITAL_WITHDRAWAL';
                    return (
                      <tr key={entry.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-xs text-indigo-300">{entry.entryNumber}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(entry.effectiveDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              isOutflow
                                ? 'bg-amber-950/70 border border-amber-800 text-amber-300'
                                : 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
                            }`}
                          >
                            {entry.entryType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300">{entry.paymentMode}</td>
                        <td className="py-3 px-4 text-xs text-slate-400 font-mono">{entry.reference || '—'}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">{entry.recordedBy?.fullName || 'System'}</td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            isOutflow ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isOutflow ? '-' : '+'}
                          {formatINR(entry.amountPaise / 100)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RATIO HISTORY */}
      {activeTab === 'ratios' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white">Effective-Dated Ratio History</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Every distribution freezes the active ratio at that time. Updating ratios creates a new version with effective dating.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Effective Range</th>
                  <th className="py-3 px-4 text-right">Capital %</th>
                  <th className="py-3 px-4 text-right">Profit %</th>
                  <th className="py-3 px-4 text-right">Loss %</th>
                  <th className="py-3 px-4">Set By</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {partner.ratios?.map((ratio) => {
                  const isActive = !ratio.effectiveTo || new Date(ratio.effectiveTo) > new Date();
                  return (
                    <tr key={ratio.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 flex items-center gap-2">
                        {isActive ? (
                          <span className="px-2 py-0.5 text-xs rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                            CURRENT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400">
                            HISTORICAL
                          </span>
                        )}
                        <span className="text-xs text-slate-300">
                          {new Date(ratio.effectiveFrom).toLocaleDateString()} &rarr;{' '}
                          {ratio.effectiveTo ? new Date(ratio.effectiveTo).toLocaleDateString() : 'Present'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-200">
                        {Number(ratio.capitalRatio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                        {Number(ratio.profitRatio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-400">
                        {Number(ratio.lossRatio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{ratio.createdBy?.fullName || 'System'}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">{ratio.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROFIT DISTRIBUTIONS */}
      {activeTab === 'distributions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white">Profit Distribution Receipts</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Preserves exact immutable ratio snapshots from the date of each profit distribution.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Distribution #</th>
                  <th className="py-3 px-4">Snapshot Profit Ratio</th>
                  <th className="py-3 px-4 text-right">Allocated Share</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {partner.distributionDetails?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No profit distributions received yet.
                    </td>
                  </tr>
                ) : (
                  partner.distributionDetails?.map((detail) => (
                    <tr key={detail.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-white">
                        {detail.profitDistribution?.profitPeriod?.name || 'Period'} (
                        {detail.profitDistribution?.profitPeriod?.periodCode})
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-indigo-300">
                        {detail.profitDistribution?.distributionNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-indigo-300">
                        {Number(detail.profitRatioSnapshot).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatINR(detail.allocatedSharePaise / 100)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 text-xs rounded bg-indigo-950/70 border border-indigo-800 text-indigo-300">
                          {detail.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: WITHDRAWALS */}
      {activeTab === 'withdrawals' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white">Partner Withdrawal Requests &amp; Payouts</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rule: Partner withdrawal reduces capital strictly when marked PAID.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Withdrawal #</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Approved By</th>
                  <th className="py-3 px-4">Paid Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {partner.withdrawals?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No withdrawals recorded.
                    </td>
                  </tr>
                ) : (
                  partner.withdrawals?.map((wth) => (
                    <tr key={wth.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-xs text-indigo-300">{wth.withdrawalNumber}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {new Date(wth.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-300">
                        {wth.withdrawalType.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                            wth.status === 'PAID'
                              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                              : wth.status === 'APPROVED'
                              ? 'bg-indigo-950/70 border-indigo-800 text-indigo-300'
                              : 'bg-amber-950/70 border-amber-800 text-amber-300'
                          }`}
                        >
                          {wth.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{wth.approvedBy?.fullName || '—'}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {wth.paidAt ? new Date(wth.paidAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                        {formatINR(wth.amountPaise / 100)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
