'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/money';
import {
  recordCashBagOpening,
  executeCashTransfer,
  recordExpense,
  recordReconciliation,
} from '@/features/cash/server-actions';
import {
  Banknote,
  ArrowRightLeft,
  Receipt,
  Scale,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Calendar,
  Layers,
  ShieldAlert,
} from 'lucide-react';

export default function CashHubClient({
  initialBags = [],
  totalVaultRupees = 0,
  categories = [],
  profile = {},
  user = {},
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'OPENING' | 'TRANSFER' | 'EXPENSE' | 'RECONCILE' | null
  const [selectedBagId, setSelectedBagId] = useState(initialBags[0]?.id || '');
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }

  // Form states
  // Opening Form
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingNotes, setOpeningNotes] = useState('');

  // Transfer Form
  const [transferSourceId, setTransferSourceId] = useState(initialBags[0]?.id || '');
  const [transferDestId, setTransferDestId] = useState(initialBags[1]?.id || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Expense Form
  const [expenseBagId, setExpenseBagId] = useState(initialBags[0]?.id || '');
  const [expenseCategoryId, setExpenseCategoryId] = useState(categories[0]?.id || '');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAutoApprove, setExpenseAutoApprove] = useState(profile.isAdmin);

  // Reconciliation Form
  const [reconBagId, setReconBagId] = useState(initialBags[0]?.id || '');
  const [reconActualAmount, setReconActualAmount] = useState('');
  const [reconReason, setReconReason] = useState('');

  // Metrics calculation
  const metrics = useMemo(() => {
    let todayIn = 0;
    let todayOut = 0;
    let pendingRecons = 0;
    let pendingExps = 0;

    for (const b of initialBags) {
      todayIn += b.todayInRupees || 0;
      todayOut += b.todayOutRupees || 0;
      pendingRecons += b.pendingReconciliationsCount || 0;
      pendingExps += b.pendingExpensesCount || 0;
    }

    return { todayIn, todayOut, pendingRecons, pendingExps };
  }, [initialBags]);

  // Selected bag for reconciliation preview
  const reconTargetBag = useMemo(() => {
    return initialBags.find((b) => b.id === reconBagId) || null;
  }, [initialBags, reconBagId]);

  const reconDiffRupees = useMemo(() => {
    if (!reconTargetBag || reconActualAmount === '') return 0;
    const actual = parseFloat(reconActualAmount) || 0;
    return actual - reconTargetBag.derivedBalanceRupees;
  }, [reconTargetBag, reconActualAmount]);

  // Handlers
  async function handleRecordOpening(e) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await recordCashBagOpening({
          cashBagId: selectedBagId,
          amountRupees: parseFloat(openingAmount) || 0,
          openingDate,
          notes: openingNotes,
        });

        if (res.success) {
          setFeedback({ type: 'success', text: 'Daily opening balance successfully recorded!' });
          setActiveModal(null);
          setOpeningAmount('');
          setOpeningNotes('');
          router.refresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to record opening' });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    });
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await executeCashTransfer({
          sourceCashBagId: transferSourceId,
          destinationCashBagId: transferDestId,
          amountRupees: parseFloat(transferAmount) || 0,
          notes: transferNotes,
        });

        if (res.success) {
          setFeedback({
            type: 'success',
            text: `Transfer ${res.transfer.transferNumber} of ₹${transferAmount} completed atomically!`,
          });
          setActiveModal(null);
          setTransferAmount('');
          setTransferNotes('');
          router.refresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to transfer cash' });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    });
  }

  async function handleRecordExpense(e) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await recordExpense({
          cashBagId: expenseBagId,
          categoryId: expenseCategoryId,
          amountRupees: parseFloat(expenseAmount) || 0,
          description: expenseDesc,
          autoApprove: expenseAutoApprove,
        });

        if (res.success) {
          setFeedback({
            type: 'success',
            text: `Expense ${res.expense.expenseNumber} recorded (${res.expense.approvalStatus}).`,
          });
          setActiveModal(null);
          setExpenseAmount('');
          setExpenseDesc('');
          router.refresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to record expense' });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    });
  }

  async function handleReconciliation(e) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await recordReconciliation({
          cashBagId: reconBagId,
          actualBalanceRupees: parseFloat(reconActualAmount) || 0,
          reason: reconReason,
        });

        if (res.success) {
          const status = res.reconciliation.status;
          setFeedback({
            type: 'success',
            text: `Physical cash count recorded: ${status}. ${
              status === 'BALANCED' ? 'Ledger perfectly balanced!' : 'Pending manager approval for discrepancy adjustment.'
            }`,
          });
          setActiveModal(null);
          setReconActualAmount('');
          setReconReason('');
          router.refresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to reconcile cash' });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Banknote className="w-7 h-7 text-emerald-400" />
            Cash Bags & Cash Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable append-only cash accounting, line cash bags, vault ledger, inter-line transfers, and physical reconciliations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFeedback(null);
              setActiveModal('OPENING');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            <Clock className="w-3.5 h-3.5" />
            Record Opening
          </button>

          <button
            onClick={() => {
              setFeedback(null);
              setActiveModal('TRANSFER');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Inter-Line Transfer
          </button>

          <button
            onClick={() => {
              setFeedback(null);
              setActiveModal('EXPENSE');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            <Receipt className="w-3.5 h-3.5" />
            Field Expense
          </button>

          <button
            onClick={() => {
              setFeedback(null);
              setActiveModal('RECONCILE');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-emerald-950/40"
          >
            <Scale className="w-3.5 h-3.5" />
            Reconcile Cash
          </button>
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

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Total Physical Cash</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {formatINR(totalVaultRupees)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Across all Bags & Vault</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Today&apos;s Cash Inflow
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {formatINR(metrics.todayIn)}
          </div>
          <div className="text-xs text-emerald-400 mt-0.5">Collections + Openings</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            Today&apos;s Cash Outflow
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {formatINR(metrics.todayOut)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Disbursements + Expenses</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Pending Approvals</span>
            {(metrics.pendingRecons > 0 || metrics.pendingExps > 0) && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {metrics.pendingRecons + metrics.pendingExps}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {metrics.pendingRecons} recons • {metrics.pendingExps} expenses
          </div>
        </div>
      </div>

      {/* Cash Bags Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Line Cash Bags & Vaults ({initialBags.length})
          </h2>
          <span className="text-xs text-slate-400">
            Balances strictly derived from append-only ledger entries
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialBags.map((bag) => {
            const isVault = bag.code === 'VAULT-MAIN';

            return (
              <div
                key={bag.id}
                className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition ${
                  isVault ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'
                }`}
              >
                <div>
                  {/* Top line code & pending badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      {bag.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {bag.pendingReconciliationsCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          Recon Req
                        </span>
                      )}
                      {bag.pendingExpensesCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                          {bag.pendingExpensesCount} exp pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name and line details */}
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
                    {bag.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {isVault ? (
                      <span className="text-emerald-400 font-medium">Central Office Vault</span>
                    ) : (
                      <span>
                        Line: {bag.lineName} • {bag.weekday} {bag.session && `(${bag.session})`}
                      </span>
                    )}
                  </div>

                  {/* Derived Balance Highlight Box */}
                  <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                    <div className="text-[11px] text-slate-400 font-medium">Physical Cash Balance</div>
                    <div className="text-xl font-bold text-emerald-400 mt-0.5">
                      {formatINR(bag.derivedBalanceRupees)}
                    </div>
                  </div>

                  {/* Daily in/out mini metrics */}
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="p-2 bg-slate-950/60 rounded border border-slate-800/50">
                      <span className="text-slate-400 text-[11px]">Today&apos;s In:</span>
                      <div className="font-bold text-slate-200 mt-0.5">
                        {formatINR(bag.todayInRupees)}
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950/60 rounded border border-slate-800/50">
                      <span className="text-slate-400 text-[11px]">Today&apos;s Out:</span>
                      <div className="font-bold text-slate-200 mt-0.5">
                        {formatINR(bag.todayOutRupees)}
                      </div>
                    </div>
                  </div>

                  {/* Latest opening indicator */}
                  {bag.latestOpening && (
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Opening ({bag.latestOpening.date}):</span>
                      <span className="font-medium text-slate-300">
                        {formatINR(bag.latestOpening.amountRupees)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card footer actions */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setReconBagId(bag.id);
                        setActiveModal('RECONCILE');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
                      title="Reconcile Cash"
                    >
                      Count / Reconcile
                    </button>
                  </div>

                  <Link
                    href={`/cash/${bag.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shadow-md shadow-emerald-950/50"
                  >
                    View Ledger
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: Record Opening Balance */}
      {activeModal === 'OPENING' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                Record Daily Opening Balance
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordOpening} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Cash Bag <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedBagId}
                  onChange={(e) => setSelectedBagId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {initialBags.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) — Bal: {formatINR(b.derivedBalanceRupees)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Trip Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Opening Cash Float (₹) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enforces uniqueness per Cash Bag and Date.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="e.g. Morning float taken from office vault"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Post Opening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Inter-Line Cash Transfer */}
      {activeModal === 'TRANSFER' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                Inter-Line Cash Transfer
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Posts paired <strong className="text-slate-300">TRANSFER_OUT</strong> and <strong className="text-slate-300">TRANSFER_IN</strong> entries atomically. This is an operational shift, not capital.
            </p>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Source Cash Bag (Outflow) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={transferSourceId}
                  onChange={(e) => setTransferSourceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {initialBags.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — Avail: {formatINR(b.derivedBalanceRupees)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Destination Cash Bag (Inflow) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={transferDestId}
                  onChange={(e) => setTransferDestId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {initialBags
                    .filter((b) => b.id !== transferSourceId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — Bal: {formatINR(b.derivedBalanceRupees)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Transfer Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Reason / Remarks</label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Rebalancing cash for afternoon disbursements"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isPending ? 'Transferring...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Record Field Expense */}
      {activeModal === 'EXPENSE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                Record Field Expense
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Charged to Cash Bag <span className="text-rose-400">*</span>
                </label>
                <select
                  value={expenseBagId}
                  onChange={(e) => setExpenseBagId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {initialBags.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — Bal: {formatINR(b.derivedBalanceRupees)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expense Category <span className="text-rose-400">*</span>
                </label>
                <select
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expense Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expense Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. Bike petrol for rural field route"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {profile.isAdmin && (
                <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="autoApprove"
                    checked={expenseAutoApprove}
                    onChange={(e) => setExpenseAutoApprove(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="autoApprove" className="text-xs text-slate-300 cursor-pointer">
                    Approve immediately & post OUT entry (will flag as self-approved)
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Reconcile Physical Cash */}
      {activeModal === 'RECONCILE' && reconTargetBag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" />
                Physical Cash Reconciliation
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReconciliation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Cash Bag to Count <span className="text-rose-400">*</span>
                </label>
                <select
                  value={reconBagId}
                  onChange={(e) => setReconBagId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {initialBags.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Expected balance preview */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Expected Ledger Balance:</span>
                  <span className="font-bold text-slate-100 text-sm">
                    {formatINR(reconTargetBag.derivedBalanceRupees)}
                  </span>
                </div>
                {reconActualAmount !== '' && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Discrepancy (Actual - Expected):</span>
                    <span
                      className={`font-bold ${
                        reconDiffRupees === 0
                          ? 'text-emerald-400'
                          : reconDiffRupees < 0
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {formatINR(reconDiffRupees)} ({reconDiffRupees === 0 ? 'BALANCED' : reconDiffRupees < 0 ? 'SHORTAGE' : 'EXCESS'})
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Actual Physical Cash Count (₹) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={reconActualAmount}
                  onChange={(e) => setReconActualAmount(e.target.value)}
                  placeholder="Count notes and coins..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {reconDiffRupees !== 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Discrepancy Reason / Explanation <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reconReason}
                    onChange={(e) => setReconReason(e.target.value)}
                    placeholder="Document the exact cause of shortage or excess..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    Shortage/excess requires reason and admin approval; never silently auto-adjusts.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isPending ? 'Recording...' : 'Submit Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
