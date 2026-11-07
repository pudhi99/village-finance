'use client';

import { useState } from 'react';
import {
  updateUserRoles,
  updateUserStatus,
  revokeUserDevice,
} from '@/features/auth/server-actions';
import {
  Shield,
  Smartphone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
} from 'lucide-react';

const ALL_ROLES = ['ADMIN', 'PARTNER', 'COLLECTION_TEAM', 'ACCOUNTANT'];

export default function UsersClient({ initialUsers, currentUserId }) {
  const [users, setUsers] = useState(initialUsers);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [deviceModalUser, setDeviceModalUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openRoleModal(user) {
    setActionError(null);
    setActionSuccess(null);
    setRoleModalUser(user);
    setSelectedRoles([...user.roles]);
  }

  function toggleRoleSelection(role) {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  }

  async function handleSaveRoles() {
    if (!roleModalUser) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      await updateUserRoles({
        targetUserId: roleModalUser.id,
        roleNames: selectedRoles,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === roleModalUser.id ? { ...u, roles: selectedRoles } : u
        )
      );

      setActionSuccess(`Roles updated successfully for ${roleModalUser.email}`);
      setRoleModalUser(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(user) {
    const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const confirmMsg = `Are you sure you want to ${
      newStatus === 'DISABLED' ? 'DISABLE' : 'ENABLE'
    } access for ${user.email}?`;
    if (!window.confirm(confirmMsg)) return;

    setActionError(null);
    setActionSuccess(null);

    try {
      await updateUserStatus({
        targetUserId: user.id,
        status: newStatus,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      );

      setActionSuccess(`Status updated to ${newStatus} for ${user.email}`);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleRevokeDevice(deviceId, userEmail) {
    const reason = window.prompt(
      'Enter reason for device revocation (e.g., lost phone, replacement):',
      'Administrative revocation'
    );
    if (!reason) return;

    try {
      await revokeUserDevice({ deviceId, reason });
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          devices: u.devices.map((d) =>
            d.id === deviceId ? { ...d, status: 'REVOKED' } : d
          ),
        }))
      );
      if (deviceModalUser) {
        setDeviceModalUser((prev) => ({
          ...prev,
          devices: prev.devices.map((d) =>
            d.id === deviceId ? { ...d, status: 'REVOKED' } : d
          ),
        }));
      }
      setActionSuccess(`Device successfully revoked.`);
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Title & description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            User, Role & Device Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Control application roles, collector device registrations, and access states.
          </p>
        </div>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Roles</th>
                <th className="px-5 py-3.5">Devices</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* User profile */}
                    <td className="px-5 py-4">
                      <div className="font-medium text-white flex items-center gap-2">
                        {user.fullName}
                        {isSelf && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{user.email}</div>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-4">
                      {user.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400 border border-red-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Disabled
                        </span>
                      )}
                    </td>

                    {/* Roles badges */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className="px-2 py-0.5 rounded text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800"
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">No roles</span>
                        )}
                      </div>
                    </td>

                    {/* Devices */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setDeviceModalUser(user)}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 border border-slate-700/80 transition-colors"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          {user.devices.length} registered (
                          {user.devices.filter((d) => d.status === 'ACTIVE').length} active)
                        </span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => openRoleModal(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot edit own roles' : 'Edit roles'}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Roles</span>
                      </button>

                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot disable self' : 'Toggle account access'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          user.status === 'ACTIVE'
                            ? 'text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-900/60'
                            : 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900/60'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? (
                          <>
                            <UserX className="w-3 h-3" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3 h-3" />
                            <span>Enable</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Assignment Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold text-white">Edit User Roles</h2>
              <p className="text-slate-400 text-xs mt-1">
                Assigning roles to <span className="text-slate-200">{roleModalUser.email}</span>
              </p>
            </div>

            <div className="space-y-2">
              {ALL_ROLES.map((role) => {
                const isSelected = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRoleSelection(role)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-600 text-white'
                        : 'bg-slate-800/40 border-slate-700/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span>{role}</span>
                    </div>
                    {isSelected ? (
                      <CheckCircle className="w-4 h-4 text-blue-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoles}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save Roles'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Management Modal */}
      {deviceModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Registered Devices</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Collector devices registered for {deviceModalUser.fullName}
                </p>
              </div>
              <button
                onClick={() => setDeviceModalUser(null)}
                className="text-slate-500 hover:text-white text-sm"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {deviceModalUser.devices.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">
                  No collector devices have logged in yet.
                </p>
              ) : (
                deviceModalUser.devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-blue-400" />
                        <span>{device.deviceName}</span>
                        {device.status === 'ACTIVE' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Last seen: {new Date(device.lastSeenAt).toLocaleString()}
                      </div>
                    </div>

                    {device.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleRevokeDevice(device.id, deviceModalUser.email)}
                        className="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 rounded-lg transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
