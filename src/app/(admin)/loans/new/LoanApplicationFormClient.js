'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  User,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { createLoanApplication } from '@/features/loans/server-actions';

export default function LoanApplicationFormClient({ customers, schemes }) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [schemeId, setSchemeId] = useState(schemes[0]?.id || '');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedScheme = schemes.find((s) => s.id === schemeId);
  const schemeVersion = selectedScheme?.currentVersion;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg('Please select a customer for the loan application.');
      return;
    }
    if (!selectedScheme || !schemeVersion) {
      setErrorMsg('Please select a valid loan scheme.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createLoanApplication({
        customerId,
        schemeId,
        requestedPrincipalRupees: schemeVersion.principalRupees,
        notes,
      });

      setSuccessMsg(`Loan application ${res.loanNumber} created successfully! Redirecting...`);
      setTimeout(() => {
        router.push(`/loans/${res.loanId}`);
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/loans"
          className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Apply for New Loan
          </h1>
          <p className="text-sm text-slate-400">
            Submit a new loan application under one of the 4 confirmed village finance schemes.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-950/70 border border-red-800 rounded-xl text-red-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-xl text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>{successMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Customer Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <User className="w-4 h-4 text-emerald-400" />
            1. Customer Selection
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Customer *
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Choose an active customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.customerNumber}) — {c.villageName} {c.hasActiveLoan ? '⚠️ [ACTIVE LOAN]' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer?.hasActiveLoan && (
            <div className="p-3.5 bg-amber-950/40 border border-amber-800/80 rounded-lg text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Overlapping Loan Detected:</strong> This customer already has an active loan. Per business policy, this application will be flagged and will require explicit Administrator approval with written justification before disbursement.
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Confirmed Scheme Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            2. Confirmed Loan Scheme
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schemes.map((scheme) => {
              const v = scheme.currentVersion;
              const isSelected = scheme.id === schemeId;
              return (
                <div
                  key={scheme.id}
                  onClick={() => setSchemeId(scheme.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white text-base">{scheme.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-emerald-400 border border-slate-700">
                        {scheme.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{scheme.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 text-xs space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Sanctioned Principal:</span>
                      <span className="font-semibold text-white">{formatINR(v.principalRupees)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Finance Charge:</span>
                      <span className="font-semibold text-amber-300">{formatINR(v.totalFinanceChargeRupees)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Total Repayment:</span>
                      <span className="font-semibold text-emerald-400">{formatINR(v.totalRepaymentRupees)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Tenure:</span>
                      <span>{v.installmentCount} {scheme.frequency.toLowerCase()} installments</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Application Notes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-3">
            3. Officer Notes & Justification
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Purpose / Field Notes (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Small vegetable vending business expansion; borrower verified at shop."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Link
            href="/loans"
            className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {submitting ? 'Submitting Application...' : 'Submit Loan Application'}
          </button>
        </div>
      </form>
    </div>
  );
}
