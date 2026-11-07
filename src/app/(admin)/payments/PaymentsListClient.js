'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/money';
import { recordPayment, reversePayment } from '@/features/payments/server-actions';
import {
  Banknote,
  Search,
  Filter,
  PlusCircle,
  RotateCcw,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  X,
  CreditCard,
  User,
  MapPin,
  Calendar,
} from 'lucide-react';

export default function PaymentsListClient({
  initialPayments = [],
  initialTotal = 0,
  eligibleLoans = [],
  profile = {},
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState(null);
  const [reversalReason, setReversalReason] = useState('');

  // Record Payment Form state
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Find currently selected loan in form
  const selectedLoan = useMemo(() => {
    return eligibleLoans.find((l) => l.id === selectedLoanId) || null;
  }, [selectedLoanId, eligibleLoans]);

  // Live FIFO calculation preview for the entered amount
  const allocationPreview = useMemo(() => {
    if (!selectedLoan || !amountRupees || parseFloat(amountRupees) <= 0) {
      return null;
    }

    const inputPaise = Math.round(parseFloat(amountRupees) * 100);
    let rem = inputPaise;
    const installmentsAllocated = [];
    let totalPrincipal = 0;
    let totalFC = 0;

    for (const inst of selectedLoan.installments) {
      if (rem <= 0) break;
      const remTotal = Math.round(inst.balanceDueRupees * 100);
      const remP = Math.round(inst.remainingPrincipalRupees * 100);
      const remFC = Math.round(inst.remainingFCRupees * 100);

      if (remTotal <= 0) continue;

      const alloc = Math.min(rem, remTotal);
      let allocP = 0;
      let allocFC = 0;

      if (alloc === remTotal) {
        allocP = remP;
        allocFC = remFC;
      } else {
        allocP = Math.floor(alloc * (remP / remTotal));
        allocFC = alloc - allocP;
        if (allocP > remP) {
          allocP = remP;
          allocFC = alloc - allocP;
        } else if (allocFC > remFC) {
          allocFC = remFC;
          allocP = alloc - allocFC;
        }
      }

      installmentsAllocated.push({
        installmentNumber: inst.installmentNumber,
        allocatedRupees: alloc / 100,
        principalRupees: allocP / 100,
        financeChargeRupees: allocFC / 100,
        newStatus: alloc >= remTotal ? 'PAID' : 'PARTIALLY_PAID',
        remainingDueRupees: (remTotal - alloc) / 100,
      });

      totalPrincipal += allocP;
      totalFC += allocFC;
      rem -= alloc;
    }

    const advanceCreditRupees = rem / 100;

    return {
      installmentsAllocated,
      totalPrincipalRupees: totalPrincipal / 100,
      totalFCRupees: totalFC / 100,
      advanceCreditRupees,
    };
  }, [selectedLoan, amountRupees]);

  // Client filtering
  const filteredPayments = useMemo(() => {
    return initialPayments.filter((p) => {
      if (modeFilter !== 'ALL' && p.mode !== modeFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const numMatch = p.paymentNumber?.toLowerCase().includes(q);
        const refMatch = p.reference?.toLowerCase().includes(q);
        const custMatch = p.customer?.fullName?.toLowerCase().includes(q);
        const custNumMatch = p.customer?.customerNumber?.toLowerCase().includes(q);
        const lnMatch = p.loan?.loanNumber?.toLowerCase().includes(q);
        return numMatch || refMatch || custMatch || custNumMatch || lnMatch;
      }

      return true;
    });
  }, [initialPayments, modeFilter, statusFilter, search]);

  // KPI Calculations
  const totalCollectedRupees = useMemo(() => {
    return initialPayments
      .filter((p) => p.status === 'CONFIRMED')
      .reduce((sum, p) => sum + p.amountRupees, 0);
  }, [initialPayments]);

  const confirmedCount = useMemo(() => {
    return initialPayments.filter((p) => p.status === 'CONFIRMED').length;
  }, [initialPayments]);

  const reversedCount = useMemo(() => {
    return initialPayments.filter((p) => p.status === 'REVERSED').length;
  }, [initialPayments]);

  // Handle Form Submission
  async function handleRecordPayment(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedLoanId) {
      setErrorMsg('Please select a loan for repayment');
      return;
    }

    const val = parseFloat(amountRupees);
    if (!val || val <= 0) {
      setErrorMsg('Payment amount must be greater than ₹0');
      return;
    }

    // Auto-generate client-side UUID idempotency key to protect against retry duplicates
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    startTransition(async () => {
      try {
        const res = await recordPayment({
          loanId: selectedLoanId,
          amountRupees: val,
          mode: paymentMode,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          idempotencyKey,
        });

        if (res.success) {
          setSuccessMsg(`Payment recorded successfully! Voucher: ${res.payment.paymentNumber}`);
          setTimeout(() => {
            setIsRecordModalOpen(false);
            setSelectedLoanId('');
            setAmountRupees('');
            setReference('');
            setNotes('');
            setSuccessMsg('');
            router.refresh();
          }, 1200);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to record payment');
      }
    });
  }

  // Handle Reversal Submission
  async function handleConfirmReversal(e) {
    e.preventDefault();
    if (!selectedPaymentForReversal) return;
    setErrorMsg('');

    if (!reversalReason.trim() || reversalReason.trim().length < 5) {
      setErrorMsg('A detailed reason (minimum 5 characters) is required for payment reversal.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await reversePayment({
          paymentId: selectedPaymentForReversal.id,
          reason: reversalReason.trim(),
        });

        if (res.success) {
          setIsReversalModalOpen(false);
          setSelectedPaymentForReversal(null);
          setReversalReason('');
          router.refresh();
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to reverse payment');
      }
    });
  }

  return (
    <div className="space-y-6">
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

        <button
          onClick={() => {
            setErrorMsg('');
            setSuccessMsg('');
            setIsRecordModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-950/40 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Record Payment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Repayments Collected</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatINR(totalCollectedRupees)}</p>
          <p className="text-xs text-slate-500 mt-1">Confirmed cash & digital collections</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Transactions</p>
          <p className="text-2xl font-bold text-white mt-1">{initialTotal}</p>
          <p className="text-xs text-slate-500 mt-1">Recorded payment vouchers</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Confirmed Payments</p>
          <p className="text-2xl font-bold text-teal-400 mt-1">{confirmedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Active immutable allocations</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Reversed Payments</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{reversedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Admin reversed with audit justification</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Payment #, Customer, Loan #, or Reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            Mode:
          </div>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Modes</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
            Status:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REVERSED">Reversed</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-medium text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Receipt / Voucher</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Loan & Scheme</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4">Allocation Split</th>
                <th className="py-3.5 px-4 text-center">Mode</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No payment records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isReversed = p.status === 'REVERSED';
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isReversed ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Payment Number */}
                      <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                        <Link
                          href={`/payments/${p.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5 text-slate-400" />
                          {p.paymentNumber}
                        </Link>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {new Date(p.collectedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        <span className="text-slate-500">
                          {new Date(p.collectedAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{p.customer?.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {p.customer?.customerNumber} • {p.customer?.village?.name}
                        </div>
                      </td>

                      {/* Loan */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/loans/${p.loan?.id}`}
                          className="font-medium text-indigo-400 hover:underline"
                        >
                          {p.loan?.loanNumber}
                        </Link>
                        <div className="text-xs text-slate-500">{p.loan?.scheme?.name}</div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-semibold text-white">
                        {formatINR(p.amountRupees)}
                      </td>

                      {/* Allocation Split */}
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400">
                            P: {formatINR(p.principalPaidRupees)}
                          </span>
                          <span className="text-slate-600">|</span>
                          <span className="text-amber-400">
                            FC: {formatINR(p.financeChargePaidRupees)}
                          </span>
                        </div>
                        {p.advanceCreditRupees > 0 && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-purple-400 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-800/40">
                            <Sparkles className="w-2.5 h-2.5" />
                            Credit: {formatINR(p.advanceCreditRupees)}
                          </div>
                        )}
                      </td>

                      {/* Mode Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                            p.mode === 'CASH'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                              : p.mode === 'UPI'
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-800/50'
                              : p.mode === 'BANK_TRANSFER'
                              ? 'bg-purple-950/80 text-purple-400 border border-purple-800/50'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                          }`}
                        >
                          {p.mode}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isReversed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/50">
                            <RotateCcw className="w-3 h-3" />
                            REVERSED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3" />
                            CONFIRMED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          href={`/payments/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Receipt
                        </Link>

                        {profile.isAdmin && !isReversed && (
                          <button
                            onClick={() => {
                              setSelectedPaymentForReversal(p);
                              setReversalReason('');
                              setErrorMsg('');
                              setIsReversalModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded transition-colors"
                            title="Reverse payment (Admin authorization required)"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">Record Loan Repayment</h3>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-5">
              {errorMsg && (
                <div className="p-3 text-xs bg-rose-950/80 border border-rose-800/80 text-rose-300 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 text-xs bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {successMsg}
                </div>
              )}

              {/* Select Active Loan */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Customer & Active Loan *
                </label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 px-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose active loan --</option>
                  {eligibleLoans.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.customerName} ({l.customerNumber}) — {l.loanNumber} [{l.schemeCode}] — Rem: {formatINR(l.totalPendingRupees)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Loan Details Summary Card */}
              {selectedLoan && (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-medium text-white">{selectedLoan.customerName} ({selectedLoan.customerNumber})</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Village & Line:</span>
                    <span>{selectedLoan.villageName} {selectedLoan.lineName ? `• ${selectedLoan.lineName}` : ''}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Total Outstanding Balance:</span>
                    <span className="font-bold text-amber-400">{formatINR(selectedLoan.totalPendingRupees)}</span>
                  </div>
                  {selectedLoan.nextInstallmentNumber && (
                    <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-2">
                      <span className="text-slate-400">
                        Next Due: Installment #{selectedLoan.nextInstallmentNumber}
                      </span>
                      <span className="font-semibold text-emerald-400">
                        {formatINR(selectedLoan.nextInstallmentDueRupees)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 500"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                  {selectedLoan && (
                    <button
                      type="button"
                      onClick={() => setAmountRupees(String(selectedLoan.nextInstallmentDueRupees))}
                      className="mt-1 text-[11px] text-emerald-400 hover:underline"
                    >
                      Fill exact next installment ({formatINR(selectedLoan.nextInstallmentDueRupees)})
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 px-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="BANK_TRANSFER">Bank Transfer (IMPS / NEFT)</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Reference & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Transaction Ref / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI/1234567890"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 px-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Optional collection note"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 px-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Live FIFO Allocation Preview */}
              {allocationPreview && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Live FIFO Waterfall Breakdown Preview
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {allocationPreview.installmentsAllocated.map((item) => (
                      <div
                        key={item.installmentNumber}
                        className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-slate-800 text-[11px]"
                      >
                        <div>
                          <span className="font-semibold text-white">
                            Installment #{item.installmentNumber}
                          </span>
                          <span
                            className={`ml-2 px-1.5 py-0.2 rounded text-[10px] ${
                              item.newStatus === 'PAID'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                : 'bg-amber-950 text-amber-400 border border-amber-800/40'
                            }`}
                          >
                            {item.newStatus === 'PAID' ? 'Fully Cleared' : 'Partially Paid'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-emerald-400">
                            {formatINR(item.allocatedRupees)}
                          </span>{' '}
                          <span className="text-slate-500">
                            (P: {formatINR(item.principalRupees)}, FC: {formatINR(item.financeChargeRupees)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {allocationPreview.advanceCreditRupees > 0 && (
                    <div className="p-2 bg-purple-950/60 border border-purple-800/60 text-purple-300 rounded text-[11px] flex items-center justify-between">
                      <span>Excess payment beyond loan repayment:</span>
                      <span className="font-bold">
                        +{formatINR(allocationPreview.advanceCreditRupees)} (Same-Loan Advance Credit)
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1.5 text-[11px]">
                    <span>Total Principal: {formatINR(allocationPreview.totalPrincipalRupees)}</span>
                    <span>Total Finance Charge: {formatINR(allocationPreview.totalFCRupees)}</span>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg shadow-lg shadow-emerald-950/40 transition-colors"
                >
                  {isPending ? 'Recording Payment...' : 'Confirm & Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reversal Confirmation Modal */}
      {isReversalModalOpen && selectedPaymentForReversal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-rose-950/20">
              <div className="flex items-center gap-2 text-rose-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-lg font-semibold text-white">Reverse Payment Voucher</h3>
              </div>
              <button
                onClick={() => setIsReversalModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReversal} className="p-6 space-y-4">
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 rounded-lg space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Irreversible Financial Reversal Action
                </div>
                <p>
                  Reversing voucher <strong>{selectedPaymentForReversal.paymentNumber}</strong> ({formatINR(selectedPaymentForReversal.amountRupees)}) will restore installment unpaid balances, void any generated advance credit, reopen the loan if cleared, and record an immutable audit entry.
                </p>
              </div>

              {errorMsg && (
                <div className="p-2.5 text-xs bg-rose-950 border border-rose-800 text-rose-300 rounded">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Documented Justification Reason * (Required for Audit)
                </label>
                <textarea
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why this payment is being reversed (minimum 5 characters)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 p-3 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReversalModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-sm font-medium bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg shadow-lg shadow-rose-950/40 transition-colors"
                >
                  {isPending ? 'Reversing...' : 'Authorize & Reverse Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
