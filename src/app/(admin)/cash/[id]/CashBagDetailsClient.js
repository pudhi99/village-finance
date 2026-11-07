'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/money';
import {
  recordReconciliation,
  approveReconciliation,
  approveExpense,
  recordExpense,
} from '@/features/cash/server-actions';
import {
  Banknote,
  ArrowLeft,
  Scale,
  Receipt,
  Clock,
  Layers,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Calculator,
} from 'lucide-react';

export default function CashBagDetailsClient({
  bag,
  entries = [],
  totalEntries = 0,
  allBags = [],
  categories = [],
  profile = {},
  user = {},
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active Tab: 'LEDGER' | 'RECON' | 'EXPENSES'
  const [activeTab, setActiveTab] = useState('LEDGER');

  // Ledger Filter & Search
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Alerts
  const [feedback, setFeedback] = useState(null);

  // Denomination Counter State
  const [denominations, setDenominations] = useState({
    500: '',
    200: '',
    100: '',
    50: '',
    20: '',
    10: '',
    coins: '',
  });
  const [reconReason, setReconReason] = useState('');

  // Calculate physical total from denominations
  const countedPhysicalRupees = useMemo(() => {
    let total = 0;
    total += (parseInt(denominations[500]) || 0) * 500;
    total += (parseInt(denominations[200]) || 0) * 200;
    total += (parseInt(denominations[100]) || 0) * 100;
    total += (parseInt(denominations[50]) || 0) * 50;
    total += (parseInt(denominations[20]) || 0) * 20;
    total += (parseInt(denominations[10]) || 0) * 10;
    total += parseFloat(denominations.coins) || 0;
    return total;
  }, [denominations]);

  const discrepancyRupees = countedPhysicalRupees - bag.derivedBalanceRupees;

  // Filtered Ledger Entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== 'ALL' && e.entryType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesRef = e.referenceLabel?.toLowerCase().includes(q);
        const matchesNotes = e.notes?.toLowerCase().includes(q);
        const matchesActor = e.actorName?.toLowerCase().includes(q);
        if (!matchesRef && !matchesNotes && !matchesActor) return false;
      }
      return true;
    });
  }, [entries, typeFilter, search]);

  // Handlers
  function updateDenomination(denom, val) {
    setDenominations((prev) => ({ ...prev, [denom]: val }));
  }

  function handleResetCounter() {
    setDenominations({ 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', coins: '' });
    setReconReason('');
  }

  async function handleSubmitDenomReconciliation(e) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await recordReconciliation({
          cashBagId: bag.id,
          actualBalanceRupees: countedPhysicalRupees,
          reason: reconReason,
        });

        if (res.success) {
          const status = res.reconciliation.status;
          setFeedback({
            type: 'success',
            text: `Physical cash count recorded: ${status}. ${
              status === 'BALANCED'
                ? 'Ledger perfectly balanced!'
                : 'Pending manager approval for discrepancy adjustment.'
            }`,
          });
          handleResetCounter();
          router.refresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to submit reconciliation' });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    });
  }

  async function handleApproveRecon(reconId, approved) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await approveReconciliation({
          reconciliationId: reconId,
          approved,
          approvalNotes: approved ? 'Approved by Admin' : 'Rejected discrepancy claim',
        });

        if (res.success) {
          setFeedback({
            type: 'success',
            text: `Reconciliation discrepancy ${approved ? 'APPROVED & ADJUSTED' : 'REJECTED'}.`,
          });
          router.refresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'Action failed' });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    });
  }

  async function handleApproveExp(expId, approved) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await approveExpense({
          expenseId: expId,
          approved,
          notes: approved ? 'Approved by Manager' : 'Expense rejected',
        });

        if (res.success) {
          setFeedback({
            type: 'success',
            text: `Expense ${approved ? 'APPROVED and posted to ledger' : 'REJECTED'}.`,
          });
          router.refresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'Action failed' });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/cash"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400">
                {bag.code}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                Active Bag
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <Banknote className="w-6 h-6 text-emerald-400" />
              {bag.name}
            </h1>
          </div>
        </div>

        {/* Current Physical Balance Pill */}
        <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[11px] text-slate-400 font-medium">Physical Derived Balance</div>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {formatINR(bag.derivedBalanceRupees)}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span className="text-sm">{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="ml-auto text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Header */}
      <div className="border-b border-slate-800 flex items-center gap-4">
        {[
          { key: 'LEDGER', label: `Immutable Ledger (${totalEntries})`, icon: Layers },
          { key: 'RECON', label: `Count & Reconciliation (${bag.reconciliations.length})`, icon: Scale },
          { key: 'EXPENSES', label: `Field Expenses (${bag.expenses.length})`, icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                isActive
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: IMMUTABLE LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-4">
          {/* Ledger Filters */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reference #, notes, actor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-400">Entry Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Types</option>
                <option value="OPENING">OPENING</option>
                <option value="COLLECTION">COLLECTION</option>
                <option value="LOAN_DISBURSEMENT">LOAN_DISBURSEMENT</option>
                <option value="EXPENSE">EXPENSE</option>
                <option value="TRANSFER_IN">TRANSFER_IN</option>
                <option value="TRANSFER_OUT">TRANSFER_OUT</option>
                <option value="HANDOVER_OUT">HANDOVER_OUT</option>
                <option value="HANDOVER_IN">HANDOVER_IN</option>
                <option value="REVERSAL">REVERSAL</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
              </select>
            </div>
          </div>

          {/* Ledger Entries Table */}
          {filteredEntries.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-sm">
              No ledger entries match the selected filters.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Entry Type</th>
                      <th className="px-4 py-3">Reference / Remarks</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3 text-right">Inflow / Outflow</th>
                      <th className="px-4 py-3 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredEntries.map((e) => {
                      const isIn = e.direction === 'IN';

                      return (
                        <tr key={e.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                            {new Date(e.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                e.entryType === 'COLLECTION'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : e.entryType === 'OPENING'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : e.entryType === 'EXPENSE'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : e.entryType === 'REVERSAL'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : e.entryType.startsWith('TRANSFER')
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {e.entryType}
                            </span>
                          </td>

                          <td className="px-4 py-3 max-w-xs truncate">
                            {e.referenceLabel && (
                              <span className="font-mono text-slate-200 font-semibold mr-1.5">
                                {e.referenceLabel}:
                              </span>
                            )}
                            <span className="text-slate-400">{e.notes || '—'}</span>
                          </td>

                          <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                            {e.actorName}
                          </td>

                          <td
                            className={`px-4 py-3 text-right font-mono font-bold whitespace-nowrap ${
                              isIn ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isIn ? '+' : '-'} {formatINR(e.amountRupees)}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
                            {formatINR(e.balanceAfterRupees)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PHYSICAL COUNT & RECONCILIATION */}
      {activeTab === 'RECON' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Denomination Counter Calculator */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Denomination Counter
            </h3>
            <p className="text-xs text-slate-400">
              Count actual physical currency in this Cash Bag for end-of-trip closing.
            </p>

            <form onSubmit={handleSubmitDenomReconciliation} className="space-y-3">
              {[
                { label: '₹500 Notes', key: '500' },
                { label: '₹200 Notes', key: '200' },
                { label: '₹100 Notes', key: '100' },
                { label: '₹50 Notes', key: '50' },
                { label: '₹20 Notes', key: '20' },
                { label: '₹10 Notes', key: '10' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-300 font-medium w-24">{item.label}</span>
                  <input
                    type="number"
                    min="0"
                    value={denominations[item.key]}
                    onChange={(e) => updateDenomination(item.key, e.target.value)}
                    placeholder="0"
                    className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 font-mono w-24 text-right">
                    = {formatINR((parseInt(denominations[item.key]) || 0) * parseInt(item.key))}
                  </span>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800">
                <span className="text-slate-300 font-medium w-24">Coins / Misc</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={denominations.coins}
                  onChange={(e) => updateDenomination('coins', e.target.value)}
                  placeholder="0"
                  className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-400 font-mono w-24 text-right">
                  = {formatINR(parseFloat(denominations.coins) || 0)}
                </span>
              </div>

              {/* Total & Discrepancy Box */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Counted:</span>
                  <span className="font-bold text-slate-100 font-mono text-sm">
                    {formatINR(countedPhysicalRupees)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Expected Ledger:</span>
                  <span className="font-semibold text-slate-300 font-mono">
                    {formatINR(bag.derivedBalanceRupees)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Discrepancy:</span>
                  <span
                    className={`font-bold font-mono ${
                      discrepancyRupees === 0
                        ? 'text-emerald-400'
                        : discrepancyRupees < 0
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {formatINR(discrepancyRupees)} ({discrepancyRupees === 0 ? 'BALANCED' : discrepancyRupees < 0 ? 'SHORTAGE' : 'EXCESS'})
                  </span>
                </div>
              </div>

              {discrepancyRupees !== 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Discrepancy Explanation <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reconReason}
                    onChange={(e) => setReconReason(e.target.value)}
                    placeholder="Document the exact cause of shortage or excess..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleResetCounter}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                >
                  {isPending ? 'Submitting...' : 'Post Reconciliation'}
                </button>
              </div>
            </form>
          </div>

          {/* Reconciliation History & Pending Approvals */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-slate-100">Reconciliation Audit History</h3>

            {bag.reconciliations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
                No past physical reconciliations for this Cash Bag.
              </div>
            ) : (
              <div className="space-y-3">
                {bag.reconciliations.map((r) => {
                  const isBalanced = r.status === 'BALANCED';
                  const isPendingApproval = r.approvalStatus === 'PENDING';

                  return (
                    <div
                      key={r.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBalanced
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : r.status === 'SHORTAGE'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(r.reconciledAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 space-x-2">
                          <span>
                            Expected: <strong className="font-mono">{formatINR(r.expectedBalanceRupees)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Actual: <strong className="font-mono">{formatINR(r.actualBalanceRupees)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Diff:{' '}
                            <strong
                              className={`font-mono ${
                                r.differenceRupees === 0
                                  ? 'text-emerald-400'
                                  : r.differenceRupees < 0
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {formatINR(r.differenceRupees)}
                            </strong>
                          </span>
                        </div>

                        {r.reason && (
                          <div className="text-xs text-slate-400 italic mt-1 bg-slate-950/60 p-1.5 rounded border border-slate-800/50">
                            &quot;{r.reason}&quot;
                          </div>
                        )}
                      </div>

                      {/* Approvals */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isPendingApproval && profile.isAdmin ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApproveRecon(r.id, true)}
                              disabled={isPending}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition"
                            >
                              Approve Adjustment
                            </button>
                            <button
                              onClick={() => handleApproveRecon(r.id, false)}
                              disabled={isPending}
                              className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-semibold rounded transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              r.approvalStatus === 'APPROVED'
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {r.approvalStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FIELD EXPENSES */}
      {activeTab === 'EXPENSES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100">
              Field Expenses Charged to {bag.name}
            </h3>
          </div>

          {bag.expenses.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
              No field expenses recorded for this Cash Bag yet.
            </div>
          ) : (
            <div className="space-y-3">
              {bag.expenses.map((exp) => {
                const isPendingExp = exp.approvalStatus === 'PENDING';

                return (
                  <div
                    key={exp.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          {exp.expenseNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {exp.category?.name}
                        </span>
                        {exp.isSelfApproved && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                            Self-Approved
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            exp.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : exp.approvalStatus === 'PENDING'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {exp.approvalStatus}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-100">{exp.description}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Recorded by {exp.recordedBy?.fullName} on{' '}
                        {new Date(exp.expenseDate).toLocaleDateString('en-IN')}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold text-rose-400 font-mono">
                          - {formatINR(exp.amountRupees)}
                        </div>
                      </div>

                      {isPendingExp && (profile.isAdmin || profile.permissions?.includes('cash:expense_approve')) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveExp(exp.id, true)}
                            disabled={isPending}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproveExp(exp.id, false)}
                            disabled={isPending}
                            className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-semibold rounded transition"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
