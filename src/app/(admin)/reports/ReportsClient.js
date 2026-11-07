'use client';

import { useState } from 'react';
import {
  Download,
  Filter,
  FileText,
  CreditCard,
  Calendar,
  Banknote,
  Send,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { formatPaise as formatINR } from '@/lib/money';
import {
  getPaymentAllocationReport,
  getLoanPortfolioReport,
  getInstallmentDueReport,
  getCashReconciliationReport,
  getDisbursementRegisterReport,
  exportReportData,
} from '@/features/reports/server-actions';

export default function ReportsClient({ lines, initialAllocationReport, profile }) {
  const [activeTab, setActiveTab] = useState('PAYMENT_ALLOCATION');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  // Filters
  const [lineId, setLineId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');

  // Report Data
  const [allocationReport, setAllocationReport] = useState(initialAllocationReport);
  const [portfolioReport, setPortfolioReport] = useState(null);
  const [installmentReport, setInstallmentReport] = useState(null);
  const [reconciliationReport, setReconciliationReport] = useState(null);
  const [disbursementReport, setDisbursementReport] = useState(null);

  async function loadCurrentReport(tab = activeTab) {
    setLoading(true);
    setExportSuccess(null);
    try {
      const filters = {
        ...(lineId ? { lineId } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(mode ? { mode } : {}),
        ...(status ? { status } : {}),
      };

      if (tab === 'PAYMENT_ALLOCATION') {
        const data = await getPaymentAllocationReport(filters);
        setAllocationReport(data);
      } else if (tab === 'LOAN_PORTFOLIO') {
        const data = await getLoanPortfolioReport(filters);
        setPortfolioReport(data);
      } else if (tab === 'INSTALLMENT_DUE') {
        const data = await getInstallmentDueReport(filters);
        setInstallmentReport(data);
      } else if (tab === 'CASH_RECONCILIATION') {
        const data = await getCashReconciliationReport(filters);
        setReconciliationReport(data);
      } else if (tab === 'DISBURSEMENT_REGISTER') {
        const data = await getDisbursementRegisterReport(filters);
        setDisbursementReport(data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    loadCurrentReport(tab);
  }

  async function handleExport() {
    setExporting(true);
    setExportSuccess(null);
    try {
      const filters = {
        ...(lineId ? { lineId } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(mode ? { mode } : {}),
        ...(status ? { status } : {}),
      };

      const result = await exportReportData({
        reportType: activeTab,
        filters,
        format: 'CSV',
      });

      // Trigger download in browser
      const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', result.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSuccess(`Exported ${result.rowCount} records to ${result.filename} (Audited).`);
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reports & Statements</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Strictly segregated payment allocations, portfolio health, installment schedules, and cash audits.
          </p>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Generating CSV...' : 'Export Audited CSV'}</span>
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        {[
          { id: 'PAYMENT_ALLOCATION', label: 'Payment Allocation', icon: Banknote },
          { id: 'LOAN_PORTFOLIO', label: 'Loan Portfolio', icon: CreditCard },
          { id: 'INSTALLMENT_DUE', label: 'Due & Overdue Installments', icon: Calendar },
          { id: 'CASH_RECONCILIATION', label: 'Cash Bag & Reconciliation', icon: FileText },
          { id: 'DISBURSEMENT_REGISTER', label: 'Disbursement Register', icon: Send },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-blue-500 text-blue-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filters:</span>
        </div>

        {/* Line Scope Dropdown */}
        <select
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Lines (Accessible)</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.code})
            </option>
          ))}
        </select>

        {/* Date Inputs */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-slate-500 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Mode filter for allocations */}
        {activeTab === 'PAYMENT_ALLOCATION' && (
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Payment Modes</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        )}

        {/* Status filter for portfolio & installments */}
        {(activeTab === 'LOAN_PORTFOLIO' || activeTab === 'INSTALLMENT_DUE') && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
          </select>
        )}

        <button
          onClick={() => loadCurrentReport()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Apply Filters</span>
        </button>
      </div>

      {/* Tab 1: Payment Allocation */}
      {activeTab === 'PAYMENT_ALLOCATION' && (
        <div className="space-y-4">
          {/* Summary Chips */}
          {allocationReport?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-slate-400 block font-medium">Total Collected</span>
                <span className="text-lg font-bold text-white mt-1 block">
                  {formatINR(allocationReport.summary.totalPaise)}
                </span>
                <span className="text-[11px] text-slate-500">
                  {allocationReport.summary.count} payments
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-emerald-400 block font-medium">Cash Collected</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block">
                  {formatINR(allocationReport.summary.cashPaise)}
                </span>
                <span className="text-[11px] text-slate-500">In Physical Bags</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-blue-400 block font-medium">UPI Inflows</span>
                <span className="text-lg font-bold text-blue-400 mt-1 block">
                  {formatINR(allocationReport.summary.upiPaise)}
                </span>
                <span className="text-[11px] text-slate-500">Direct Digital</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-purple-400 block font-medium">Bank Transfers</span>
                <span className="text-lg font-bold text-purple-400 mt-1 block">
                  {formatINR(allocationReport.summary.bankPaise)}
                </span>
                <span className="text-[11px] text-slate-500">NEFT / RTGS / IMPS</span>
              </div>
            </div>
          )}

          {/* Allocation Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Receipt / Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Line</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Total Paid</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Finance Charge</th>
                    <th className="px-4 py-3 text-right">Advance Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!allocationReport?.rows?.length ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No payment allocation records found.
                      </td>
                    </tr>
                  ) : (
                    allocationReport.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <span className="font-mono text-blue-400 font-medium block">
                            {row.receiptNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(row.collectedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{row.customerName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{row.loanCode}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{row.lineName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{row.lineCode}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              row.mode === 'CASH'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : row.mode === 'UPI'
                                ? 'bg-blue-950 text-blue-300 border-blue-800'
                                : 'bg-purple-950 text-purple-300 border-purple-800'
                            }`}
                          >
                            {row.mode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          {formatINR(row.amountPaise)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatINR(row.principalPaidPaise)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                          {formatINR(row.financeChargePaidPaise)}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-400">
                          {row.advanceCreditPaise > 0 ? formatINR(row.advanceCreditPaise) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Loan Portfolio */}
      {activeTab === 'LOAN_PORTFOLIO' && (
        <div className="space-y-4">
          {portfolioReport?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-slate-400 block font-medium">Sanctioned Principal</span>
                <span className="text-lg font-bold text-white mt-1 block">
                  {formatINR(portfolioReport.summary.sanctionedPaise)}
                </span>
                <span className="text-[11px] text-slate-500">{portfolioReport.summary.count} loans</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-indigo-400 block font-medium">Outstanding Principal</span>
                <span className="text-lg font-bold text-indigo-400 mt-1 block">
                  {formatINR(portfolioReport.summary.principalOutstandingPaise)}
                </span>
                <span className="text-[11px] text-slate-500">Asset Receivable</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-purple-400 block font-medium">Unearned Charges</span>
                <span className="text-lg font-bold text-purple-400 mt-1 block">
                  {formatINR(portfolioReport.summary.uncollectedFinanceChargePaise)}
                </span>
                <span className="text-[11px] text-slate-500">Scheduled to Mature</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-red-400 block font-medium">Overdue Installments</span>
                <span className="text-lg font-bold text-red-400 mt-1 block">
                  {formatINR(portfolioReport.summary.overduePaise)}
                </span>
                <span className="text-[11px] text-slate-500">At-Risk Portfolio</span>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Loan Code</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Line</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Sanctioned</th>
                    <th className="px-4 py-3 text-right">Principal Bal.</th>
                    <th className="px-4 py-3 text-right">Finance Bal.</th>
                    <th className="px-4 py-3 text-right">Total Outstanding</th>
                    <th className="px-4 py-3 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!portfolioReport?.rows?.length ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No loan portfolio records found.
                      </td>
                    </tr>
                  ) : (
                    portfolioReport.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono text-blue-400 font-medium">
                          {row.loanCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{row.customerName}</div>
                          <div className="text-[11px] text-slate-500">{row.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3">{row.lineName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatINR(row.sanctionedAmountPaise)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-indigo-400">
                          {formatINR(row.principalOutstandingPaise)}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-400">
                          {formatINR(row.financeChargeOutstandingPaise)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          {formatINR(row.totalOutstandingPaise)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.overdueAmountPaise > 0 ? (
                            <span className="text-red-400 font-bold">
                              {formatINR(row.overdueAmountPaise)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Installment Due Report */}
      {activeTab === 'INSTALLMENT_DUE' && (
        <div className="space-y-4">
          {installmentReport?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-slate-400 block font-medium">Total Scheduled Due</span>
                <span className="text-lg font-bold text-white mt-1 block">
                  {formatINR(installmentReport.summary.totalDuePaise)}
                </span>
                <span className="text-[11px] text-slate-500">{installmentReport.summary.count} installments</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-emerald-400 block font-medium">Total Received</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block">
                  {formatINR(installmentReport.summary.totalPaidPaise)}
                </span>
                <span className="text-[11px] text-slate-500">Collected</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-blue-400 block font-medium">Remaining Due</span>
                <span className="text-lg font-bold text-blue-400 mt-1 block">
                  {formatINR(installmentReport.summary.remainingPaise)}
                </span>
                <span className="text-[11px] text-slate-500">To Be Settled</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <span className="text-red-400 block font-medium">Overdue Portion</span>
                <span className="text-lg font-bold text-red-400 mt-1 block">
                  {formatINR(installmentReport.summary.overduePaise)}
                </span>
                <span className="text-[11px] text-slate-500">Past Due Date</span>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Due Date / Inst #</th>
                    <th className="px-4 py-3">Customer / Loan</th>
                    <th className="px-4 py-3">Line</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Principal Due</th>
                    <th className="px-4 py-3 text-right">Finance Due</th>
                    <th className="px-4 py-3 text-right">Total Due</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!installmentReport?.rows?.length ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No installment records found.
                      </td>
                    </tr>
                  ) : (
                    installmentReport.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">
                            {new Date(row.dueDate).toLocaleDateString()}
                          </div>
                          <div className="text-[11px] text-slate-500">Inst #{row.installmentNumber}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{row.customerName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{row.loanCode}</div>
                        </td>
                        <td className="px-4 py-3">{row.lineName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              row.status === 'OVERDUE'
                                ? 'bg-red-950 text-red-300 border-red-800'
                                : row.status === 'PAID'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatINR(row.principalDuePaise)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400">
                          {formatINR(row.financeChargeDuePaise)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          {formatINR(row.totalDuePaise)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400">
                          {formatINR(row.totalPaidPaise)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-400">
                          {formatINR(row.remainingPaise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cash Bag Reconciliations */}
      {activeTab === 'CASH_RECONCILIATION' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Reconciled At</th>
                    <th className="px-4 py-3">Cash Bag</th>
                    <th className="px-4 py-3">Line Scope</th>
                    <th className="px-4 py-3 text-right">System Expected</th>
                    <th className="px-4 py-3 text-right">Physical Count</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!reconciliationReport?.rows?.length ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No cash reconciliation records found.
                      </td>
                    </tr>
                  ) : (
                    reconciliationReport.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          {new Date(row.reconciledAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {row.cashBagName} ({row.cashBagCode})
                        </td>
                        <td className="px-4 py-3">{row.lineName}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatINR(row.systemExpectedPaise)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-white">
                          {formatINR(row.physicalCountPaise)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${
                            row.variancePaise === 0
                              ? 'text-emerald-400'
                              : row.variancePaise > 0
                              ? 'text-blue-400'
                              : 'text-red-400'
                          }`}
                        >
                          {row.variancePaise > 0 ? '+' : ''}
                          {formatINR(row.variancePaise)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              row.status === 'BALANCED' || row.status === 'MATCHED'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : row.status === 'EXCESS'
                                ? 'bg-blue-950 text-blue-300 border-blue-800'
                                : 'bg-red-950 text-red-300 border-red-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              row.approvalStatus === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}
                          >
                            {row.approvalStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Disbursements Register */}
      {activeTab === 'DISBURSEMENT_REGISTER' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Loan Code</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Line</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Disbursed Amount</th>
                    <th className="px-4 py-3">Source Bag / Account</th>
                    <th className="px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!disbursementReport?.rows?.length ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No disbursement records found.
                      </td>
                    </tr>
                  ) : (
                    disbursementReport.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(row.disbursedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-blue-400 font-medium">
                          {row.loanCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{row.customerName}</div>
                          <div className="text-[11px] text-slate-500">{row.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3">{row.lineName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {row.mode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          {formatINR(row.amountPaise)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{row.cashBagName}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{row.reference || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
