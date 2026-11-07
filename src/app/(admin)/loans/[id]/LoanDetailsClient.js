'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  User,
  Calendar,
  Banknote,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Send,
  Ban,
  FileText,
  DollarSign,
  X,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import {
  approveLoanApplication,
  disburseLoan,
  cancelLoanWithRecovery,
} from '@/features/loans/server-actions';

export default function LoanDetailsClient({ loan, userProfile, lines }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'disbursements' | 'approvals' | 'recovery'

  // Modals
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Forms
  const [approvalDecision, setApprovalDecision] = useState('APPROVED');
  const [approvalReason, setApprovalReason] = useState('');
  const [overlappingReason, setOverlappingReason] = useState('');

  const [disburseAmount, setDisburseAmount] = useState(loan.remainingDisbursableRupees);
  const [disburseMode, setDisburseMode] = useState('CASH');
  const [disburseRef, setDisburseRef] = useState('');
  const [disburseLineId, setDisburseLineId] = useState(loan.customer.currentLineId || '');
  const [firstDueDate, setFirstDueDate] = useState('');

  const [cancelReason, setCancelReason] = useState('');

  // Status & Notifications
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const isApplicant = loan.applicant.id === userProfile.userId;
  const canApprove =
    loan.status === 'SUBMITTED' &&
    (userProfile.permissions.includes('loans:approve') || userProfile.isAdmin);
  const canDisburse =
    (loan.status === 'APPROVED' || loan.status === 'PARTIALLY_DISBURSED') &&
    loan.remainingDisbursableRupees > 0 &&
    (userProfile.permissions.includes('loans:disburse') || userProfile.isAdmin);
  const canCancel =
    (loan.status === 'PARTIALLY_DISBURSED' || loan.status === 'DISBURSED' || loan.status === 'ACTIVE') &&
    !loan.cancellation &&
    userProfile.isAdmin;
  const canRecordPayment =
    (loan.status === 'ACTIVE' || loan.status === 'DISBURSED' || loan.status === 'PARTIALLY_DISBURSED') &&
    (userProfile.permissions?.includes('payments:collect') || userProfile.isAdmin);

  async function handleApprove(e) {
    e.preventDefault();
    setLoading(true);
    setActionError(null);
    try {
      await approveLoanApplication({
        loanId: loan.id,
        decision: approvalDecision,
        reason: approvalReason,
        overlappingApprovalReason: overlappingReason,
      });
      setShowApprovalModal(false);
      setActionSuccess(`Loan decision recorded: ${approvalDecision}`);
      router.refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisburse(e) {
    e.preventDefault();
    setLoading(true);
    setActionError(null);
    try {
      await disburseLoan({
        loanId: loan.id,
        amountRupees: Number(disburseAmount),
        mode: disburseMode,
        reference: disburseRef,
        lineId: disburseLineId || null,
        firstInstallmentDueDate: firstDueDate || null,
      });
      setShowDisburseModal(false);
      setActionSuccess('Disbursement posted successfully and repayment schedule generated!');
      router.refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(e) {
    e.preventDefault();
    setLoading(true);
    setActionError(null);
    try {
      const res = await cancelLoanWithRecovery({
        loanId: loan.id,
        reason: cancelReason,
      });
      setShowCancelModal(false);
      setActionSuccess(
        `Loan cancelled. Net recoverable principal calculated: ${formatINR(
          res.netRecoverablePrincipalRupees
        )}`
      );
      router.refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/loans"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
                {loan.loanNumber}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                {loan.status}
              </span>
              {loan.isOverlapping && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Overlapping Loan
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Customer:{' '}
              <Link
                href={`/customers/${loan.customer.id}`}
                className="text-emerald-400 hover:underline font-medium"
              >
                {loan.customer.fullName} ({loan.customer.customerNumber})
              </Link>{' '}
              · Village: {loan.customer.villageName} · Scheme: {loan.scheme.name}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canApprove && (
            <button
              onClick={() => {
                setActionError(null);
                setShowApprovalModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <ShieldCheck className="w-4 h-4" /> Review & Approve
            </button>
          )}

          {canDisburse && (
            <button
              onClick={() => {
                setActionError(null);
                setDisburseAmount(loan.remainingDisbursableRupees);
                setShowDisburseModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Banknote className="w-4 h-4" /> Disburse Funds
            </button>
          )}

          {canRecordPayment && (
            <Link
              href="/payments"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Banknote className="w-4 h-4" /> Record Repayment
            </Link>
          )}

          {canCancel && (
            <button
              onClick={() => {
                setActionError(null);
                setShowCancelModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-medium rounded-lg transition"
            >
              <Ban className="w-3.5 h-3.5" /> Cancel with Recovery
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {actionSuccess}
          </span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {actionError}
          </span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium">Sanctioned Principal</span>
          <div className="text-xl font-bold text-white mt-1">
            {formatINR(loan.sanctionedPrincipalRupees)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {loan.scheme.code} · {loan.scheme.frequency}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium">Total Finance Charge</span>
          <div className="text-xl font-bold text-amber-300 mt-1">
            {formatINR(loan.totalFinanceChargeRupees)}
          </div>
          <span className="text-[11px] text-slate-500">Fixed terms agreed</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium">Total Repayment Due</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {formatINR(loan.totalRepaymentRupees)}
          </div>
          <span className="text-[11px] text-slate-500">
            {loan.schedule?.installments.length || 0} installments
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium">Total Disbursed</span>
          <div className="text-xl font-bold text-white mt-1">
            {formatINR(loan.totalDisbursedRupees)}
          </div>
          <span className="text-[11px] text-slate-400">
            Remaining: {formatINR(loan.remainingDisbursableRupees)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-4">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'schedule'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Repayment Schedule ({loan.schedule?.installments.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('disbursements')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'disbursements'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Disbursements ({loan.disbursements.length})
        </button>
        <button
          onClick={() => setActiveTab('repayments')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'repayments'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Repayments ({loan.payments?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'approvals'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Approvals & Audit ({loan.approvals.length})
        </button>
        {loan.cancellation && (
          <button
            onClick={() => setActiveTab('recovery')}
            className={`pb-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'recovery'
                ? 'border-rose-500 text-rose-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Cancellation & Recovery
          </button>
        )}
      </div>

      {/* Tab 1: Repayment Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {!loan.schedule ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <Clock className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">No Schedule Generated Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Per business rules, the immutable repayment schedule snapshot is generated on the first completed disbursement.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3 text-right">Principal Due</th>
                      <th className="px-4 py-3 text-right">Finance Charge</th>
                      <th className="px-4 py-3 text-right">Total Due</th>
                      <th className="px-4 py-3 text-right">Total Paid</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {loan.schedule.installments.map((inst) => (
                      <tr key={inst.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {inst.installmentNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300 font-mono">
                          {formatINR(inst.principalDueRupees)}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-400 font-mono">
                          {formatINR(inst.financeChargeDueRupees)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white font-mono">
                          {formatINR(inst.totalDueRupees)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatINR(inst.totalPaidRupees)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {inst.status === 'PAID' ? (
                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Paid
                            </span>
                          ) : inst.status === 'PARTIALLY_PAID' ? (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-950 text-blue-300 border border-blue-800">
                              Partially Paid
                            </span>
                          ) : inst.status === 'VOIDED' ? (
                            <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 line-through">
                              Voided
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs bg-amber-950 text-amber-300 border border-amber-800">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-950 border-t border-slate-800 text-xs font-semibold text-white">
                    <tr>
                      <td colSpan={2} className="px-4 py-3">
                        Total Schedule Reconciliation:
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {formatINR(loan.schedule.totalPrincipalRupees)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-300">
                        {formatINR(loan.schedule.totalFinanceChargeRupees)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 text-sm">
                        {formatINR(loan.schedule.totalRepaymentRupees)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Disbursements */}
      {activeTab === 'disbursements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Tranche #</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Mode & Ref</th>
                  <th className="px-5 py-3">Disbursed At</th>
                  <th className="px-5 py-3">Disbursed By</th>
                  <th className="px-5 py-3">Line</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loan.disbursements.map((d) => (
                  <tr key={d.id}>
                    <td className="px-5 py-3 font-mono font-bold text-white">
                      Tranche #{d.disbursementNumber}
                    </td>
                    <td className="px-5 py-3 font-semibold text-emerald-400 font-mono">
                      {formatINR(d.amountRupees)}
                    </td>
                    <td className="px-5 py-3 text-slate-300">
                      {d.mode} {d.reference !== '—' && <span className="text-xs text-slate-500 font-mono">({d.reference})</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(d.disbursedAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-slate-200">{d.disburserName}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{d.lineName || '—'}</td>
                  </tr>
                ))}
                {loan.disbursements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      No disbursements posted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Repayments & Collections */}
      {activeTab === 'repayments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Receipt / Voucher</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Principal</th>
                  <th className="px-5 py-3 text-right">Finance Charge</th>
                  <th className="px-5 py-3 text-center">Mode</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(loan.payments || []).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono font-medium text-emerald-400">
                      <Link href={`/payments/${p.id}`} className="hover:underline">
                        {p.paymentNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(p.collectedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3 font-semibold text-white text-right font-mono">
                      {formatINR(p.amountRupees)}
                    </td>
                    <td className="px-5 py-3 text-emerald-400 text-right font-mono text-xs">
                      {formatINR(p.principalPaidRupees)}
                    </td>
                    <td className="px-5 py-3 text-amber-400 text-right font-mono text-xs">
                      {formatINR(p.financeChargePaidRupees)}
                    </td>
                    <td className="px-5 py-3 text-center text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {p.mode}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs">
                      {p.isReversed ? (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          Reversed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Confirmed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/payments/${p.id}`}
                        className="text-xs text-indigo-400 hover:underline"
                      >
                        View Voucher
                      </Link>
                    </td>
                  </tr>
                ))}
                {(!loan.payments || loan.payments.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                      No repayments recorded for this loan yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Approvals & Audit */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-white text-sm border-b border-slate-800 pb-2">
              Application Submission Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Applicant:</span>
                <p className="text-white font-medium mt-0.5">{loan.applicant.fullName}</p>
              </div>
              <div>
                <span className="text-slate-400">Submitted At:</span>
                <p className="text-white font-medium mt-0.5">
                  {new Date(loan.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Overlapping Status:</span>
                <p className="mt-0.5">
                  {loan.isOverlapping ? (
                    <span className="text-amber-400 font-semibold">Yes (Admin Override Required)</span>
                  ) : (
                    <span className="text-slate-400">Standard Application</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Application Notes:</span>
                <p className="text-white mt-0.5 italic">{loan.notes || 'No notes provided'}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-white text-sm border-b border-slate-800 pb-2">
              Approval Decisions
            </h3>
            {loan.approvals.map((app) => (
              <div
                key={app.id}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-xs ${
                        app.decision === 'APPROVED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-red-950 text-red-300 border border-red-800'
                      }`}
                    >
                      {app.decision}
                    </span>
                    <span className="text-slate-300">by {app.approverName}</span>
                  </div>
                  <span className="text-slate-500">
                    {new Date(app.decidedAt).toLocaleString('en-IN')}
                  </span>
                </div>
                {app.reason && <p className="text-slate-400 italic">&ldquo;{app.reason}&rdquo;</p>}
                {loan.overlappingApprovalReason && (
                  <p className="text-amber-300/90 text-[11px]">
                    <strong>Admin Justification:</strong> {loan.overlappingApprovalReason}
                  </p>
                )}
              </div>
            ))}
            {loan.approvals.length === 0 && (
              <p className="text-xs text-slate-500 italic">No approval decisions recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Recovery (if cancelled) */}
      {activeTab === 'recovery' && loan.cancellation && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Principal-Only Recovery Account
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Loan was cancelled after partial or full disbursement. In accordance with policy, all future finance charges were voided, and only net unearned principal is recoverable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Total Disbursed Principal</span>
              <p className="text-lg font-bold text-white mt-1">
                {formatINR(loan.cancellation.disbursedPrincipalRupees)}
              </p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Principal Repaid Before Cancellation</span>
              <p className="text-lg font-bold text-emerald-400 mt-1">
                {formatINR(loan.cancellation.repaidPrincipalRupees)}
              </p>
            </div>
            <div className="p-4 bg-rose-950/30 rounded-xl border border-rose-800/80">
              <span className="text-xs text-rose-300 font-semibold">Net Recoverable Principal</span>
              <p className="text-lg font-bold text-rose-400 mt-1">
                {formatINR(loan.cancellation.netRecoverablePrincipalRupees)}
              </p>
              <span className="text-[11px] text-rose-300/80">
                Status: {loan.cancellation.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Review & Approve */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" /> Review Loan Application
              </h2>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anti-tampering notice if applicant */}
            {isApplicant && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>
                  <strong>Strict Separation of Duties:</strong> You submitted this application ({loan.applicant.fullName}). The system will forbid you from self-approving. Another officer or admin must approve it.
                </span>
              </div>
            )}

            <form onSubmit={handleApprove} className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sanctioned Principal:</span>
                  <span className="font-semibold text-white">
                    {formatINR(loan.sanctionedPrincipalRupees)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Repayment:</span>
                  <span className="font-semibold text-emerald-400">
                    {formatINR(loan.totalRepaymentRupees)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-slate-200">{loan.customer.fullName}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Decision *
                </label>
                <select
                  value={approvalDecision}
                  onChange={(e) => setApprovalDecision(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="APPROVED">APPROVE APPLICATION</option>
                  <option value="REJECTED">REJECT APPLICATION</option>
                </select>
              </div>

              {loan.isOverlapping && approvalDecision === 'APPROVED' && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg space-y-2">
                  <label className="block text-xs font-semibold text-amber-300">
                    Admin Overlapping Loan Justification * (Min 5 chars)
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Documented rationale for granting second active loan..."
                    value={overlappingReason}
                    onChange={(e) => setOverlappingReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-800/80 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Review Notes / Comments
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. KYC and home visit verified by field inspector."
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isApplicant}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Recording...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Disburse Funds */}
      {showDisburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" /> Disburse Loan Funds
              </h2>
              <button
                onClick={() => setShowDisburseModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loan.disbursements.length === 0 && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs mb-4">
                <strong>First Tranche Notice:</strong> This initial disbursement will trigger the generation of the fixed, immutable repayment schedule snapshot for this loan.
              </div>
            )}

            <form onSubmit={handleDisburse} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount (₹) * (Max: {formatINR(loan.remainingDisbursableRupees)})
                  </label>
                  <input
                    type="number"
                    required
                    max={loan.remainingDisbursableRupees}
                    min={1}
                    value={disburseAmount}
                    onChange={(e) => setDisburseAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mode *
                  </label>
                  <select
                    value={disburseMode}
                    onChange={(e) => setDisburseMode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER (NEFT/RTGS)</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Reference / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12345678"
                    value={disburseRef}
                    onChange={(e) => setDisburseRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Assigned Collection Line
                  </label>
                  <select
                    value={disburseLineId}
                    onChange={(e) => setDisburseLineId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Line (Optional)...</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loan.disbursements.length === 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    First Installment Due Date (Optional, defaults to +7 days)
                  </label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Disbursing...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancel with Recovery */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <Ban className="w-5 h-5" /> Cancel Loan with Principal-Only Recovery
              </h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-300 text-xs mb-4 space-y-1">
              <p>
                <strong>Critical Recovery Action:</strong> This action stops all future disbursements, voids all remaining installments, and freezes finance charges.
              </p>
              <p>
                The borrower will be placed into immediate recovery for only the net unearned principal (Disbursed Principal - Repaid Principal).
              </p>
            </div>

            <form onSubmit={handleCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Cancellation * (Min 5 chars)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Borrower requested premature termination; shop relocation verified."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Execute Cancellation & Freeze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
