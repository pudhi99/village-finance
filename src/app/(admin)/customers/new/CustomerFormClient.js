'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createCustomer,
  checkCustomerDuplicates,
} from '@/features/customers/server-actions';
import {
  User,
  Phone,
  Home,
  MapPin,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

export default function CustomerFormClient({ villages, lines }) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    fatherOrSpouseName: '',
    gender: 'MALE',
    dateOfBirth: '',
    occupation: '',
    monthlyIncomeRupees: '',
    villageId: villages[0]?.id || '',
    areaId: '',
    phoneNumber: '',
    phoneType: 'PRIMARY',
    ownerName: '',
    addressLine: '',
    landmark: '',
    pincode: '',
    lineId: lines[0]?.id || '',
  });

  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available areas for selected village
  const selectedVillage = villages.find((v) => v.id === formData.villageId);
  const availableAreas = selectedVillage?.areas || [];

  // Debounced duplicate check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.phoneNumber.length === 10 || (formData.fullName.length > 2 && formData.villageId)) {
        setIsCheckingDuplicates(true);
        try {
          const matches = await checkCustomerDuplicates({
            fullName: formData.fullName,
            phoneNumber: formData.phoneNumber,
            villageId: formData.villageId,
          });
          setDuplicateMatches(matches);
        } catch {
          // Ignore background check errors
        } finally {
          setIsCheckingDuplicates(false);
        }
      } else {
        setDuplicateMatches([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.phoneNumber, formData.fullName, formData.villageId]);

  function handleChange(field, value) {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'villageId') {
        // Reset areaId when village changes
        next.areaId = '';
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        monthlyIncomeRupees: formData.monthlyIncomeRupees
          ? parseFloat(formData.monthlyIncomeRupees)
          : null,
        areaId: formData.areaId || null,
        lineId: formData.lineId || null,
      };

      const res = await createCustomer(payload);
      router.push(`/customers/${res.customerId}`);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button & title */}
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to customer directory</span>
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">New Customer Registration</h1>
        <p className="text-slate-400 text-sm mt-1">
          Create a village borrower profile, primary contact number, and recurring Line assignment.
        </p>
      </div>

      {/* Advisory Duplicate Banner */}
      {duplicateMatches.length > 0 && (
        <div className="bg-amber-950/70 border border-amber-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Advisory Duplicate Matches Detected ({duplicateMatches.length})</span>
          </div>
          <div className="space-y-1.5 text-xs text-amber-200/90 pl-6">
            {duplicateMatches.map((m, idx) => (
              <div key={idx} className="flex items-start justify-between">
                <span>• {m.detail}</span>
                <Link
                  href={`/customers/${m.customerId}`}
                  target="_blank"
                  className="underline hover:text-white ml-2 shrink-0 font-medium"
                >
                  View Profile ↗
                </Link>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-400/80 pl-6 italic">
            Note: Records are never auto-merged. If this is a repeat borrower, please search their existing profile.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-200 text-sm rounded-xl p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-8 shadow-sm">
        {/* Section 1: Demographics */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <User className="w-4 h-4 text-blue-400" />
            <span>Borrower Demographics</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Legal Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="e.g. Kondaveeti Lakshmi"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Father or Spouse Name
              </label>
              <input
                type="text"
                value={formData.fatherOrSpouseName}
                onChange={(e) => handleChange('fatherOrSpouseName', e.target.value)}
                placeholder="e.g. Venkata Rao"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Occupation / Trade
              </label>
              <input
                type="text"
                value={formData.occupation}
                onChange={(e) => handleChange('occupation', e.target.value)}
                placeholder="e.g. Tailoring, Small Dairy, Kirana"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Est. Monthly Income (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={formData.monthlyIncomeRupees}
                onChange={(e) => handleChange('monthlyIncomeRupees', e.target.value)}
                placeholder="e.g. 15000"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Contact Numbers */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>Primary Contact Number</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Mobile Number (10 Digits) <span className="text-red-400">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-800 bg-slate-950 text-slate-400 text-sm font-mono">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  pattern="[6-9][0-9]{9}"
                  value={formData.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  placeholder="9876543210"
                  className="w-full bg-slate-950 border border-slate-800 text-white font-mono rounded-r-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Phone Type
              </label>
              <select
                value={formData.phoneType}
                onChange={(e) => handleChange('phoneType', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PRIMARY">Primary Personal</option>
                <option value="FAMILY">Family Shared</option>
                <option value="GUARANTOR">Guarantor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Village & Address */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Home className="w-4 h-4 text-amber-400" />
            <span>Residential Address & Village</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Village <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.villageId}
                onChange={(e) => handleChange('villageId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Area / Ward
              </label>
              <select
                value={formData.areaId}
                onChange={(e) => handleChange('areaId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Area (Optional)</option>
                {availableAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Door / Street Address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.addressLine}
                onChange={(e) => handleChange('addressLine', e.target.value)}
                placeholder="e.g. D.No 4-12, Near Ramalayam Temple"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Landmark
              </label>
              <input
                type="text"
                value={formData.landmark}
                onChange={(e) => handleChange('landmark', e.target.value)}
                placeholder="e.g. Opposite Water Tank"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Pincode
              </label>
              <input
                type="text"
                maxLength={6}
                value={formData.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                placeholder="533437"
                className="w-full bg-slate-950 border border-slate-800 text-white font-mono rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Collection Line Assignment */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <MapPin className="w-4 h-4 text-purple-400" />
            <span>Assigned Collection Line</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Assigned Recurring Line
            </label>
            <select
              value={formData.lineId}
              onChange={(e) => handleChange('lineId', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned (Assign later)</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.weekday} {l.session} ({l.code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Borrower dues will be scheduled and collected during this recurring session.
            </p>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Link
            href="/customers"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow transition-colors"
          >
            {isSubmitting ? 'Creating Customer…' : 'Register Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
