'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Users,
  PieChart,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Coins,
  ChevronRight,
  Building,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import {
  createPartner,
  setPartnerRatio,
  recordCapitalContribution,
  requestPartnerWithdrawal,
  approvePartnerWithdrawal,
  payoutPartnerWithdrawal,
  calculateProfitPeriod,
  approveProfitPeriod,
  postProfitDistribution,
} from '@/features/partners/server-actions';

export default function PartnersHubClient({
  initialPartners = [],
  initialPeriods = [],
  cashBags = [],
  candidateUsers = [],
  profile,
}) {
  const [partners, setPartners] = useState(initialPartners);
  const [periods, setPeriods] = useState(initialPeriods);
  const [activeTab, setActiveTab] = useState('partners'); // 'partners' | 'periods'
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState(null);

  // Modals state
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [showRatioModal, setShowRatioModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showCalculatePeriodModal, setShowCalculatePeriodModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // Form states
  const [newPartner, setNewPartner] = useState({
    name: '',
    partnerCode: '',
    phone: '',
    email: '',
    userProfileId: '',
    capitalRatio: 50,
    profitRatio: 50,
    lossRatio: 50,
    notes: '',
  });

  const [capitalForm, setCapitalForm] = useState({
    partnerId: '',
    amountRupees: '',
    entryType: 'ADDITIONAL_CONTRIBUTION',
    paymentMode: 'BANK_TRANSFER',
    reference: '',
    depositToCashBagId: '',
    notes: '',
  });

  const [ratioForm, setRatioForm] = useState({
    partnerId: '',
    capitalRatio: '',
    profitRatio: '',
    lossRatio: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [withdrawalForm, setWithdrawalForm] = useState({
    partnerId: '',
    amountRupees: '',
    withdrawalType: 'CAPITAL_WITHDRAWAL',
    paymentMode: 'BANK_TRANSFER',
    reference: '',
    withdrawFromCashBagId: '',
    autoApprovePay: true,
    notes: '',
  });

  const [periodForm, setPeriodForm] = useState({
    periodCode: `PRF-${new Date().toISOString().slice(0, 7).replace('-', '')}`,
    name: `${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Operations`,
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    retainedEarningsRupees: '0',
    notes: '',
  });

  // Derived Summary Totals
  const totalDeployedCapitalPaise = partners.reduce((sum, p) => sum + (p.capitalBalancePaise || 0), 0);
  const totalProfitDistributedPaise = periods.reduce(
    (sum, pr) => sum + (pr.profitDistribution?.totalDistributedPaise || 0),
    0
  );

  const activePartnersCount = partners.filter((p) => p.status === 'ACTIVE').length;
  const totalProfitRatioSum = partners
    .filter((p) => p.status === 'ACTIVE')
    .reduce((sum, p) => sum + Number(p.currentRatio?.profitRatio || 0), 0);

  // Clear feedback helper
  const notify = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 7000);
  };

  // 1. Handle Add Partner
  const handleAddPartner = (e) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const created = await createPartner({
          ...newPartner,
          userProfileId: newPartner.userProfileId || null,
        });
        setPartners((prev) => [
          ...prev,
          {
            ...created,
            capitalBalancePaise: 0,
            currentRatio: {
              capitalRatio: newPartner.capitalRatio,
              profitRatio: newPartner.profitRatio,
              lossRatio: newPartner.lossRatio,
            },
          },
        ]);
        setShowAddPartnerModal(false);
        setNewPartner({
          name: '',
          partnerCode: '',
          phone: '',
          email: '',
          userProfileId: '',
          capitalRatio: 50,
          profitRatio: 50,
          lossRatio: 50,
          notes: '',
        });
        notify('success', `Partner ${created.name} (${created.partnerCode}) registered successfully.`);
      } catch (err) {
        notify('error', err.message);
      }
    });
  };

  // 2. Handle Capital Contribution
  const handleRecordCapital = (e) => {
    e.preventDefault();
    const amountPaise = Math.round(parseFloat(capitalForm.amountRupees) * 100);
    if (!amountPaise || amountPaise <= 0) {
      notify('error', 'Please enter a valid rupee amount.');
      return;
    }

    startTransition(async () => {
      try {
        await recordCapitalContribution({
          ...capitalForm,
          amountPaise,
          depositToCashBagId: capitalForm.depositToCashBagId || null,
        });

        // Update local partner balance
        setPartners((prev) =>
          prev.map((p) =>
            p.id === capitalForm.partnerId
              ? { ...p, capitalBalancePaise: p.capitalBalancePaise + amountPaise }
              : p
          )
        );
        setShowCapitalModal(false);
        setCapitalForm({
          partnerId: '',
          amountRupees: '',
          entryType: 'ADDITIONAL_CONTRIBUTION',
          paymentMode: 'BANK_TRANSFER',
          reference: '',
          depositToCashBagId: '',
          notes: '',
        });
        notify('success', `Capital contribution of ${formatINR(capitalForm.amountRupees)} recorded successfully.`);
      } catch (err) {
        notify('error', err.message);
      }
    });
  };

  // 3. Handle Update Ratios
  const handleUpdateRatio = (e) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const ratio = await setPartnerRatio({
          partnerId: ratioForm.partnerId,
          capitalRatio: ratioForm.capitalRatio,
          profitRatio: ratioForm.profitRatio,
          lossRatio: ratioForm.lossRatio,
          effectiveFrom: ratioForm.effectiveFrom,
          notes: ratioForm.notes,
        });

        setPartners((prev) =>
          prev.map((p) =>
            p.id === ratioForm.partnerId
              ? { ...p, currentRatio: ratio }
              : p
          )
        );
        setShowRatioModal(false);
        notify('success', 'Partner ratios updated with effective dating.');
      } catch (err) {
        notify('error', err.message);
      }
    });
  };

  // 4. Handle Withdrawal
  const handleRecordWithdrawal = (e) => {
    e.preventDefault();
    const amountPaise = Math.round(parseFloat(withdrawalForm.amountRupees) * 100);
    if (!amountPaise || amountPaise <= 0) {
      notify('error', 'Please enter a valid withdrawal amount.');
      return;
    }

    startTransition(async () => {
      try {
        const wth = await requestPartnerWithdrawal({
          partnerId: withdrawalForm.partnerId,
          amountPaise,
          withdrawalType: withdrawalForm.withdrawalType,
          notes: withdrawalForm.notes,
        });

        if (withdrawalForm.autoApprovePay && profile.isAdmin) {
          await approvePartnerWithdrawal({ withdrawalId: wth.id });
          await payoutPartnerWithdrawal({
            withdrawalId: wth.id,
            paymentMode: withdrawalForm.paymentMode,
            reference: withdrawalForm.reference,
            withdrawFromCashBagId: withdrawalForm.withdrawFromCashBagId || null,
          });

          // Deduct from local capital
          setPartners((prev) =>
            prev.map((p) =>
              p.id === withdrawalForm.partnerId
                ? { ...p, capitalBalancePaise: p.capitalBalancePaise - amountPaise }
                : p
            )
          );
          notify('success', `Withdrawal of ${formatINR(withdrawalForm.amountRupees)} approved and paid out.`);
        } else {
          notify('success', `Withdrawal of ${formatINR(withdrawalForm.amountRupees)} requested (PENDING approval).`);
        }

        setShowWithdrawalModal(false);
        setWithdrawalForm({
          partnerId: '',
          amountRupees: '',
          withdrawalType: 'CAPITAL_WITHDRAWAL',
          paymentMode: 'BANK_TRANSFER',
          reference: '',
          withdrawFromCashBagId: '',
          autoApprovePay: true,
          notes: '',
        });
      } catch (err) {
        notify('error', err.message);
      }
    });
  };

  // 5. Handle Calculate Profit Period
  const handleCalculatePeriod = (e) => {
    e.preventDefault();
    const retainedEarningsPaise = Math.round(parseFloat(periodForm.retainedEarningsRupees || 0) * 100);

    startTransition(async () => {
      try {
        const period = await calculateProfitPeriod({
          periodCode: periodForm.periodCode,
          name: periodForm.name,
          startDate: periodForm.startDate,
          endDate: periodForm.endDate,
          retainedEarningsPaise,
          notes: periodForm.notes,
        });

        setPeriods((prev) => {
          const idx = prev.findIndex((p) => p.id === period.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = period;
            return updated;
          }
          return [period, ...prev];
        });

        setShowCalculatePeriodModal(false);
        notify(
          'success',
          `Period ${period.periodCode} calculated. Net Profit: ${formatINR(period.netProfitPaise / 100)}, Distributable: ${formatINR(period.distributableProfitPaise / 100)}.`
        );
      } catch (err) {
        notify('error', err.message);
      }
    });
  };

  // 6. Handle Approve Period
  const handleApprovePeriod = (periodId) => {
    startTransition(async () => {
      try {
        const approved = await approveProfitPeriod(periodId);
        setPeriods((prev) => prev.map((p) => (p.id === periodId ? approved : p)));
        notify('success', `Profit Period ${approved.periodCode} officially APPROVED.`);
      } catch (err) {
        notify('error', err.message);
      }
    });
  };

  // 7. Handle Execute Distribution
  const handleDistributeProfit = (period) => {
    if (!confirm(`Confirm posting profit distribution of ${formatINR(period.distributableProfitPaise / 100)} across active partners for ${period.name}?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const dist = await postProfitDistribution({
          profitPeriodId: period.id,
          notes: `Formal profit distribution for ${period.name}`,
        });

        setPeriods((prev) =>
          prev.map((p) =>
            p.id === period.id
              ? { ...p, status: 'DISTRIBUTED', profitDistribution: dist }
              : p
          )
        );
        notify('success', `Profit distribution ${dist.distributionNumber} posted with immutable ratio snapshots.`);
      } catch (err) {
        notify('error', err.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-lg ${
            feedback.type === 'error'
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-xs underline ml-4 hover:opacity-80">
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PieChart className="w-7 h-7 text-indigo-400" />
            Partner Capital & Profit / Loss
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative derived capital, effective-dated equity ratios, and approved period profit distributions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile.isAdmin && (
            <>
              <button
                onClick={() => setShowAddPartnerModal(true)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                Add Partner
              </button>
              <button
                onClick={() => setShowCapitalModal(true)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition"
              >
                <ArrowUpRight className="w-4 h-4" />
                Record Capital
              </button>
              <button
                onClick={() => setShowWithdrawalModal(true)}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Withdrawal
              </button>
              <button
                onClick={() => setShowCalculatePeriodModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-900/50 rounded-lg text-sm font-medium flex items-center gap-1.5 transition"
              >
                <Calendar className="w-4 h-4" />
                Calculate P&L
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Deployed Capital</span>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            {formatINR(totalDeployedCapitalPaise / 100)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Authoritative derived across all partners</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Active Partners</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{activePartnersCount}</p>
          <p className="text-xs text-slate-400 mt-1">Equity shareholders & investors</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Distributed Profit</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-2">
            {formatINR(totalProfitDistributedPaise / 100)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Net collected finance charge returns</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Profit Ratio Health</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl font-bold ${
                Math.abs(totalProfitRatioSum - 100) < 0.01 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalProfitRatioSum.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400">of 100%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {Math.abs(totalProfitRatioSum - 100) < 0.01
              ? '✓ Equilibrium verified'
              : '⚠ Total does not equal 100%'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('partners')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'partners'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Partners & Equity ({partners.length})
        </button>
        <button
          onClick={() => setActiveTab('periods')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'periods'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Profit Periods & Distributions ({periods.length})
        </button>
      </div>

      {/* TAB 1: Partners & Capital List */}
      {activeTab === 'partners' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Partner Equity & Ratio Registry</h2>
            <span className="text-xs text-slate-400">
              Contributions are independent of Cash Bags; Withdrawals reduce capital strictly upon payout.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Partner</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Capital Ratio</th>
                  <th className="py-3 px-4">Profit Ratio</th>
                  <th className="py-3 px-4">Loss Ratio</th>
                  <th className="py-3 px-4 text-right">Derived Capital</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No partners registered yet. Click &quot;Add Partner&quot; to begin.
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                        <Link
                          href={`/partners/${partner.id}`}
                          className="hover:text-indigo-400 flex items-center gap-1.5"
                        >
                          {partner.name}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        </Link>
                        {partner.status !== 'ACTIVE' && (
                          <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400">
                            {partner.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-indigo-300">
                        {partner.partnerCode}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {partner.phone || partner.email || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-200">
                        {partner.currentRatio?.capitalRatio
                          ? `${Number(partner.currentRatio.capitalRatio).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-emerald-400">
                        {partner.currentRatio?.profitRatio
                          ? `${Number(partner.currentRatio.profitRatio).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-amber-400">
                        {partner.currentRatio?.lossRatio
                          ? `${Number(partner.currentRatio.lossRatio).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                        {formatINR(partner.capitalBalancePaise / 100)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {profile.isAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedPartner(partner);
                                  setRatioForm({
                                    partnerId: partner.id,
                                    capitalRatio: Number(partner.currentRatio?.capitalRatio || 0),
                                    profitRatio: Number(partner.currentRatio?.profitRatio || 0),
                                    lossRatio: Number(partner.currentRatio?.lossRatio || 0),
                                    effectiveFrom: new Date().toISOString().slice(0, 10),
                                    notes: '',
                                  });
                                  setShowRatioModal(true);
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 rounded transition"
                              >
                                Edit Ratios
                              </button>
                              <button
                                onClick={() => {
                                  setCapitalForm((prev) => ({ ...prev, partnerId: partner.id }));
                                  setShowCapitalModal(true);
                                }}
                                className="px-2 py-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800 text-xs text-emerald-300 rounded transition"
                              >
                                + Capital
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Profit Periods & Distributions */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Profit & Loss Accounting Periods</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gross collection is not profit. Principal is receivable recovery. Only collected finance charges are recognized as operating income.
                </p>
              </div>
              {profile.isAdmin && (
                <button
                  onClick={() => setShowCalculatePeriodModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Profit Period
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Date Range</th>
                    <th className="py-3 px-4 text-right">Finance Charges (Income)</th>
                    <th className="py-3 px-4 text-right">Principal Recovery (Asset)</th>
                    <th className="py-3 px-4 text-right">Expenses</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                    <th className="py-3 px-4 text-right">Distributable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {periods.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No profit periods calculated yet. Click &quot;New Profit Period&quot; to calculate P&amp;L.
                      </td>
                    </tr>
                  ) : (
                    periods.map((period) => (
                      <tr key={period.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{period.name}</p>
                          <p className="font-mono text-xs text-indigo-400">{period.periodCode}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(period.startDate).toLocaleDateString()} &rarr;{' '}
                          {new Date(period.endDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-emerald-400">
                          {formatINR(period.totalFinanceChargeCollectedPaise / 100)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                          {formatINR(period.totalPrincipalRecoveredPaise / 100)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-rose-400">
                          {formatINR(period.totalApprovedExpensesPaise / 100)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                          {formatINR(period.netProfitPaise / 100)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                          {formatINR(period.distributableProfitPaise / 100)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                              period.status === 'DISTRIBUTED'
                                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                                : period.status === 'APPROVED'
                                ? 'bg-indigo-950/70 border-indigo-800 text-indigo-300'
                                : 'bg-amber-950/70 border-amber-800 text-amber-300'
                            }`}
                          >
                            {period.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {period.status === 'CALCULATED' && profile.isAdmin && (
                              <button
                                onClick={() => handleApprovePeriod(period.id)}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition"
                              >
                                Approve
                              </button>
                            )}

                            {period.status === 'APPROVED' && profile.isAdmin && (
                              <button
                                onClick={() => handleDistributeProfit(period)}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded flex items-center gap-1 transition shadow"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                Distribute
                              </button>
                            )}

                            {period.status === 'DISTRIBUTED' && period.profitDistribution && (
                              <button
                                onClick={() => setSelectedPeriod(selectedPeriod?.id === period.id ? null : period)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded transition"
                              >
                                {selectedPeriod?.id === period.id ? 'Hide Details' : 'View Breakdown'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expanded Distribution Breakdown */}
          {selectedPeriod && selectedPeriod.profitDistribution && (
            <div className="bg-slate-900 border border-indigo-900/40 rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-indigo-400" />
                    Distribution Snapshot: {selectedPeriod.profitDistribution.distributionNumber}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Period {selectedPeriod.name} | Total Distributed:{' '}
                    <span className="text-emerald-400 font-bold">
                      {formatINR(selectedPeriod.profitDistribution.totalDistributedPaise / 100)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPeriod(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close Breakdown
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Partner</th>
                      <th className="py-2.5 px-3">Snapshot Profit %</th>
                      <th className="py-2.5 px-3 text-right">Allocated Share</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {selectedPeriod.profitDistribution.details?.map((detail) => (
                      <tr key={detail.id}>
                        <td className="py-2.5 px-3 font-medium text-white">
                          {detail.partner?.name || 'Partner'} ({detail.partner?.partnerCode || ''})
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-300">
                          {Number(detail.profitRatioSnapshot).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatINR(detail.allocatedSharePaise / 100)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 text-xs rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800">
                            {detail.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD PARTNER */}
      {/* ========================================================================= */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Register New Partner
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Create a partner equity holder with initial effective-dated ratios.
            </p>

            <form onSubmit={handleAddPartner} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Partner Code *</label>
                  <input
                    type="text"
                    required
                    value={newPartner.partnerCode}
                    onChange={(e) => setNewPartner({ ...newPartner, partnerCode: e.target.value.toUpperCase() })}
                    placeholder="PRT-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newPartner.email}
                  onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                  placeholder="partner@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Linked App Login (Optional)</label>
                <select
                  value={newPartner.userProfileId}
                  onChange={(e) => setNewPartner({ ...newPartner, userProfileId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">None (External Investor)</option>
                  {candidateUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Capital %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={newPartner.capitalRatio}
                    onChange={(e) => setNewPartner({ ...newPartner, capitalRatio: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1">Profit %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={newPartner.profitRatio}
                    onChange={(e) => setNewPartner({ ...newPartner, profitRatio: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-400 mb-1">Loss %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={newPartner.lossRatio}
                    onChange={(e) => setNewPartner({ ...newPartner, lossRatio: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECORD CAPITAL CONTRIBUTION */}
      {/* ========================================================================= */}
      {showCapitalModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              Record Capital Contribution
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Capital contribution is tracked as equity. Physical deposit into a Cash Bag is separate and optional.
            </p>

            <form onSubmit={handleRecordCapital} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Partner *</label>
                <select
                  required
                  value={capitalForm.partnerId}
                  onChange={(e) => setCapitalForm({ ...capitalForm, partnerId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select a partner...</option>
                  {partners
                    .filter((p) => p.status === 'ACTIVE')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.partnerCode}) — Bal: {formatINR(p.capitalBalancePaise / 100)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount (₹ Rupees) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={capitalForm.amountRupees}
                  onChange={(e) => setCapitalForm({ ...capitalForm, amountRupees: e.target.value })}
                  placeholder="e.g. 50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Entry Type</label>
                  <select
                    value={capitalForm.entryType}
                    onChange={(e) => setCapitalForm({ ...capitalForm, entryType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="ADDITIONAL_CONTRIBUTION">Additional Contribution</option>
                    <option value="INITIAL_CONTRIBUTION">Initial Contribution</option>
                    <option value="CAPITAL_ADJUSTMENT">Capital Adjustment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payment Mode</label>
                  <select
                    value={capitalForm.paymentMode}
                    onChange={(e) => setCapitalForm({ ...capitalForm, paymentMode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Physical Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Physical Deposit into Cash Bag / Vault (Optional)
                </label>
                <select
                  value={capitalForm.depositToCashBagId}
                  onChange={(e) => setCapitalForm({ ...capitalForm, depositToCashBagId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="">No Cash Bag Deposit (Deposited to Bank)</option>
                  {cashBags.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Only select if physical cash was handed over to a collector bag or vault.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">UTR / Bank Reference</label>
                <input
                  type="text"
                  value={capitalForm.reference}
                  onChange={(e) => setCapitalForm({ ...capitalForm, reference: e.target.value })}
                  placeholder="e.g. UTR-AXIS-992144"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCapitalModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Post Capital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: UPDATE RATIOS */}
      {/* ========================================================================= */}
      {showRatioModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-400" />
              Update Partner Ratios
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Ratios are effective-dated. Past distributions freeze their ratio snapshot and will never mutate.
            </p>

            <form onSubmit={handleUpdateRatio} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Partner</label>
                <p className="text-sm font-semibold text-white bg-slate-950 p-2 rounded-lg border border-slate-800">
                  {selectedPartner?.name} ({selectedPartner?.partnerCode})
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Capital %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={ratioForm.capitalRatio}
                    onChange={(e) => setRatioForm({ ...ratioForm, capitalRatio: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1">Profit %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={ratioForm.profitRatio}
                    onChange={(e) => setRatioForm({ ...ratioForm, profitRatio: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-400 mb-1">Loss %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={ratioForm.lossRatio}
                    onChange={(e) => setRatioForm({ ...ratioForm, lossRatio: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Effective From Date *</label>
                <input
                  type="date"
                  required
                  value={ratioForm.effectiveFrom}
                  onChange={(e) => setRatioForm({ ...ratioForm, effectiveFrom: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRatioModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Save New Ratios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: WITHDRAWAL (CAPITAL / DRAWING) */}
      {/* ========================================================================= */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-amber-400" />
              Partner Withdrawal
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Withdrawal reduces partner capital strictly when actually paid out.
            </p>

            <form onSubmit={handleRecordWithdrawal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Partner *</label>
                <select
                  required
                  value={withdrawalForm.partnerId}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, partnerId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">Select a partner...</option>
                  {partners
                    .filter((p) => p.status === 'ACTIVE')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.partnerCode}) — Bal: {formatINR(p.capitalBalancePaise / 100)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount (₹ Rupees) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={withdrawalForm.amountRupees}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amountRupees: e.target.value })}
                  placeholder="e.g. 10000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Type</label>
                  <select
                    value={withdrawalForm.withdrawalType}
                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, withdrawalType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="CAPITAL_WITHDRAWAL">Capital Withdrawal</option>
                    <option value="PROFIT_DRAWING">Profit Drawing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payout Mode</label>
                  <select
                    value={withdrawalForm.paymentMode}
                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, paymentMode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash Bag Payout</option>
                  </select>
                </div>
              </div>

              {withdrawalForm.paymentMode === 'CASH' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payout Cash Bag *</label>
                  <select
                    required
                    value={withdrawalForm.withdrawFromCashBagId}
                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, withdrawFromCashBagId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="">Select Cash Bag...</option>
                    {cashBags.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reference / Note</label>
                <input
                  type="text"
                  value={withdrawalForm.reference}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, reference: e.target.value })}
                  placeholder="e.g. IMPS ref or voucher number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowWithdrawalModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Process Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CALCULATE PROFIT PERIOD */}
      {/* ========================================================================= */}
      {showCalculatePeriodModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Calculate Operational P&amp;L Period
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Calculates revenue strictly from actually collected finance charges minus approved expenses. Principal repayment is excluded from profit.
            </p>

            <form onSubmit={handleCalculatePeriod} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Period Code *</label>
                <input
                  type="text"
                  required
                  value={periodForm.periodCode}
                  onChange={(e) => setPeriodForm({ ...periodForm, periodCode: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Period Name *</label>
                <input
                  type="text"
                  required
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  placeholder="e.g. November 2026 Operations"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Retained Earnings / Reserve (₹ Rupees)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={periodForm.retainedEarningsRupees}
                  onChange={(e) => setPeriodForm({ ...periodForm, retainedEarningsRupees: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Reserve withheld for future bad debt protection and business growth.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCalculatePeriodModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Calculate Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
