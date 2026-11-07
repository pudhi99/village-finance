'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  changeCustomerAddress,
  assignCustomerLine,
  recordCustomerGPS,
  attachCustomerDocument,
  updateCustomerProfile,
} from '@/features/customers/server-actions';
import {
  User,
  Phone,
  Home,
  MapPin,
  Clock,
  FileText,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Navigation,
  ExternalLink,
  Edit,
  ShieldCheck,
  Eye,
  X,
  CreditCard,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

function parseCoordinatesFromText(text) {
  if (!text) return null;
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // ignore
  }
  const trimmed = decoded.trim();

  // 1. Exact Google Maps Pin: !3d<lat>!4d<lng> (Highest accuracy for place links!)
  const pinMatch = trimmed.match(/!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)/);
  if (pinMatch) {
    return { lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]) };
  }

  // 2. Query parameter: ?q=lat,lng or &q=lat,lng or ll=lat,lng
  const qMatch = trimmed.match(/[?&](?:q|ll)=([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // 3. DMS coordinates (e.g. 16°42'43.2"N 82°12'23.0"E)
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)["'\s]*([NSEW])[\s,]+(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)["'\s]*([NSEW])/i;
  const dmsMatch = trimmed.match(dmsRegex);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1], 10) + parseInt(dmsMatch[2], 10) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;

    let lng = parseInt(dmsMatch[5], 10) + parseInt(dmsMatch[6], 10) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;

    return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
  }

  // 4. Raw "lat, lng" coordinates (e.g. "16.712001, 82.206401")
  const rawMatch = trimmed.match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 5. Fallback: Google Maps map center /@lat,lng
  const atMatch = trimmed.match(/@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  return null;
}

