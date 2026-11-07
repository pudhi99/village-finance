'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/money';
import {
  createCollectionSession,
  startCollectionSession,
  completeCollectionSession,
  cancelCollectionSession,
} from '@/features/collections/server-actions';
import {
  Compass,
  Play,
  CheckCircle,
  XCircle,
  Plus,
  Calendar,
  Users,
  Search,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function CollectionsHubClient({
  initialSessions = [],
  totalSessions = 0,
  lines = [],
  collectors = [],
  canManageSessions = false,
  isAdmin = false,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [lineFilter, setLineFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState(null); // 'START' | 'COMPLETE' | 'CANCEL'
  const [targetSession, setTargetSession] = useState(null);
  const [actionNotes, setActionNotes] = useState('');

  // Create Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [formLineId, setFormLineId] = useState(lines[0]?.id || '');
  const [formDate, setFormDate] = useState(todayStr);
  const [formCollectors, setFormCollectors] = useState([]);
  const [formNotes, setFormNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return initialSessions.filter((s) => {
      if (lineFilter !== 'ALL' && s.lineId !== lineFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesNum = s.sessionNumber?.toLowerCase().includes(query);
        const matchesLine = s.line?.name?.toLowerCase().includes(query) || s.line?.code?.toLowerCase().includes(query);
        const matchesTeam = s.teamMembers?.some((m) =>
          m.user?.fullName?.toLowerCase().includes(query)
        );
        if (!matchesNum && !matchesLine && !matchesTeam) return false;
      }
      return true;
    });
  }, [initialSessions, lineFilter, statusFilter, search]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const inProgress = initialSessions.filter((s) => s.status === 'IN_PROGRESS').length;
    const completed = initialSessions.filter((s) => s.status === 'COMPLETED').length;
    const planned = initialSessions.filter((s) => s.status === 'PLANNED').length;
    const totalCollectedRupees = initialSessions.reduce(
      (sum, s) => sum + (s.totalCollectedRupees || 0),
      0
    );
    return { inProgress, completed, planned, totalCollectedRupees };
  }, [initialSessions]);

  // Handlers
  async function handleCreateSession(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formLineId) {
      setErrorMsg('Please select a collection line');
      return;
    }
    if (!formDate) {
      setErrorMsg('Please select a session date');
      return;
    }

    startTransition(async () => {
      try {
        const res = await createCollectionSession({
          lineId: formLineId,
          sessionDate: formDate,
          collectorIds: formCollectors,
          notes: formNotes,
        });

        if (res.success) {
          setSuccessMsg(`Session ${res.session.sessionNumber} created successfully!`);
          setIsCreateModalOpen(false);
          setFormNotes('');
          setFormCollectors([]);
          router.refresh();
        } else {
          setErrorMsg(res.error || 'Failed to create collection session');
        }
      } catch (err) {
        setErrorMsg(err.message || 'An unexpected error occurred');
      }
    });
  }

  function openActionModal(session, type) {
    setTargetSession(session);
    setActionType(type);
    setActionNotes('');
    setErrorMsg('');
    setIsActionModalOpen(true);
  }

  async function handleConfirmAction() {
    if (!targetSession || !actionType) return;
    setErrorMsg('');
    setSuccessMsg('');

    startTransition(async () => {
      try {
        let res;
        if (actionType === 'START') {
          res = await startCollectionSession({ sessionId: targetSession.id });
        } else if (actionType === 'COMPLETE') {
          res = await completeCollectionSession({
            sessionId: targetSession.id,
            notes: actionNotes,
          });
        } else if (actionType === 'CANCEL') {
          res = await cancelCollectionSession({
            sessionId: targetSession.id,
            reason: actionNotes,
          });
        }

        if (res?.success) {
          setSuccessMsg(
            `Session ${targetSession.sessionNumber} has been ${actionType === 'START' ? 'started' : actionType === 'COMPLETE' ? 'completed' : 'cancelled'}.`
          );
          setIsActionModalOpen(false);
          router.refresh();
        } else {
          setErrorMsg(res?.error || 'Action failed');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Action encountered an error');
      }
    });
  }

  function toggleCollectorSelection(id) {
    setFormCollectors((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Compass className="w-7 h-7 text-emerald-400" />
            Field Collection Sessions & GPS
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dispatch daily lines, manage active collection sessions, track GPS visits, and collect repayments.
          </p>
        </div>

        {canManageSessions && (
          <button
            onClick={() => {
              setErrorMsg('');
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-sm transition shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            New Collection Session
          </button>
        )}
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span className="text-sm">{successMsg}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>In-Progress Sessions</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2">{metrics.inProgress}</div>
          <div className="text-xs text-emerald-400 mt-1">Live in the field</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Planned / Pending</div>
          <div className="text-2xl font-bold text-slate-100 mt-2">{metrics.planned}</div>
          <div className="text-xs text-blue-400 mt-1">Ready for dispatch</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Completed Sessions</div>
          <div className="text-2xl font-bold text-slate-100 mt-2">{metrics.completed}</div>
          <div className="text-xs text-slate-400 mt-1">Fully closed & audited</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Total Session Collections
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {formatINR(metrics.totalCollectedRupees)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Sum across loaded sessions</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by session #, line, collector..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Line Filter */}
          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Lines</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PLANNED">Planned</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Compass className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No Collection Sessions Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {search || lineFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No sessions match your filter criteria. Try adjusting the filters above.'
              : 'Create a new collection session to dispatch collectors to a Line for repayment visits.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => {
            const isLive = session.status === 'IN_PROGRESS';
            const isPlanned = session.status === 'PLANNED';
            const isCompleted = session.status === 'COMPLETED';

            return (
              <div
                key={session.id}
                className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition ${
                  isLive
                    ? 'border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top line badge & status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
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

                  {/* Line info */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      {session.line?.name}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Code: <span className="text-slate-300 font-mono">{session.line?.code}</span> • Day: {session.line?.weekday}
                    </div>
                  </div>

                  {/* Date & Team */}
                  <div className="space-y-1.5 py-3 border-y border-slate-800/80 text-xs">
                    <div className="flex items-center text-slate-300 gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{session.sessionDateFormatted}</span>
                      {session.sessionTimeOfDay && (
                        <span className="text-slate-400">({session.sessionTimeOfDay})</span>
                      )}
                    </div>
                    <div className="flex items-center text-slate-300 gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">
                        Team:{' '}
                        {session.teamMembers?.length > 0
                          ? session.teamMembers.map((m) => m.user?.fullName).join(', ')
                          : 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Progress & Collected Metrics */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-1">
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/50">
                      <div className="text-[11px] text-slate-400 font-medium">Visits Logged</div>
                      <div className="text-sm font-bold text-slate-200 mt-0.5">
                        {session.visitedCount || 0} / {session.assignedCustomersCount || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/50">
                      <div className="text-[11px] text-slate-400 font-medium">Collected</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        {formatINR(session.totalCollectedRupees || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  {/* Enter Field Screen */}
                  <Link
                    href={`/collections/${session.id}`}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition ${
                      isLive
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    {isLive ? 'Field GPS View' : 'Open Session'}
                    <ArrowRight className="w-3 h-3" />
                  </Link>

                  {/* Lifecycle state button controls */}
                  <div className="flex items-center gap-1.5">
                    {isPlanned && canManageSessions && (
                      <button
                        onClick={() => openActionModal(session, 'START')}
                        className="p-2 text-xs font-medium text-blue-400 hover:bg-blue-950/50 border border-blue-900/60 rounded-lg transition"
                        title="Start Collection Session"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {isLive && canManageSessions && (
                      <button
                        onClick={() => openActionModal(session, 'COMPLETE')}
                        className="px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/50 border border-emerald-800/60 rounded-lg transition flex items-center gap-1"
                        title="Complete Session"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Finish
                      </button>
                    )}
                    {(isPlanned || (isLive && session.totalCollectedRupees === 0)) && canManageSessions && (
                      <button
                        onClick={() => openActionModal(session, 'CANCEL')}
                        className="p-2 text-xs font-medium text-rose-400 hover:bg-rose-950/50 border border-rose-900/60 rounded-lg transition"
                        title="Cancel Session"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Collection Session */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                Schedule Collection Session
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Collection Line <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formLineId}
                  onChange={(e) => setFormLineId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code}) — {l.weekday}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sessions enforce uniqueness per Line and Session Date.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Session Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assign Field Collectors
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-950 border border-slate-800 rounded-lg p-2">
                  {collectors.length === 0 ? (
                    <div className="text-xs text-slate-500 p-2 text-center">No active collectors found</div>
                  ) : (
                    collectors.map((c) => {
                      const isSelected = formCollectors.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleCollectorSelection(c.id)}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer text-xs transition ${
                            isSelected
                              ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-800/80'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{c.fullName}</span>
                          <span className="text-slate-400 text-[11px]">{c.email}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Session Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Regular weekly collection route, focus on overdue loans"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isPending ? 'Creating...' : 'Schedule Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Action Confirmation (Start / Complete / Cancel) */}
      {isActionModalOpen && targetSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">
                {actionType === 'START' && 'Start Collection Session'}
                {actionType === 'COMPLETE' && 'Complete Collection Session'}
                {actionType === 'CANCEL' && 'Cancel Collection Session'}
              </h3>
              <button
                onClick={() => setIsActionModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-slate-300 space-y-2">
              <p>
                Session: <span className="font-bold font-mono">{targetSession.sessionNumber}</span>
              </p>
              <p>
                Line: <span className="font-semibold">{targetSession.line?.name}</span>
              </p>
              {actionType === 'START' && (
                <p className="text-slate-400">
                  Transition this session to <strong className="text-emerald-400">IN PROGRESS</strong> so field collectors can begin logging visits and collecting payments.
                </p>
              )}
              {actionType === 'COMPLETE' && (
                <p className="text-slate-400">
                  Mark this session as <strong className="text-slate-200">COMPLETED</strong>. This closes the session timestamp and locks it for audit review.
                </p>
              )}
              {actionType === 'CANCEL' && (
                <p className="text-rose-400">
                  Are you sure you want to cancel this session?
                </p>
              )}
            </div>

            {(actionType === 'COMPLETE' || actionType === 'CANCEL') && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {actionType === 'COMPLETE' ? 'Closing Remarks / Summary' : 'Cancellation Reason'}
                </label>
                <textarea
                  rows={2}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={
                    actionType === 'COMPLETE'
                      ? 'e.g. Route finished, cash handed to branch'
                      : 'e.g. Heavy rain, route rescheduled'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setIsActionModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isPending}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                  actionType === 'CANCEL'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
