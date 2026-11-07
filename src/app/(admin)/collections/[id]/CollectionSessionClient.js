'use client';

import { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/money';
import {
  getAssignedCustomersForSession,
  recordCustomerVisit,
  startCollectionSession,
  completeCollectionSession,
  collectRepaymentInSession,
} from '@/features/collections/server-actions';
import {
  Compass,
  MapPin,
  Phone,
  Navigation,
  CheckCircle,
  Clock,
  Search,
  Filter,
  AlertTriangle,
  CreditCard,
  User,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import PreTripDownloadButton from '@/components/offline/PreTripDownloadButton';

export default function CollectionSessionClient({
  session,
  initialCustomers = [],
  totalAssignedCount = 0,
  currentUser,
  userProfile,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // GPS State
  const [collectorLocation, setCollectorLocation] = useState(null); // { lat, lng, accuracy }
  const [gpsStatus, setGpsStatus] = useState('IDLE'); // 'IDLE' | 'ACQUIRING' | 'ACTIVE' | 'DENIED' | 'UNAVAILABLE'
  const [gpsError, setGpsError] = useState(null);

  // Filters State
  const [radiusMeters, setRadiusMeters] = useState(null); // null means "All"
  const [search, setSearch] = useState('');
  const [visitStatusFilter, setVisitStatusFilter] = useState('ALL');

  // Customer List State
  const [customers, setCustomers] = useState(initialCustomers);
  const [isGPSFiltered, setIsGPSFiltered] = useState(false);

  // Modal State for Logging Visit
  const [selectedCustomerForVisit, setSelectedCustomerForVisit] = useState(null);
  const [visitStatus, setVisitStatus] = useState('VISITED');
  const [visitNotes, setVisitNotes] = useState('');

  // Modal State for In-Session Payment Collection
  const [collectingCustomer, setCollectingCustomer] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMode, setCollectMode] = useState('CASH');
  const [collectNotes, setCollectNotes] = useState('');

  // Session Action State
  const [actionNotes, setActionNotes] = useState('');
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null); // { type: 'success' | 'error', text }

  // 1. GPS Acquisition Function
  const acquireGPS = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('UNAVAILABLE');
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('ACQUIRING');
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setCollectorLocation(coords);
        setGpsStatus('ACTIVE');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsStatus(err.code === 1 ? 'DENIED' : 'UNAVAILABLE');
        setGpsError(
          err.code === 1
            ? 'GPS location permission denied. Displaying manual customer list.'
            : 'Unable to acquire accurate GPS fix. Displaying manual customer list.'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  // Request GPS once on mount inside timer/event to prevent synchronous render warnings
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCollectorLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
          setGpsStatus('ACTIVE');
        },
        (err) => {
          setGpsStatus(err.code === 1 ? 'DENIED' : 'UNAVAILABLE');
          setGpsError(
            err.code === 1
              ? 'GPS permission denied. Showing manual customer list.'
              : 'GPS unavailable. Showing manual customer list.'
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }
  }, []);

  // 2. Fetch Customer List whenever GPS, Radius, or Search changes
  const reloadCustomers = useCallback(
    (lat, lng, radius, searchQuery) => {
      startTransition(async () => {
        try {
          const res = await getAssignedCustomersForSession({
            sessionId: session.id,
            lineId: session.lineId,
            sessionDate: session.sessionDate,
            collectorLat: lat,
            collectorLng: lng,
            radiusMeters: radius,
            search: searchQuery,
          });

          setCustomers(res.customers || []);
          setIsGPSFiltered(res.isGPSFiltered || false);
        } catch (err) {
          console.error('Failed to reload customers:', err);
        }
      });
    },
    [session.id, session.lineId, session.sessionDate]
  );

  // Single debounced customer reload on GPS / radius / search filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      reloadCustomers(
        collectorLocation?.lat || null,
        collectorLocation?.lng || null,
        radiusMeters,
        search
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [collectorLocation?.lat, collectorLocation?.lng, radiusMeters, search, reloadCustomers]);

  // Client-side visit status filtering
  const filteredCustomers = useMemo(() => {
    if (visitStatusFilter === 'ALL') return customers;
    return customers.filter((c) => c.visitStatus === visitStatusFilter);
  }, [customers, visitStatusFilter]);

  // Progress metrics
  const sessionStats = useMemo(() => {
    const visited = customers.filter(
      (c) => c.visitStatus && c.visitStatus !== 'NOT_VISITED'
    ).length;
    const collected = customers.filter((c) => c.visitStatus === 'COLLECTED').length;
    const partial = customers.filter((c) => c.visitStatus === 'PARTIAL').length;
    const notAvailable = customers.filter((c) => c.visitStatus === 'NOT_AVAILABLE').length;
    const visitedNoCash = customers.filter((c) => c.visitStatus === 'VISITED').length;
    const pending = customers.filter((c) => !c.visitStatus || c.visitStatus === 'NOT_VISITED').length;

    return {
      total: totalAssignedCount || customers.length,
      visited,
      collected,
      partial,
      notAvailable,
      visitedNoCash,
      pending,
      remaining: Math.max(0, (totalAssignedCount || customers.length) - visited),
    };
  }, [customers, totalAssignedCount]);

  // Grouped customers by visit status
  const groupedCustomers = useMemo(() => {
    const groupsMeta = {
      COLLECTED: {
        status: 'COLLECTED',
        title: 'Collected Repayments',
        icon: CheckCircle2,
        badgeBg: 'bg-emerald-950/90 text-emerald-300 border-emerald-800',
        headerBg: 'from-emerald-950/50 via-slate-900 to-slate-900 border-emerald-900/60',
      },
      PARTIAL: {
        status: 'PARTIAL',
        title: 'Partially Paid',
        icon: AlertCircle,
        badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-800',
        headerBg: 'from-amber-950/50 via-slate-900 to-slate-900 border-amber-900/60',
      },
      NOT_VISITED: {
        status: 'NOT_VISITED',
        title: 'Pending Field Visits',
        icon: Clock,
        badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
        headerBg: 'from-slate-800/60 via-slate-900 to-slate-900 border-slate-800',
      },
      NOT_AVAILABLE: {
        status: 'NOT_AVAILABLE',
        title: 'Not Available / Absent',
        icon: XCircle,
        badgeBg: 'bg-rose-950/90 text-rose-300 border-rose-800',
        headerBg: 'from-rose-950/50 via-slate-900 to-slate-900 border-rose-900/60',
      },
      VISITED: {
        status: 'VISITED',
        title: 'Visited (No Payment)',
        icon: MapPin,
        badgeBg: 'bg-blue-950/90 text-blue-300 border-blue-800',
        headerBg: 'from-blue-950/50 via-slate-900 to-slate-900 border-blue-900/60',
      },
    };

    // If specific status filter selected
    if (visitStatusFilter !== 'ALL') {
      const meta = groupsMeta[visitStatusFilter] || {
        status: visitStatusFilter,
        title: visitStatusFilter.replace('_', ' '),
        icon: MapPin,
        badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
        headerBg: 'from-slate-800/60 via-slate-900 to-slate-900 border-slate-800',
      };

      const totalCollected = filteredCustomers.reduce(
        (sum, c) => sum + (c.visitPayment?.amountRupees || 0),
        0
      );

      return [
        {
          ...meta,
          customers: filteredCustomers,
          totalCollectedRupees: totalCollected,
        },
      ];
    }

    // When viewing "All Visits", group them logically
    // In completed sessions: show Collected first, then Not Available, etc.
    // In live / pending sessions: show Pending first so collector sees who is left!
    const order =
      session.status === 'COMPLETED'
        ? ['COLLECTED', 'PARTIAL', 'NOT_AVAILABLE', 'VISITED', 'NOT_VISITED']
        : ['NOT_VISITED', 'COLLECTED', 'PARTIAL', 'VISITED', 'NOT_AVAILABLE'];

    return order
      .map((statusKey) => {
        const meta = groupsMeta[statusKey];
        const list = filteredCustomers.filter((c) => {
          if (statusKey === 'NOT_VISITED') {
            return !c.visitStatus || c.visitStatus === 'NOT_VISITED';
          }
          return c.visitStatus === statusKey;
        });

        const totalCollected = list.reduce(
          (sum, c) => sum + (c.visitPayment?.amountRupees || 0),
          0
        );

        return {
          ...meta,
          customers: list,
          totalCollectedRupees: totalCollected,
        };
      })
      .filter((g) => g.customers.length > 0);
  }, [filteredCustomers, visitStatusFilter, session.status]);

  // Handlers
  async function handleOpenVisitModal(customer) {
    setSelectedCustomerForVisit(customer);
    setVisitStatus(customer.visitStatus === 'NOT_VISITED' ? 'COLLECTED' : customer.visitStatus);
    setVisitNotes(customer.visitNotes || '');
  }

  async function handleSaveVisit() {
    if (!selectedCustomerForVisit) return;
    setFeedbackMsg(null);

    startTransition(async () => {
      try {
        const payload = {
          sessionId: session.id,
          customerId: selectedCustomerForVisit.customerId,
          status: visitStatus,
          notes: visitNotes,
        };

        // Attach collector GPS if active
        if (collectorLocation) {
          payload.latitude = collectorLocation.lat;
          payload.longitude = collectorLocation.lng;
          payload.accuracy = collectorLocation.accuracy;
        }

        const res = await recordCustomerVisit(payload);

        if (res.success) {
          setFeedbackMsg({
            type: 'success',
            text: `Visit recorded for ${selectedCustomerForVisit.fullName}.`,
          });
          setSelectedCustomerForVisit(null);
          // Refresh customer list
          reloadCustomers(
            collectorLocation?.lat || null,
            collectorLocation?.lng || null,
            radiusMeters,
            search
          );
        } else {
          setFeedbackMsg({ type: 'error', text: res.error || 'Failed to record visit' });
        }
      } catch (err) {
        setFeedbackMsg({ type: 'error', text: err.message || 'Error recording visit' });
      }
    });
  }

  function handleOpenCollectModal(cust) {
    setCollectingCustomer(cust);
    const defaultAmount = cust.activeLoan?.nextDueAmountRupees || 500;
    setCollectAmount(String(defaultAmount));
    setCollectMode('CASH');
    setCollectNotes('');
  }

  function handleConfirmCollection(e) {
    if (e) e.preventDefault();
    if (!collectingCustomer || !collectingCustomer.activeLoan) return;

    const amt = parseFloat(collectAmount);
    if (!amt || amt <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid repayment amount greater than ₹0.' });
      return;
    }

    startTransition(async () => {
      try {
        const res = await collectRepaymentInSession({
          sessionId: session.id,
          customerId: collectingCustomer.customerId,
          loanId: collectingCustomer.activeLoan.id,
          amountRupees: amt,
          mode: collectMode,
          notes: collectNotes || `Field collection: ${collectingCustomer.fullName}`,
          latitude: collectorLocation?.lat,
          longitude: collectorLocation?.lng,
          accuracy: collectorLocation?.accuracy,
        });

        if (res.success) {
          // Update customer in local state
          setCustomers((prev) =>
            prev.map((c) => {
              if (c.customerId === collectingCustomer.customerId) {
                return {
                  ...c,
                  visitStatus: 'COLLECTED',
                  visitPayment: {
                    amountRupees: amt,
                  },
                  visitNotes: collectNotes,
                };
              }
              return c;
            })
          );

          if (session) {
            session.totalCollectedRupees = (session.totalCollectedRupees || 0) + amt;
          }

          setFeedbackMsg({
            type: 'success',
            text: `✓ Collected ${formatINR(amt)} from ${collectingCustomer.fullName} successfully!`,
          });
          setCollectingCustomer(null);
          router.refresh();
        } else {
          setFeedbackMsg({ type: 'error', text: res.error || 'Failed to record repayment' });
        }
      } catch (err) {
        setFeedbackMsg({ type: 'error', text: err.message || 'An unexpected error occurred' });
      }
    });
  }

  async function handleStartSession() {
    setFeedbackMsg(null);
    startTransition(async () => {
      try {
        const res = await startCollectionSession({ sessionId: session.id });
        if (res.success) {
          setFeedbackMsg({ type: 'success', text: 'Session is now IN PROGRESS!' });
          router.refresh();
        } else {
          setFeedbackMsg({ type: 'error', text: res.error || 'Failed to start session' });
        }
      } catch (err) {
        setFeedbackMsg({ type: 'error', text: err.message });
      }
    });
  }

  async function handleCompleteSession() {
    setFeedbackMsg(null);
    startTransition(async () => {
      try {
        const res = await completeCollectionSession({
          sessionId: session.id,
          notes: actionNotes,
        });
        if (res.success) {
          setFeedbackMsg({ type: 'success', text: 'Session successfully COMPLETED!' });
          setIsCompleteModalOpen(false);
          router.refresh();
        } else {
          setFeedbackMsg({ type: 'error', text: res.error || 'Failed to complete session' });
        }
      } catch (err) {
        setFeedbackMsg({ type: 'error', text: err.message });
      }
    });
  }

  const isLive = session.status === 'IN_PROGRESS';
  const isPlanned = session.status === 'PLANNED';
  const isCompleted = session.status === 'COMPLETED';

  function renderCustomerCard(cust) {
    const hasDue = cust.activeLoan && cust.activeLoan.nextDueAmountRupees > 0;
    const hasGps = cust.location && cust.location.latitude != null;

    return (
      <div
        key={cust.customerId}
        className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
      >
        <div>
          {/* Top Row: Distance & Visit Status */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {cust.distanceLabel && cust.distanceLabel !== 'N/A' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <Navigation className="w-3 h-3 text-emerald-400" />
                {cust.distanceLabel} away
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400">
                Manual order
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                cust.visitStatus === 'COLLECTED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : cust.visitStatus === 'PARTIAL'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : cust.visitStatus === 'VISITED'
                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                  : cust.visitStatus === 'NOT_AVAILABLE'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {cust.visitStatus === 'COLLECTED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              {cust.visitStatus === 'NOT_AVAILABLE' && <XCircle className="w-3 h-3 text-rose-400" />}
              {cust.visitStatus === 'PARTIAL' && <AlertCircle className="w-3 h-3 text-amber-400" />}
              {cust.visitStatus === 'NOT_VISITED' && <Clock className="w-3 h-3 text-slate-400" />}
              {cust.visitStatus ? cust.visitStatus.replace('_', ' ') : 'NOT VISITED'}
            </span>
          </div>

          {/* Customer Info */}
          <div className="mb-2">
            <h3 className="text-base font-bold text-slate-100">{cust.fullName}</h3>
            {cust.fatherOrSpouseName && (
              <div className="text-xs text-slate-400">
                c/o {cust.fatherOrSpouseName}
              </div>
            )}
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{cust.villageName} {cust.areaName !== 'N/A' && `• ${cust.areaName}`}</span>
            </div>
          </div>

          {/* Phone Link */}
          {cust.primaryPhone && cust.primaryPhone !== 'N/A' && (
            <div className="mb-3">
              <a
                href={`tel:${cust.primaryPhone}`}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-mono bg-blue-950/40 px-2.5 py-1 rounded border border-blue-900/50 transition"
              >
                <Phone className="w-3 h-3" />
                {cust.primaryPhone}
              </a>
            </div>
          )}

          {/* Active Loan Details Box */}
          {cust.activeLoan ? (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-400">Loan:</span>
                <span className="font-mono text-slate-200">
                  {cust.activeLoan.loanNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Scheme:</span>
                <span className="text-slate-300 truncate max-w-[140px]">
                  {cust.activeLoan.schemeName}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Due Installment:</span>
                <span
                  className={`font-bold ${
                    hasDue ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {formatINR(cust.activeLoan.nextDueAmountRupees)}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-slate-800/50 rounded-lg p-2 text-center text-xs text-slate-500">
              No active loan
            </div>
          )}

          {/* Visit Collected Payment Tag if collected */}
          {cust.visitPayment?.amountRupees > 0 && (
            <div className="mt-2 text-xs font-semibold bg-emerald-950/70 text-emerald-300 p-2.5 rounded-lg border border-emerald-800/60 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Collected This Session:
              </span>
              <span className="font-mono font-bold text-sm text-emerald-400">
                {formatINR(cust.visitPayment.amountRupees)}
              </span>
            </div>
          )}

          {/* Visit Notes preview if any */}
          {cust.visitNotes && (
            <div className="mt-2 text-xs text-slate-400 italic bg-slate-950/50 p-2 rounded border border-slate-800/50">
              &quot;{cust.visitNotes}&quot;
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          {/* Google Maps Directions */}
          {hasGps ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${cust.location.latitude},${cust.location.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
              title="Navigate in Google Maps"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {/* Log Visit Modal Trigger */}
            <button
              type="button"
              onClick={() => handleOpenVisitModal(cust)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Log Visit
            </button>

            {/* Inline Collect Modal Trigger */}
            {cust.activeLoan && (
              <button
                type="button"
                onClick={() => handleOpenCollectModal(cust)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-emerald-950/50 flex items-center gap-1 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Collect
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/collections"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400">
                {session.sessionNumber}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isLive
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : isPlanned
                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                    : isCompleted
                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}
              >
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {session.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <Compass className="w-6 h-6 text-emerald-400" />
              {session.line?.name} ({session.line?.code})
            </h1>
          </div>
        </div>

        {/* Top Session Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <PreTripDownloadButton sessionId={session.id} lineId={session.lineId} lineName={session.line?.name} />

          {isPlanned && (
            <button
              onClick={handleStartSession}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition shadow-lg shadow-blue-950/40 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Start Session
            </button>
          )}

          {isLive && (
            <button
              onClick={() => setIsCompleteModalOpen(true)}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-sm transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Complete Session
            </button>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span className="text-sm">{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="ml-auto text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GPS Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg border ${
              gpsStatus === 'ACTIVE'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                : gpsStatus === 'ACQUIRING'
                ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Navigation className={`w-5 h-5 ${gpsStatus === 'ACQUIRING' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Collector Geolocation:
              </span>
              <span
                className={`text-xs font-bold ${
                  gpsStatus === 'ACTIVE'
                    ? 'text-emerald-400'
                    : gpsStatus === 'ACQUIRING'
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`}
              >
                {gpsStatus === 'ACTIVE' && 'GPS Fixed & Active'}
                {gpsStatus === 'ACQUIRING' && 'Acquiring GPS fix...'}
                {gpsStatus === 'DENIED' && 'GPS Permission Denied (Manual Fallback)'}
                {gpsStatus === 'UNAVAILABLE' && 'GPS Unavailable (Manual Fallback)'}
                {gpsStatus === 'IDLE' && 'GPS Inactive'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {collectorLocation ? (
                <span>
                  Lat: <span className="font-mono text-slate-200">{collectorLocation.lat.toFixed(5)}</span> • Lng:{' '}
                  <span className="font-mono text-slate-200">{collectorLocation.lng.toFixed(5)}</span> • Acc: ±
                  {collectorLocation.accuracy}m
                </span>
              ) : (
                <span>{gpsError || 'Graceful fallback: Showing all line-assigned customers in manual order.'}</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={acquireGPS}
          disabled={gpsStatus === 'ACQUIRING'}
          className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${gpsStatus === 'ACQUIRING' ? 'animate-spin' : ''}`} />
          Refresh GPS Location
        </button>
      </div>

      {/* Progress & Route Overview Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Assigned Customers</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{sessionStats.total}</div>
          <div className="text-xs text-slate-400 mt-0.5">Active on this Line</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Visits Logged</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {sessionStats.visited} <span className="text-xs font-normal text-slate-400">/ {sessionStats.total}</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {sessionStats.total > 0 ? Math.round((sessionStats.visited / sessionStats.total) * 100) : 0}% visited
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Collections Made</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{sessionStats.collected}</div>
          <div className="text-xs text-slate-400 mt-0.5">Paid installments</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Total Collected</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {formatINR(session.totalCollectedRupees || 0)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Deposited into session</div>
        </div>
      </div>

      {/* Proximity Radius Selector & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Radius Filter Pills */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Proximity Radius Filter (Applied Strictly After Line Scope)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: '500m', value: 500 },
                { label: '1 km', value: 1000 },
                { label: '3 km', value: 3000 },
                { label: '5 km', value: 5000 },
                { label: '10 km', value: 10000 },
                { label: 'All Assigned', value: null },
              ].map((item) => {
                const isActive = radiusMeters === item.value;
                return (
                  <button
                    key={item.label}
                    onClick={() => setRadiusMeters(item.value)}
                    disabled={!collectorLocation && item.value !== null}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                        : collectorLocation
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-slate-950 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visit Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium shrink-0">Visit Status:</span>
            <select
              value={visitStatusFilter}
              onChange={(e) => setVisitStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Visits</option>
              <option value="NOT_VISITED">Not Visited</option>
              <option value="COLLECTED">Collected</option>
              <option value="PARTIAL">Partial</option>
              <option value="VISITED">Visited</option>
              <option value="NOT_AVAILABLE">Not Available</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search assigned customers by name, phone, or village..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Quick Visit Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            { value: 'ALL', label: `All Visits (${customers.length})` },
            { value: 'COLLECTED', label: `Collected (${sessionStats.collected})`, color: 'text-emerald-400' },
            { value: 'NOT_VISITED', label: `Pending (${sessionStats.pending})`, color: 'text-slate-300' },
            { value: 'NOT_AVAILABLE', label: `Not Available (${sessionStats.notAvailable})`, color: 'text-rose-400' },
            ...(sessionStats.partial > 0
              ? [{ value: 'PARTIAL', label: `Partial (${sessionStats.partial})`, color: 'text-amber-400' }]
              : []),
            ...(sessionStats.visitedNoCash > 0
              ? [{ value: 'VISITED', label: `Visited (${sessionStats.visitedNoCash})`, color: 'text-blue-400' }]
              : []),
          ].map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setVisitStatusFilter(pill.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                visitStatusFilter === pill.value
                  ? 'bg-slate-800 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={pill.color || ''}>{pill.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Customer Field Cards Grouped by Visit Status */}
      <div className="space-y-6">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Showing <strong className="text-slate-200">{filteredCustomers.length}</strong> customers
            {collectorLocation ? ' sorted by proximity' : ' in manual line sequence'}
          </span>
          {isGPSFiltered && (
            <span className="text-emerald-400 font-medium">GPS Radius Filter Active</span>
          )}
        </div>

        {groupedCustomers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No Customers Found</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              No customers found matching the selected radius or search criteria. Try expanding the radius to &quot;All Assigned&quot;.
            </p>
          </div>
        ) : (
          groupedCustomers.map((group) => {
            const GroupIcon = group.icon || MapPin;
            return (
              <div key={group.status} className="space-y-3">
                {/* Group Section Header */}
                <div
                  className={`p-3.5 rounded-xl border bg-gradient-to-r flex flex-wrap items-center justify-between gap-3 ${group.headerBg}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg border ${group.badgeBg}`}>
                      <GroupIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        {group.title}
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${group.badgeBg}`}>
                          {group.customers.length}
                        </span>
                      </h3>
                    </div>
                  </div>

                  {group.totalCollectedRupees > 0 && (
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Total Group Collection</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        {formatINR(group.totalCollectedRupees)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Grid of Cards for this Status Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.customers.map(renderCustomerCard)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Log Customer Visit with GPS Audit */}
      {selectedCustomerForVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Record Customer Visit
              </h3>
              <button
                onClick={() => setSelectedCustomerForVisit(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-slate-200 text-sm">
                {selectedCustomerForVisit.fullName}
              </div>
              <div className="text-slate-400">
                {selectedCustomerForVisit.villageName} • Phone:{' '}
                {selectedCustomerForVisit.primaryPhone}
              </div>
              {selectedCustomerForVisit.activeLoan && (
                <div className="text-emerald-400 font-semibold pt-1">
                  Due Amount: {formatINR(selectedCustomerForVisit.activeLoan.nextDueAmountRupees)}
                </div>
              )}
            </div>

            {/* Visit Status Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Visit Outcome / Status <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'COLLECTED', label: 'Collected', color: 'emerald' },
                  { value: 'PARTIAL', label: 'Partial Paid', color: 'amber' },
                  { value: 'VISITED', label: 'Visited (No Cash)', color: 'blue' },
                  { value: 'NOT_AVAILABLE', label: 'Not Available', color: 'rose' },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setVisitStatus(s.value)}
                    className={`p-2.5 rounded-lg text-xs font-semibold border transition ${
                      visitStatus === s.value
                        ? 'bg-slate-800 border-emerald-500 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visit Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Visit Notes & Remarks
              </label>
              <textarea
                rows={3}
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                placeholder="e.g. Paid installment in cash, promised remainder on Friday..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* GPS Audit Coordinates Tag */}
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <div className="text-slate-400 font-medium flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                Audit GPS Coordinates Attached:
              </div>
              <div className="font-mono text-slate-300 mt-1">
                {collectorLocation ? (
                  <span>
                    {collectorLocation.lat.toFixed(5)}, {collectorLocation.lng.toFixed(5)} (±
                    {collectorLocation.accuracy}m)
                  </span>
                ) : (
                  <span className="text-slate-500">None captured (Manual Mode)</span>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCustomerForVisit(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVisit}
                disabled={isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Visit Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Complete Session */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Complete Collection Session
              </h3>
              <button
                onClick={() => setIsCompleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-slate-300 space-y-2">
              <p>
                Are you ready to complete collection session{' '}
                <strong className="font-mono text-slate-100">{session.sessionNumber}</strong>?
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
                <div>Visits Logged: {sessionStats.visited} / {sessionStats.total}</div>
                <div>Collections Made: {sessionStats.collected}</div>
                <div className="text-emerald-400 font-bold">
                  Total Collected: {formatINR(session.totalCollectedRupees || 0)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Final Summary Remarks
              </label>
              <textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="e.g. Session finished, all cash verified and ready for cashier deposit."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteSession}
                disabled={isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {isPending ? 'Closing...' : 'Confirm Completion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inline Repayment Collection */}
      {collectingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Collect Repayment
              </h3>
              <button
                type="button"
                onClick={() => setCollectingCustomer(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Loan Overview */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs space-y-1.5">
              <div className="font-bold text-slate-100 text-sm">
                {collectingCustomer.fullName}
              </div>
              <div className="text-slate-400">
                {collectingCustomer.villageName} • Phone: {collectingCustomer.primaryPhone || '—'}
              </div>
              {collectingCustomer.activeLoan && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block">Loan & Scheme</span>
                    <span className="text-slate-300 font-medium">
                      {collectingCustomer.activeLoan.schemeName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Due Installment</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {formatINR(collectingCustomer.activeLoan.nextDueAmountRupees || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Repayment Form */}
            <form onSubmit={handleConfirmCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Collection Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-lg font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'CASH', label: '💵 Cash in Hand' },
                    { value: 'UPI', label: '📱 Direct UPI' },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setCollectMode(m.value)}
                      className={`p-2.5 rounded-lg text-xs font-semibold border transition text-center ${
                        collectMode === m.value
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Receipt Reference (Optional)
                </label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="e.g. Paid weekly installment on field visit"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* GPS Audit indicator */}
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                {collectorLocation ? (
                  <span>GPS location will be automatically tagged to this collection</span>
                ) : (
                  <span>Manual entry mode (No GPS lock acquired)</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectingCustomer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isPending ? 'Recording...' : `Confirm & Collect ${collectAmount ? formatINR(Number(collectAmount)) : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
