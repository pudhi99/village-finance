'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/money';
import { reversePayment } from '@/features/payments/server-actions';
import {
  Receipt,
  ArrowLeft,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  User,
  CreditCard,
  Calendar,
  Banknote,
  Sparkles,
  Building2,
  Phone,
  X,
} from 'lucide-react';

export default function PaymentDetailsClient({ payment, profile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isReversed = payment.status === 'REVERSED';

  async function handleConfirmReversal(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!reversalReason.trim() || reversalReason.trim().length < 5) {
      setErrorMsg('A detailed reason (minimum 5 characters) is required for payment reversal.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await reversePayment({
          paymentId: payment.id,
          reason: reversalReason.trim(),
        });

        if (res.success) {
          setIsReversalModalOpen(false);
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
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/payments"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Payments
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>

          {profile?.isAdmin && !isReversed && (
            <button
              onClick={() => {
                setReversalReason('');
                setErrorMsg('');
                setIsReversalModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-sm font-medium rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reverse Payment
            </button>
          )}
        </div>
      </div>

      {/* Reversal Banner if Reversed */}
      {isReversed && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 text-rose-200 rounded-xl space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-base text-rose-400">
            <RotateCcw className="w-5 h-5 shrink-0" />
            PAYMENT REVERSED AND VOIDED
          </div>
          <p className="text-sm">
            This payment was formally reversed on{' '}
            <span className="font-semibold">
              {new Date(payment.reversal?.reversedAt).toLocaleString('en-IN')}
            </span>{' '}
            by <span className="font-semibold">{payment.reversal?.reversedBy?.fullName}</span>.
          </p>
          <p className="text-sm bg-rose-950/90 p-2.5 rounded border border-rose-900/60 text-rose-300 mt-2 font-mono">
            Reason: &ldquo;{payment.reversal?.reason}&rdquo;
          </p>
        </div>
      )}

      {/* Printable Receipt Voucher Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl print:bg-white print:text-black print:border-black print:rounded-none print:shadow-none">
        {/* Receipt Header */}
        <div className="px-8 py-6 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:bg-transparent print:border-b-2 print:border-black">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-400 print:text-black" />
              <h1 className="text-xl font-bold tracking-tight text-white print:text-black">
                VILLAGE FINANCE MANAGEMENT
              </h1>
            </div>
            <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
              Micro-Lending, Collections & Repayment Receipt
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium block">
              Receipt Voucher Number
            </span>
            <span className="text-lg font-mono font-bold text-emerald-400 print:text-black">
              {payment.paymentNumber}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/50 p-5 rounded-xl border border-slate-800/80 print:bg-transparent print:border print:border-gray-300">
            {/* Customer Details */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 print:text-gray-700">
                <User className="w-3.5 h-3.5" /> Customer Details
              </span>
              <p className="text-base font-bold text-white print:text-black">{payment.customer.fullName}</p>
              <p className="text-xs text-slate-400 print:text-gray-600">ID: {payment.customer.customerNumber}</p>
              <p className="text-xs text-slate-400 print:text-gray-600">
                Village: {payment.customer.village?.name}
                {payment.customer.area ? ` • Area: ${payment.customer.area.name}` : ''}
              </p>
              {payment.customer.phones?.[0] && (
                <p className="text-xs text-slate-400 print:text-gray-600 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {payment.customer.phones[0].phoneNumber}
                </p>
              )}
            </div>

            {/* Loan Details */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 print:text-gray-700">
                <CreditCard className="w-3.5 h-3.5" /> Loan Account
              </span>
              <p className="text-base font-bold text-indigo-400 print:text-black">{payment.loan.loanNumber}</p>
              <p className="text-xs text-slate-400 print:text-gray-600">{payment.loan.scheme.name}</p>
              <p className="text-xs text-slate-400 print:text-gray-600">
                Scheme Code: {payment.loan.scheme.code} ({payment.loan.scheme.frequency})
              </p>
              {payment.line && (
                <p className="text-xs text-slate-400 print:text-gray-600">Line: {payment.line.name}</p>
              )}
            </div>

            {/* Payment Meta */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 print:text-gray-700">
                <Calendar className="w-3.5 h-3.5" /> Payment Meta
              </span>
              <p className="text-sm font-semibold text-white print:text-black">
                {new Date(payment.collectedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                {new Date(payment.collectedAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-xs text-slate-400 print:text-gray-600">
                Collector: {payment.collectedBy.fullName}
              </p>
              <p className="text-xs text-slate-400 print:text-gray-600">
                Mode: <span className="font-semibold text-slate-200 print:text-black">{payment.mode}</span>
              </p>
              {payment.reference && (
                <p className="text-xs text-slate-400 print:text-gray-600 font-mono">
                  Ref: {payment.reference}
                </p>
              )}
            </div>
          </div>

          {/* Amount Paid Highlight Card */}
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:border-2 print:border-black print:bg-transparent">
            <div>
              <span className="text-xs font-medium text-emerald-400 print:text-black uppercase tracking-wider">
                Total Payment Received
              </span>
              <div className="text-3xl font-bold text-white print:text-black mt-0.5">
                {formatINR(payment.amountRupees)}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="bg-slate-900/80 print:bg-transparent px-3 py-2 rounded border border-slate-800 print:border-gray-400">
                <span className="text-slate-400 print:text-gray-600 block">Principal Component:</span>
                <span className="font-bold text-emerald-400 print:text-black text-sm">
                  {formatINR(payment.principalPaidRupees)}
                </span>
              </div>

              <div className="bg-slate-900/80 print:bg-transparent px-3 py-2 rounded border border-slate-800 print:border-gray-400">
                <span className="text-slate-400 print:text-gray-600 block">Finance Charge:</span>
                <span className="font-bold text-amber-400 print:text-black text-sm">
                  {formatINR(payment.financeChargePaidRupees)}
                </span>
              </div>
            </div>
          </div>

          {/* Installment FIFO Allocation Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white print:text-black flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-400 print:text-black" />
              Itemized FIFO Installment Satisfaction Breakdown
            </h3>

            <div className="border border-slate-800 print:border-black rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-slate-300 print:text-black">
                <thead className="bg-slate-950 text-xs uppercase font-medium text-slate-400 print:text-black print:bg-gray-100 border-b border-slate-800 print:border-black">
                  <tr>
                    <th className="py-2.5 px-4">Installment #</th>
                    <th className="py-2.5 px-4">Scheduled Due Date</th>
                    <th className="py-2.5 px-4 text-right">Principal</th>
                    <th className="py-2.5 px-4 text-right">Finance Charge</th>
                    <th className="py-2.5 px-4 text-right">Total Allocated</th>
                    <th className="py-2.5 px-4 text-center">Installment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 print:divide-gray-300">
                  {payment.allocations.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                      <td className="py-3 px-4 font-semibold text-white print:text-black">
                        Installment #{a.installment.installmentNumber}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 print:text-gray-700">
                        {new Date(a.installment.dueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 print:text-black">
                        {formatINR(a.principalRupees)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400 print:text-black">
                        {formatINR(a.financeChargeRupees)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white print:text-black">
                        {formatINR(a.amountRupees)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                            a.installment.status === 'PAID'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40 print:text-black'
                              : 'bg-amber-950 text-amber-400 border border-amber-800/40 print:text-black'
                          }`}
                        >
                          {a.installment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advance Credit Entry Note if applicable */}
          {payment.advanceCreditRupees > 0 && (
            <div className="p-4 bg-purple-950/40 border border-purple-800/50 rounded-xl text-xs text-purple-300 flex items-center justify-between print:border-black print:bg-transparent print:text-black">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 print:text-black" />
                <span>
                  <strong>Excess Advance Credit:</strong> Amount exceeding remaining loan repayment is credited to this loan account.
                </span>
              </div>
              <span className="font-bold text-base text-purple-200 print:text-black">
                +{formatINR(payment.advanceCreditRupees)}
              </span>
            </div>
          )}

          {/* Notes */}
          {payment.notes && (
            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 print:bg-transparent print:text-gray-700 print:border-gray-300">
              <span className="font-semibold text-slate-300 print:text-black">Notes: </span>
              {payment.notes}
            </div>
          )}

          {/* Signatures for Print */}
          <div className="hidden print:flex justify-between pt-16 text-xs text-gray-800">
            <div className="border-t border-black pt-1 w-48 text-center">
              Customer Signature / Thumb
            </div>
            <div className="border-t border-black pt-1 w-48 text-center">
              Authorized Cashier / Collector
            </div>
          </div>
        </div>
      </div>

      {/* Admin Reversal Modal */}
      {isReversalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print">
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
                  Reversing voucher <strong>{payment.paymentNumber}</strong> ({formatINR(payment.amountRupees)}) will restore installment unpaid balances, void any generated advance credit, reopen the loan if cleared, and record an immutable audit entry.
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
