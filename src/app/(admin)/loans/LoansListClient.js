'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function LoansListClient({ initialLoans, totalCount, schemes, userProfile }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schemeFilter, setSchemeFilter] = useState('ALL');

  const filteredLoans = initialLoans.filter((loan) => {
    const matchesSearch =
      loan.loanNumber.toLowerCase().includes(search.toLowerCase()) ||
      loan.customerName.toLowerCase().includes(search.toLowerCase()) ||
      loan.customerNumber.toLowerCase().includes(search.toLowerCase()) ||
      loan.primaryPhone.includes(search);

    const matchesStatus = statusFilter === 'ALL' || loan.status === statusFilter;
    const matchesScheme = schemeFilter === 'ALL' || loan.schemeCode === schemeFilter;

    return matchesSearch && matchesStatus && matchesScheme;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">Submitted</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">Approved</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-950 text-red-300 border border-red-800">Rejected</span>;
      case 'PARTIALLY_DISBURSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-950 text-purple-300 border border-purple-800">Partially Disbursed</span>;
      case 'DISBURSED':
      case 'ACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">Active</span>;
      case 'PAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">Fully Paid</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-950 text-rose-300 border border-rose-800">Cancelled (Recovery)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-emerald-400" />
            Loan Accounts & Sanctions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track applications, approvals, multi-tranche disbursements, and fixed schedules.
          </p>
        </div>

        <div>
          <Link
            href="/loans/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Loan Application
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search by loan #, customer name, ID, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted (Pending Review)</option>
              <option value="APPROVED">Approved</option>
              <option value="PARTIALLY_DISBURSED">Partially Disbursed</option>
              <option value="DISBURSED">Disbursed / Active</option>
              <option value="PAID">Fully Paid</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={schemeFilter}
              onChange={(e) => setSchemeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Schemes</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loan List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Loan #</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Scheme & Frequency</th>
                <th className="px-5 py-3.5 text-right">Sanctioned</th>
                <th className="px-5 py-3.5 text-right">Disbursed</th>
                <th className="px-5 py-3.5 text-right">Repayment Due</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-800/50 transition">
                  <td className="px-5 py-4">
                    <div className="font-mono font-semibold text-emerald-400">
                      {loan.loanNumber}
                    </div>
                    {loan.isOverlapping && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium mt-0.5">
                        <ShieldAlert className="w-3 h-3" /> Overlapping
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{loan.customerName}</div>
                    <div className="text-xs text-slate-400">
                      {loan.customerNumber} · {loan.villageName}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-slate-200">{loan.schemeName}</div>
                    <span className="text-xs text-slate-400 font-mono">
                      {loan.schemeCode} · {loan.frequency}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-white">
                    {formatINR(loan.sanctionedPrincipalRupees)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className={`font-medium ${
                        loan.totalDisbursedRupees === loan.sanctionedPrincipalRupees
                          ? 'text-emerald-400'
                          : loan.totalDisbursedRupees > 0
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatINR(loan.totalDisbursedRupees)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-300">
                    {formatINR(loan.totalRepaymentRupees)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {getStatusBadge(loan.status)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/loans/${loan.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}

              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No loan accounts found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
