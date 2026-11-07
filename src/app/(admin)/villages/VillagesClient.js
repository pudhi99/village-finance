'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Route,
  Plus,
  Building,
  Calendar,
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  X,
  Edit2,
} from 'lucide-react';
import {
  createVillage,
  createArea,
  createLine,
  updateVillage,
  updateArea,
  updateLine,
} from '@/features/customers/server-actions';

export default function VillagesClient({ initialVillages, initialLines }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('villages'); // 'villages' | 'lines'
  const [search, setSearch] = useState('');

  // Create Modals
  const [showVillageModal, setShowVillageModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);

  // Edit Modals
  const [showEditVillageModal, setShowEditVillageModal] = useState(false);
  const [showEditAreaModal, setShowEditAreaModal] = useState(false);
  const [showEditLineModal, setShowEditLineModal] = useState(false);

  // Messages
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Village Form (Create & Edit)
  const [villageForm, setVillageForm] = useState({
    name: '',
    code: '',
    district: 'East Godavari',
    state: 'Andhra Pradesh',
  });
  const [editingVillageId, setEditingVillageId] = useState(null);

  // Area Form (Create & Edit)
  const [areaForm, setAreaForm] = useState({
    villageId: '',
    name: '',
    pincode: '',
    landmark: '',
  });
  const [editingAreaId, setEditingAreaId] = useState(null);

  // Line Form (Create & Edit)
  const [lineForm, setLineForm] = useState({
    name: '',
    code: '',
    weekday: 'SUNDAY',
    session: 'MORNING',
    description: '',
  });
  const [editingLineId, setEditingLineId] = useState(null);

  // Filtered lists
  const filteredVillages = initialVillages.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.code.toLowerCase().includes(search.toLowerCase()) ||
      v.areas.some((a) => a.name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredLines = initialLines.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreateVillage(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await createVillage(villageForm);
      setSuccessMsg(`Village "${villageForm.name}" created successfully.`);
      setShowVillageModal(false);
      setVillageForm({ name: '', code: '', district: 'East Godavari', state: 'Andhra Pradesh' });
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateVillage(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await updateVillage({ id: editingVillageId, ...villageForm });
      setSuccessMsg(`Village "${villageForm.name}" updated successfully.`);
      setShowEditVillageModal(false);
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateArea(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await createArea(areaForm);
      setSuccessMsg(`Area "${areaForm.name}" added successfully.`);
      setShowAreaModal(false);
      setAreaForm({ villageId: '', name: '', pincode: '', landmark: '' });
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateArea(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await updateArea({
        id: editingAreaId,
        name: areaForm.name,
        pincode: areaForm.pincode,
        landmark: areaForm.landmark,
      });
      setSuccessMsg(`Area "${areaForm.name}" updated successfully.`);
      setShowEditAreaModal(false);
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateLine(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await createLine(lineForm);
      setSuccessMsg(`Line "${lineForm.name}" created successfully.`);
      setShowLineModal(false);
      setLineForm({ name: '', code: '', weekday: 'SUNDAY', session: 'MORNING', description: '' });
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateLine(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await updateLine({ id: editingLineId, ...lineForm });
      setSuccessMsg(`Line "${lineForm.name}" updated successfully.`);
      setShowEditLineModal(false);
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <MapPin className="w-7 h-7 text-emerald-400" />
            Villages, Areas & Collection Lines
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Organize operational geography, areas, and collector assignment routes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'villages' ? (
            <>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setVillageForm({
                    name: '',
                    code: '',
                    district: 'East Godavari',
                    state: 'Andhra Pradesh',
                  });
                  setShowVillageModal(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition"
              >
                <Plus className="w-4 h-4" /> Add Village
              </button>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setAreaForm({
                    villageId: initialVillages[0]?.id || '',
                    name: '',
                    pincode: '',
                    landmark: '',
                  });
                  setShowAreaModal(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
              >
                <Plus className="w-4 h-4" /> Add Area
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setErrorMsg(null);
                setLineForm({
                  name: '',
                  code: '',
                  weekday: 'SUNDAY',
                  session: 'MORNING',
                  description: '',
                });
                setShowLineModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Add Collection Line
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-300 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {successMsg}
          </span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controls & Tab Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('villages')}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition ${
              activeTab === 'villages'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            Villages & Areas ({initialVillages.length})
          </button>
          <button
            onClick={() => setActiveTab('lines')}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition ${
              activeTab === 'lines'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Route className="w-4 h-4" />
            Collection Lines ({initialLines.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder={activeTab === 'villages' ? 'Search village or area...' : 'Search collection lines...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tab 1: Villages & Areas */}
      {activeTab === 'villages' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVillages.map((village) => (
            <div
              key={village.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                    {village.name}
                    <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 font-mono rounded">
                      {village.code}
                    </span>
                    <button
                      onClick={() => {
                        setErrorMsg(null);
                        setEditingVillageId(village.id);
                        setVillageForm({
                          name: village.name,
                          code: village.code,
                          district: village.district || '',
                          state: village.state || '',
                        });
                        setShowEditVillageModal(true);
                      }}
                      title="Edit Village"
                      className="text-slate-400 hover:text-emerald-400 p-1 rounded hover:bg-slate-800 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {village.district || 'East Godavari'}, {village.state || 'AP'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-emerald-950/60 text-emerald-400 border border-emerald-900 rounded-full">
                  <Users className="w-3.5 h-3.5" />
                  <span>{village.customerCount} cust</span>
                </div>
              </div>

              {/* Areas list */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
                  <span>Areas / Hamlets ({village.areas.length})</span>
                  <button
                    onClick={() => {
                      setAreaForm({
                        villageId: village.id,
                        name: '',
                        pincode: '',
                        landmark: '',
                      });
                      setShowAreaModal(true);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Area
                  </button>
                </div>

                {village.areas.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No areas configured yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {village.areas.map((area) => (
                      <div
                        key={area.id}
                        className="flex items-center justify-between text-xs p-2 bg-slate-950/60 rounded border border-slate-800/60 group"
                      >
                        <div>
                          <span className="text-slate-200 font-medium">{area.name}</span>
                          {area.landmark && (
                            <span className="text-slate-500 ml-1.5">({area.landmark})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          {area.pincode && <span>{area.pincode}</span>}
                          <button
                            onClick={() => {
                              setErrorMsg(null);
                              setEditingAreaId(area.id);
                              setAreaForm({
                                villageId: village.id,
                                name: area.name,
                                pincode: area.pincode || '',
                                landmark: area.landmark || '',
                              });
                              setShowEditAreaModal(true);
                            }}
                            title="Edit Area"
                            className="text-slate-500 hover:text-emerald-400 p-0.5 rounded transition"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredVillages.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
              No villages found matching search query.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Collection Lines */}
      {activeTab === 'lines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLines.map((line) => (
            <div
              key={line.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                    {line.name}
                    <span className="px-2 py-0.5 text-xs bg-emerald-950 text-emerald-400 font-mono rounded border border-emerald-900">
                      {line.code}
                    </span>
                    <button
                      onClick={() => {
                        setErrorMsg(null);
                        setEditingLineId(line.id);
                        setLineForm({
                          name: line.name,
                          code: line.code,
                          weekday: line.weekday,
                          session: line.session,
                          description: line.description || '',
                        });
                        setShowEditLineModal(true);
                      }}
                      title="Edit Line"
                      className="text-slate-400 hover:text-emerald-400 p-1 rounded hover:bg-slate-800 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {line.weekday} · {line.session}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded-full">
                  <Users className="w-3.5 h-3.5" />
                  <span>{line.activeCustomerCount} active</span>
                </div>
              </div>

              {line.description && (
                <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
                  {line.description}
                </p>
              )}
            </div>
          ))}

          {filteredLines.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
              No collection lines found.
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Village */}
      {showVillageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-400" /> Add Village
              </h2>
              <button
                onClick={() => setShowVillageModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVillage} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Village Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Peddapuram"
                  value={villageForm.name}
                  onChange={(e) => setVillageForm({ ...villageForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Unique Code * (Max 15 chars)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PED"
                  value={villageForm.code}
                  onChange={(e) =>
                    setVillageForm({ ...villageForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={villageForm.district}
                    onChange={(e) =>
                      setVillageForm({ ...villageForm, district: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={villageForm.state}
                    onChange={(e) => setVillageForm({ ...villageForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVillageModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Village'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Village */}
      {showEditVillageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" /> Edit Village
              </h2>
              <button
                onClick={() => setShowEditVillageModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateVillage} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Village Name *
                </label>
                <input
                  type="text"
                  required
                  value={villageForm.name}
                  onChange={(e) => setVillageForm({ ...villageForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Unique Code *
                </label>
                <input
                  type="text"
                  required
                  value={villageForm.code}
                  onChange={(e) =>
                    setVillageForm({ ...villageForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={villageForm.district}
                    onChange={(e) =>
                      setVillageForm({ ...villageForm, district: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={villageForm.state}
                    onChange={(e) => setVillageForm({ ...villageForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditVillageModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Area */}
      {showAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" /> Add Area / Hamlet
              </h2>
              <button
                onClick={() => setShowAreaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateArea} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Village *
                </label>
                <select
                  required
                  value={areaForm.villageId}
                  onChange={(e) => setAreaForm({ ...areaForm, villageId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select Village...</option>
                  {initialVillages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Area / Street / Colony Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Bazaar, Colony Road"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Pincode (6 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="533437"
                    value={areaForm.pincode}
                    onChange={(e) => setAreaForm({ ...areaForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Key Landmark
                  </label>
                  <input
                    type="text"
                    placeholder="Near Temple / School"
                    value={areaForm.landmark}
                    onChange={(e) => setAreaForm({ ...areaForm, landmark: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAreaModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Area */}
      {showEditAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" /> Edit Area
              </h2>
              <button
                onClick={() => setShowEditAreaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateArea} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Area Name *
                </label>
                <input
                  type="text"
                  required
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Pincode (6 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={areaForm.pincode}
                    onChange={(e) => setAreaForm({ ...areaForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Key Landmark
                  </label>
                  <input
                    type="text"
                    value={areaForm.landmark}
                    onChange={(e) => setAreaForm({ ...areaForm, landmark: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditAreaModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Line */}
      {showLineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Route className="w-5 h-5 text-emerald-400" /> Add Collection Line
              </h2>
              <button
                onClick={() => setShowLineModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLine} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Line Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunday Morning Line"
                  value={lineForm.name}
                  onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Unique Code * (Max 15 chars)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUN-AM"
                  value={lineForm.code}
                  onChange={(e) =>
                    setLineForm({ ...lineForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Weekday *
                  </label>
                  <select
                    value={lineForm.weekday}
                    onChange={(e) => setLineForm({ ...lineForm, weekday: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {[
                      'SUNDAY',
                      'MONDAY',
                      'TUESDAY',
                      'WEDNESDAY',
                      'THURSDAY',
                      'FRIDAY',
                      'SATURDAY',
                    ].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Session *
                  </label>
                  <select
                    value={lineForm.session}
                    onChange={(e) => setLineForm({ ...lineForm, session: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="MORNING">MORNING (AM)</option>
                    <option value="AFTERNOON">AFTERNOON (PM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Coverage Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Covers Peddapuram main bazaar and market zone..."
                  value={lineForm.description}
                  onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLineModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Line'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Line */}
      {showEditLineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" /> Edit Collection Line
              </h2>
              <button
                onClick={() => setShowEditLineModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLine} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Line Name *
                </label>
                <input
                  type="text"
                  required
                  value={lineForm.name}
                  onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Unique Code *
                </label>
                <input
                  type="text"
                  required
                  value={lineForm.code}
                  onChange={(e) =>
                    setLineForm({ ...lineForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Weekday *
                  </label>
                  <select
                    value={lineForm.weekday}
                    onChange={(e) => setLineForm({ ...lineForm, weekday: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {[
                      'SUNDAY',
                      'MONDAY',
                      'TUESDAY',
                      'WEDNESDAY',
                      'THURSDAY',
                      'FRIDAY',
                      'SATURDAY',
                    ].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Session *
                  </label>
                  <select
                    value={lineForm.session}
                    onChange={(e) => setLineForm({ ...lineForm, session: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="MORNING">MORNING (AM)</option>
                    <option value="AFTERNOON">AFTERNOON (PM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Coverage Notes
                </label>
                <textarea
                  rows={2}
                  value={lineForm.description}
                  onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditLineModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