export default function CustomerDetailsClient({ customer, villages, lines }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [installmentFilter, setInstallmentFilter] = useState('ALL'); // 'ALL' | 'PAID' | 'MISSED' | 'UPCOMING'

  // Modals state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [manualGpsModalOpen, setManualGpsModalOpen] = useState(false);
  const [manualGpsInput, setManualGpsInput] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [isSavingManualGps, setIsSavingManualGps] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    fullName: customer.fullName,
    fatherOrSpouseName: customer.fatherOrSpouseName || '',
    gender: customer.gender || '',
    dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
    occupation: customer.occupation || '',
    monthlyIncomeRupees: customer.monthlyIncomePaise ? customer.monthlyIncomePaise / 100 : '',
    status: customer.status,
  });

  // Address form
  const [addressForm, setAddressForm] = useState({
    villageId: customer.villageId,
    areaId: customer.areaId || '',
    addressLine: customer.addresses.find((a) => a.isCurrent)?.addressLine || '',
    landmark: customer.addresses.find((a) => a.isCurrent)?.landmark || '',
    pincode: customer.addresses.find((a) => a.isCurrent)?.pincode || '',
  });

  // Line form
  const [selectedLineId, setSelectedLineId] = useState(
    customer.lineAssignments.find((la) => la.isCurrent)?.lineId || ''
  );

  // Document upload form
  const [docType, setDocType] = useState('AADHAAR');
  const [docNumber, setDocNumber] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // GPS capture state
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);

  // Alerts
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const currentAddress = customer.addresses.find((a) => a.isCurrent);
  const currentLine = customer.lineAssignments.find((la) => la.isCurrent);
  const primaryPhone = customer.phones.find((p) => p.isPrimary) || customer.phones[0];
  const primaryLocation = customer.locations.find((l) => l.isPrimary) || customer.locations[0];

  const selectedVillage = villages.find((v) => v.id === addressForm.villageId);
  const availableAreas = selectedVillage?.areas || [];

  async function handleProfileUpdate(e) {
    e.preventDefault();
    setActionError(null);
    try {
      await updateCustomerProfile({
        customerId: customer.id,
        ...profileForm,
        monthlyIncomeRupees: profileForm.monthlyIncomeRupees ? Number(profileForm.monthlyIncomeRupees) : null,
      });
      setProfileModalOpen(false);
      setActionSuccess('Customer profile updated successfully.');
      router.refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleAddressChange(e) {
    e.preventDefault();
    setActionError(null);
    try {
      await changeCustomerAddress(customer.id, addressForm);
      setAddressModalOpen(false);
      setActionSuccess('Customer address successfully updated and recorded in history.');
      router.refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleLineChange(e) {
    e.preventDefault();
    setActionError(null);
    try {
      await assignCustomerLine(customer.id, selectedLineId);
      setLineModalOpen(false);
      setActionSuccess('Customer collection line reassigned with audit trail.');
      router.refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleCaptureGPS() {
    if (!navigator.geolocation) {
      setActionError('Geolocation is not supported by your browser.');
      return;
    }

    setIsCapturingGPS(true);
    setActionError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await recordCustomerGPS(customer.id, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'DEVICE_GPS',
          });
          setActionSuccess(`GPS location captured (accuracy: ±${Math.round(pos.coords.accuracy)}m)`);
          router.refresh();
        } catch (err) {
          setActionError(err.message);
        } finally {
          setIsCapturingGPS(false);
        }
      },
      (err) => {
        setActionError(`GPS Error: ${err.message}`);
        setIsCapturingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleSaveManualGPS(e) {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setActionError('Please enter valid Latitude (-90 to 90) and Longitude (-180 to 180).');
      return;
    }

    setIsSavingManualGps(true);
    setActionError(null);
    try {
      await recordCustomerGPS(customer.id, {
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        source: 'MANUAL',
      });
      setActionSuccess('Customer location successfully recorded from WhatsApp / coordinates!');
      setManualGpsModalOpen(false);
      setManualGpsInput('');
      setManualLat('');
      setManualLng('');
      router.refresh();
    } catch (err) {
      setActionError(err.message || 'Failed to save location coordinates.');
    } finally {
      setIsSavingManualGps(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setActionError(null);

    try {
      // 1. Get signed signature from server
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'customer-document' }),
      });

      if (!signRes.ok) {
        const errData = await signRes.json();
        throw new Error(errData.error || 'Failed to authorize document upload.');
      }

      const sig = await signRes.json();

      // 2. Upload directly to Cloudinary
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('api_key', sig.apiKey);
      uploadData.append('timestamp', sig.timestamp);
      uploadData.append('signature', sig.signature);
      uploadData.append('folder', sig.folder);
      uploadData.append('public_id', sig.publicId);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: 'POST', body: uploadData }
      );

      if (!cloudRes.ok) {
        throw new Error('Cloudinary upload failed.');
      }

      const uploaded = await cloudRes.json();

      // 3. Attach metadata in PostgreSQL
      await attachCustomerDocument(customer.id, {
        publicId: uploaded.public_id,
        secureUrl: uploaded.secure_url,
        bytes: uploaded.bytes,
        format: uploaded.format,
        documentType: docType,
        documentNumber: docNumber,
      });

      setDocModalOpen(false);
      setActionSuccess('Document uploaded and securely verified.');
      router.refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button & Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to customer directory</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">{customer.fullName}</h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              {customer.customerNumber}
            </span>
            {customer.status === 'ACTIVE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {customer.status}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
            <span>Village: {customer.village.name}</span>
            <span>•</span>
            <span>Phone: {primaryPhone?.phoneNumber || 'No phone'}</span>
            <span>•</span>
            <span>Assigned Line: {currentLine?.line?.name || 'Unassigned'}</span>
          </div>
        </div>

        {/* Action quick buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActionError(null);
              setProfileForm({
                fullName: customer.fullName,
                fatherOrSpouseName: customer.fatherOrSpouseName || '',
                gender: customer.gender || '',
                dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
                occupation: customer.occupation || '',
                monthlyIncomeRupees: customer.monthlyIncomePaise ? customer.monthlyIncomePaise / 100 : '',
                status: customer.status,
              });
              setProfileModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit Profile
          </button>
          <button
            onClick={() => setLineModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
          >
            Change Line
          </button>
          <button
            onClick={() => setAddressModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
          >
            Update Address
          </button>
          <button
            onClick={() => setDocModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="border-b border-slate-800 flex flex-wrap gap-4 sm:gap-6 text-sm font-medium">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'loans', label: `Loans & Repayments (${customer.loans?.length || 0})` },
          { id: 'history', label: 'Address & Line History' },
          { id: 'gps', label: 'GPS Coordinates' },
          { id: 'documents', label: `Documents (${customer.documents?.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 transition-colors border-b-2 font-medium text-sm cursor-pointer ${
              activeTab === tab.id
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Active Loan Summary Banner in Overview Tab */}
          {customer.loans && customer.loans.length > 0 && (
            <div className="md:col-span-2 bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-100">
                        {customer.loans[0].schemeName}
                      </h2>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                        {customer.loans[0].status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Loan Number: <span className="font-mono text-slate-300">{customer.loans[0].loanNumber}</span> • Disbursed: {customer.loans[0].createdAtFormatted}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('loans')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <span>View Full Repayment Track</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Financial Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">Total Scheduled</span>
                  <span className="text-sm sm:text-base font-bold text-slate-100">
                    {formatINR(customer.loans[0].totalRepaymentRupees)}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">Collected So Far</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400">
                    {formatINR(customer.loans[0].totalPaidRupees)}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">Remaining Due</span>
                  <span className="text-sm sm:text-base font-bold text-amber-400">
                    {formatINR(customer.loans[0].remainingRupees)}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">Installments Status</span>
                  <span className="text-xs font-bold text-slate-200 mt-1 flex items-center gap-2">
                    <span className="text-emerald-400">✓ {customer.loans[0].paidCount} Paid</span>
                    {customer.loans[0].missedCount > 0 && (
                      <span className="text-rose-400">✗ {customer.loans[0].missedCount} Missed</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Repayment Progress</span>
                  <span className="text-emerald-400 font-semibold">{customer.loans[0].progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-800/80 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${customer.loans[0].progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {/* Demographics Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <span>Demographic Profile</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Full Name</span>
                <span className="text-white font-medium text-sm">{customer.fullName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Father / Spouse</span>
                <span className="text-slate-200">{customer.fatherOrSpouseName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Gender</span>
                <span className="text-slate-200">{customer.gender || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Date of Birth</span>
                <span className="text-slate-200">
                  {customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Occupation</span>
                <span className="text-slate-200">{customer.occupation || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Monthly Income</span>
                <span className="text-slate-200 font-mono">
                  {customer.monthlyIncomePaise ? formatINR(customer.monthlyIncomePaise) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Current Address & Line */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-400" />
              <span>Current Residential Address</span>
            </h2>
            {currentAddress ? (
              <div className="text-xs space-y-1.5">
                <p className="text-white font-medium">{currentAddress.addressLine}</p>
                {currentAddress.landmark && (
                  <p className="text-slate-400">Landmark: {currentAddress.landmark}</p>
                )}
                <p className="text-slate-400">
                  {currentAddress.village.name}
                  {currentAddress.area ? `, ${currentAddress.area.name}` : ''}{' '}
                  {currentAddress.pincode ? `— ${currentAddress.pincode}` : ''}
                </p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Effective from: {new Date(currentAddress.effectiveFrom).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-slate-500 text-xs">No address recorded.</p>
            )}

            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-xs text-slate-500 block mb-1">Active Collection Line</span>
              {currentLine ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">
                    {currentLine.line.code}
                  </span>
                  <span className="text-xs text-slate-300">
                    {currentLine.line.name} ({currentLine.line.weekday} {currentLine.line.session})
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">Unassigned</span>
              )}
            </div>
          </div>

          {/* Registered Phones Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 md:col-span-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>Contact Phone Numbers</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {customer.phones.map((phone) => (
                <div
                  key={phone.id}
                  className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs text-white block font-medium">
                      +91 {phone.phoneNumber}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {phone.phoneType} {phone.ownerName ? `(${phone.ownerName})` : ''}
                    </span>
                  </div>
                  {phone.isPrimary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: LOANS & REPAYMENT TRACK */}
      {activeTab === 'loans' && (
        <div className="space-y-6">
          {!customer.loans || customer.loans.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
              <CreditCard className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">No Loans Recorded</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                This customer does not have any active or past loans disbursed yet.
              </p>
            </div>
          ) : (
            customer.loans.map((loan) => {
              const filteredInstallments = (loan.installments || []).filter((inst) => {
                if (installmentFilter === 'PAID') return inst.status === 'PAID';
                if (installmentFilter === 'MISSED') return inst.status === 'MISSED';
                if (installmentFilter === 'UPCOMING') return inst.status === 'UPCOMING' || inst.status === 'PARTIALLY_PAID';
                return true;
              });

              return (
                <div key={loan.id} className="space-y-6">
                  {/* Loan Header Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-emerald-400" />
                            {loan.schemeName}
                          </h2>
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {loan.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Loan Number: <span className="font-mono text-slate-200">{loan.loanNumber}</span> • Disbursed Date: {loan.createdAtFormatted} • Frequency: {loan.frequency}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Total Repayment Scheduled</span>
                        <span className="text-xl font-bold text-white font-mono">{formatINR(loan.totalRepaymentRupees)}</span>
                      </div>
                    </div>

                    {/* Financial Summary 4-Col Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/60">
                        <span className="text-[11px] text-slate-400 block">Sanctioned Principal</span>
                        <span className="text-sm font-bold text-slate-200 mt-0.5 block">{formatINR(loan.sanctionedPrincipalRupees)}</span>
                        <span className="text-[10px] text-slate-500">Finance charge: {formatINR(loan.totalFinanceChargeRupees)}</span>
                      </div>
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/60">
                        <span className="text-[11px] text-slate-400 block">Total Collected</span>
                        <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{formatINR(loan.totalPaidRupees)}</span>
                        <span className="text-[10px] text-emerald-500/80">{loan.paidCount} installments settled</span>
                      </div>
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/60">
                        <span className="text-[11px] text-slate-400 block">Remaining Due</span>
                        <span className="text-sm font-bold text-amber-400 mt-0.5 block">{formatINR(loan.remainingRupees)}</span>
                        <span className="text-[10px] text-amber-500/80">{loan.upcomingCount} installments left</span>
                      </div>
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/60">
                        <span className="text-[11px] text-slate-400 block">Repayment Progress</span>
                        <span className="text-sm font-bold text-slate-200 mt-0.5 block">{loan.progressPercent}%</span>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${loan.progressPercent}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Installment Breakdown by Dates */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span>Installment Schedule & Date-wise Payment Status</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Track which scheduled dates were paid on time, and which dates were missed.
                        </p>
                      </div>

                      {/* Filter Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                        {[
                          { id: 'ALL', label: `All (${loan.installments.length})` },
                          { id: 'PAID', label: `Paid (${loan.paidCount})`, color: 'text-emerald-400' },
                          { id: 'MISSED', label: `Missed (${loan.missedCount})`, color: 'text-rose-400' },
                          { id: 'UPCOMING', label: `Upcoming (${loan.upcomingCount})`, color: 'text-slate-400' },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setInstallmentFilter(btn.id)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                              installmentFilter === btn.id
                                ? 'bg-slate-800 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className={btn.color}>{btn.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Installments Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                            <th className="py-2.5 px-3">Inst #</th>
                            <th className="py-2.5 px-3">Scheduled Due Date</th>
                            <th className="py-2.5 px-3">Due Amount</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Actual Payment Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {filteredInstallments.map((inst) => (
                            <tr
                              key={inst.id}
                              className={`transition hover:bg-slate-800/40 ${
                                inst.status === 'PAID'
                                  ? 'bg-emerald-950/10'
                                  : inst.status === 'MISSED'
                                  ? 'bg-rose-950/20'
                                  : ''
                              }`}
                            >
                              <td className="py-3 px-3 font-mono font-semibold text-slate-300">
                                Week #{inst.installmentNumber}
                              </td>
                              <td className="py-3 px-3 text-slate-200 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  {inst.dueDateFormatted}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-100">
                                {formatINR(inst.totalDueRupees)}
                              </td>
                              <td className="py-3 px-3">
                                {inst.status === 'PAID' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    PAID
                                  </span>
                                ) : inst.status === 'MISSED' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                    NOT PAID (MISSED)
                                  </span>
                                ) : inst.status === 'PARTIALLY_PAID' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                    PARTIAL
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    UPCOMING
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-xs">
                                {inst.status === 'PAID' ? (
                                  <div className="space-y-0.5">
                                    <span className="text-emerald-400 font-semibold block">
                                      ✓ Paid {formatINR(inst.totalPaidRupees)} on {inst.paidAtFormatted || inst.dueDateFormatted}
                                    </span>
                                    {inst.paymentNumber && (
                                      <span className="text-[11px] font-mono text-slate-400">
                                        Receipt: {inst.paymentNumber} {inst.paymentMode && `(${inst.paymentMode})`}
                                      </span>
                                    )}
                                  </div>
                                ) : inst.status === 'MISSED' ? (
                                  <span className="text-rose-400 font-medium">
                                    No payment recorded for this scheduled week
                                  </span>
                                ) : inst.status === 'PARTIALLY_PAID' ? (
                                  <span className="text-amber-400 font-medium">
                                    Paid {formatINR(inst.totalPaidRupees)} • Balance: {formatINR(inst.balanceRupees)}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">
                                    Future scheduled installment
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Payment Receipts History Table */}
                  {loan.payments && loan.payments.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="border-b border-slate-800 pb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-emerald-400" />
                          <span>Collected Repayment Receipts ({loan.payments.length})</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Authoritative log of all cash and digital repayments received for this loan.
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                              <th className="py-2.5 px-3">Receipt #</th>
                              <th className="py-2.5 px-3">Date Collected</th>
                              <th className="py-2.5 px-3">Amount</th>
                              <th className="py-2.5 px-3">Payment Mode</th>
                              <th className="py-2.5 px-3">Collected By</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-medium">
                            {loan.payments.map((pmt) => (
                              <tr key={pmt.id} className="hover:bg-slate-800/30">
                                <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                                  {pmt.paymentNumber}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  {pmt.collectedAtFormatted}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-100">
                                  {formatINR(pmt.amountRupees)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                                    {pmt.mode}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">
                                  {pmt.collectedByName}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="text-emerald-400 font-bold text-xs">
                                    ✓ {pmt.status}
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
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: ADDRESS & LINE HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Address History */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-400" />
              <span>Address History Audit</span>
            </h2>
            <div className="space-y-3">
              {customer.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                    addr.isCurrent
                      ? 'border-blue-800 bg-blue-950/20 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="font-medium text-slate-200">
                      {addr.addressLine} {addr.landmark ? `(${addr.landmark})` : ''}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {addr.village.name} {addr.area ? `, ${addr.area.name}` : ''}{' '}
                      {addr.pincode ? `— ${addr.pincode}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    {addr.isCurrent ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Current
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {new Date(addr.effectiveFrom).toLocaleDateString()} —{' '}
                        {addr.effectiveTo ? new Date(addr.effectiveTo).toLocaleDateString() : 'Past'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Line Assignment History */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-400" />
              <span>Line Assignment History</span>
            </h2>
            <div className="space-y-3">
              {customer.lineAssignments.map((la) => (
                <div
                  key={la.id}
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                    la.isCurrent
                      ? 'border-purple-800 bg-purple-950/20 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="font-medium text-slate-200">
                      {la.line.name} ({la.line.code}) — {la.line.weekday} {la.line.session}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Assigned by: {la.assigner.fullName}
                    </div>
                  </div>
                  <div className="text-right">
                    {la.isCurrent ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-400 border border-purple-800">
                        Current Line
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {new Date(la.effectiveFrom).toLocaleDateString()} —{' '}
                        {la.effectiveTo ? new Date(la.effectiveTo).toLocaleDateString() : 'Past'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GPS LOCATION */}
      {activeTab === 'gps' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-400" />
                <span>Geospatial Verification (PostGIS)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Field collector GPS coordinates with accuracy metrics for distance radius filtering.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setManualGpsInput('');
                  setManualLat('');
                  setManualLng('');
                  setManualGpsModalOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Add from WhatsApp / Maps</span>
              </button>
              <button
                onClick={handleCaptureGPS}
                disabled={isCapturingGPS}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{isCapturingGPS ? 'Acquiring GPS…' : 'Capture Field GPS'}</span>
              </button>
            </div>
          </div>

          {/* Active coordinates summary */}
          {primaryLocation ? (
            <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 font-sans block text-[11px]">Latitude</span>
                  <span className="text-white text-sm font-semibold">{primaryLocation.latitude.toFixed(6)}°</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans block text-[11px]">Longitude</span>
                  <span className="text-white text-sm font-semibold">{primaryLocation.longitude.toFixed(6)}°</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans block text-[11px]">Accuracy</span>
                  <span className="text-emerald-400 font-medium">
                    {primaryLocation.accuracy ? `±${Math.round(primaryLocation.accuracy)} m` : 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans block text-[11px]">Captured By</span>
                  <span className="text-slate-200 font-sans">{primaryLocation.actor.fullName}</span>
                </div>
              </div>
              <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 font-sans border-t border-slate-800">
                <div>
                  Timestamp: {new Date(primaryLocation.capturedAt).toLocaleString()} via{' '}
                  <span className="text-slate-300 font-medium">{primaryLocation.source}</span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${primaryLocation.latitude},${primaryLocation.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-medium transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 p-8 rounded-xl text-center text-slate-500 text-xs">
              <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <span>No GPS coordinates recorded yet for this customer.</span>
            </div>
          )}

          {/* GPS History Table */}
          {customer.locations.length > 1 && (
            <div className="space-y-2 pt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Location Capture Audit History
              </h3>
              <div className="space-y-1.5 text-xs font-mono">
                {customer.locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between"
                  >
                    <span>
                      {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)} (±{loc.accuracy || '?'}m)
                    </span>
                    <span className="text-slate-500 font-sans text-[11px]">
                      {new Date(loc.capturedAt).toLocaleDateString()} by {loc.actor.fullName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Verified Customer Documents</h2>
            <button
              onClick={() => setDocModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload New Document</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {customer.documents.length === 0 ? (
              <div className="sm:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <span>No identity documents or photos uploaded yet.</span>
              </div>
            ) : (
              customer.documents.map((doc) => {
                const isImage =
                  !doc.mediaAsset.format ||
                  ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(doc.mediaAsset.format.toLowerCase()) ||
                  doc.mediaAsset.secureUrl?.match(/\.(jpg|jpeg|png|webp|svg)($|\?)/i);

                return (
                  <div
                    key={doc.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors"
                  >
                    {/* Inline Image or Document Preview */}
                    <div className="relative h-44 bg-slate-950 border-b border-slate-800 flex items-center justify-center overflow-hidden group">
                      {isImage ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={doc.mediaAsset.secureUrl}
                            alt={doc.documentType}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: doc.mediaAsset.secureUrl,
                                title: doc.documentType,
                                number: doc.documentNumber,
                              })
                            }
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs backdrop-blur-xs cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                            <span>Click to Enlarge</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <FileText className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                          <span className="text-xs text-slate-400 font-mono">
                            {doc.mediaAsset.format?.toUpperCase() || 'DOCUMENT'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Document Info Card Footer */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                          {doc.documentType}
                        </span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Signed Asset</span>
                        </span>
                      </div>

                      {doc.documentNumber && (
                        <div className="text-xs font-mono text-slate-300 bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                          No: <span className="text-white font-semibold">{doc.documentNumber}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                        <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                        {doc.mediaAsset.bytes && (
                          <span>{Math.round(doc.mediaAsset.bytes / 1024)} KB</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: doc.mediaAsset.secureUrl,
                              title: doc.documentType,
                              number: doc.documentNumber,
                            })
                          }
                          className="w-full text-center py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                        <a
                          href={doc.mediaAsset.secureUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full text-center py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>Full Res</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-emerald-400" /> Edit Customer Profile
              </h2>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Father / Spouse Name</label>
                  <input
                    type="text"
                    value={profileForm.fatherOrSpouseName}
                    onChange={(e) => setProfileForm({ ...profileForm, fatherOrSpouseName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Gender</label>
                  <select
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Gender...</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={profileForm.dateOfBirth}
                    onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={profileForm.occupation}
                    onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Monthly Income (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 15000"
                    value={profileForm.monthlyIncomeRupees}
                    onChange={(e) => setProfileForm({ ...profileForm, monthlyIncomeRupees: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Account Status</label>
                  <select
                    value={profileForm.status}
                    onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Address Modal */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleAddressChange}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-bold text-white">Update Residential Address</h2>
            <p className="text-slate-400 text-xs">
              The previous address will be closed and preserved in the historical audit trail.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Village</label>
              <select
                required
                value={addressForm.villageId}
                onChange={(e) => setAddressForm({ ...addressForm, villageId: e.target.value, areaId: '' })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs"
              >
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Area / Ward</label>
              <select
                value={addressForm.areaId}
                onChange={(e) => setAddressForm({ ...addressForm, areaId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs"
              >
                <option value="">Select Area</option>
                {availableAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Door / Street Address</label>
              <input
                type="text"
                required
                value={addressForm.addressLine}
                onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Landmark</label>
              <input
                type="text"
                value={addressForm.landmark}
                onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Pincode</label>
              <input
                type="text"
                maxLength={6}
                value={addressForm.pincode}
                onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
              >
                Save New Address
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Change Line Modal */}
      {lineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleLineChange}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-bold text-white">Reassign Collection Line</h2>
            <p className="text-slate-400 text-xs">
              Assign borrower to a different recurring Line route. Enforces single active line assignment rule.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Line</label>
              <select
                required
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs"
              >
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.weekday} {l.session} ({l.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setLineModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
              >
                Confirm Reassignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Document Upload Modal */}
      {docModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">Upload Customer Document</h2>
            <p className="text-slate-400 text-xs">
              Uploads directly to Cloudinary with server-signed authentication.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs"
              >
                <option value="AADHAAR">Aadhaar Card</option>
                <option value="VOTER_ID">Voter ID</option>
                <option value="RATION_CARD">Ration Card</option>
                <option value="PHOTO">Customer Photograph</option>
                <option value="OTHER">Other Proof</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Document Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. XXXX-XXXX-1234"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select File (Image / PDF)</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={isUploading}
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
              {isUploading && (
                <p className="text-blue-400 text-xs mt-2 animate-pulse">
                  Uploading to Cloudinary and generating signed record…
                </p>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDocModalOpen(false)}
                disabled={isUploading}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual / WhatsApp Location Entry Modal */}
      {manualGpsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  <span>Add Location (WhatsApp / Google Maps)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste a WhatsApp pin link or type latitude & longitude directly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualGpsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualGPS} className="space-y-4">
              {/* Quick Paste Box */}
              <div>
                <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                  Paste WhatsApp Link or Coordinates
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. https://maps.google.com/?q=17.385044,78.486671 or 17.3850, 78.4866"
                    value={manualGpsInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualGpsInput(val);
                      const parsed = parseCoordinatesFromText(val);
                      if (parsed) {
                        setManualLat(parsed.lat.toString());
                        setManualLng(parsed.lng.toString());
                      }
                    }}
                    className="w-full bg-slate-950 border border-emerald-500/50 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 Tip: Copy the location message from WhatsApp and paste it here. Latitude and Longitude will fill automatically.
                </p>
              </div>

              {/* Editable Lat/Lng Fields */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 17.385044"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 78.486671"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng)) && (
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-300 font-mono">
                    📍 {parseFloat(manualLat).toFixed(6)}, {parseFloat(manualLng).toFixed(6)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${manualLat},${manualLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <span>Verify on Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setManualGpsModalOpen(false)}
                  disabled={isSavingManualGps}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingManualGps || !manualLat || !manualLng}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition shadow-md shadow-emerald-950/40"
                >
                  {isSavingManualGps ? 'Saving Location…' : 'Save Customer Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-4 space-y-3 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{previewImage.title}</span>
                </h4>
                {previewImage.number && (
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    No: {previewImage.number}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 text-xs font-medium flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open Full Size</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-950 rounded-xl border border-slate-800/80 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
