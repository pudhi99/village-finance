'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  Filter,
  MapPin,
  Phone,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export default function CustomersListClient({
  initialCustomers,
  totalCount,
  villages,
  lines,
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [villageFilter, setVillageFilter] = useState('ALL');
  const [lineFilter, setLineFilter] = useState('ALL');

  // Client-side filtering across current batch
  const filtered = customers.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (villageFilter !== 'ALL' && c.villageName !== villageFilter) return false;
    if (lineFilter !== 'ALL' && c.currentLineCode !== lineFilter) return false;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      const matchName = c.fullName.toLowerCase().includes(s);
      const matchNum = c.customerNumber.toLowerCase().includes(s);
      const matchPhone = c.primaryPhone.includes(s);
      if (!matchName && !matchNum && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Directory</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage village borrower profiles, active phone numbers, and Line assignments.
          </p>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, phone, or customer ID (e.g. VF-CUST-...)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Village Filter */}
        <select
          value={villageFilter}
          onChange={(e) => setVillageFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Villages</option>
          {villages.map((v) => (
            <option key={v.id} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>

        {/* Line Filter */}
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Lines</option>
          {lines.map((l) => (
            <option key={l.id} value={l.code}>
              {l.name} ({l.code})
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Village & Area</th>
                <th className="px-5 py-3.5">Phone Number</th>
                <th className="px-5 py-3.5">Current Line</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-slate-400">No customers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try adjusting search filters or add a new customer.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => router.push(`/customers/${customer.id}`)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    {/* Name & ID */}
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{customer.fullName}</div>
                      <div className="text-xs font-mono text-blue-400 mt-0.5">
                        {customer.customerNumber}
                      </div>
                    </td>

                    {/* Village & Area */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{customer.villageName}</span>
                      </div>
                      <div className="text-xs text-slate-400 ml-5">{customer.areaName}</div>
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{customer.primaryPhone}</span>
                      </div>
                    </td>

                    {/* Line */}
                    <td className="px-5 py-4">
                      {customer.currentLineCode ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">
                          {customer.currentLineCode}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {customer.status === 'ACTIVE' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                      {customer.status === 'INACTIVE' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          Inactive
                        </span>
                      )}
                      {customer.status === 'BLOCKED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-950 text-red-400 border border-red-800">
                          Blocked
                        </span>
                      )}
                    </td>

                    {/* Arrow action */}
                    <td className="px-5 py-4 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-500 inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
