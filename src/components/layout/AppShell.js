'use client';

/**
 * Main Application Shell — Village Finance
 * Responsive administrative interface with desktop sidebar, mobile bottom navigation bar,
 * and slide-up mobile action sheet for thumb-friendly field operations.
 */
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import {
  Users,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  X,
  CreditCard,
  MapPin,
  Banknote,
  Compass,
  PieChart,
  FileText,
  Grid,
  ChevronRight,
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import SyncStatusPill from '@/components/offline/SyncStatusPill';

export default function AppShell({ user, profile, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  }

  // All navigation items filtered by server permissions
  const navItems = useMemo(
    () => [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        visible: true,
        category: 'core',
      },
      {
        label: 'Field Collections',
        href: '/collections',
        icon: Compass,
        visible:
          profile.permissions.includes('payments:collect') ||
          profile.permissions.includes('payments:read') ||
          profile.isAdmin,
        category: 'field',
      },
      {
        label: 'Payments & Receipts',
        href: '/payments',
        icon: Banknote,
        visible:
          profile.permissions.includes('payments:read') ||
          profile.permissions.includes('payments:collect') ||
          profile.isAdmin,
        category: 'field',
      },
      {
        label: 'Customers',
        href: '/customers',
        icon: Users,
        visible: profile.permissions.includes('customers:read') || profile.isAdmin,
        category: 'field',
      },
      {
        label: 'Loans & Schemes',
        href: '/loans',
        icon: CreditCard,
        visible: profile.permissions.includes('loans:read') || profile.isAdmin,
        category: 'operations',
      },
      {
        label: 'Cash Bags & Vault',
        href: '/cash',
        icon: Banknote,
        visible: profile.permissions.includes('cash:bag_view') || profile.isAdmin,
        category: 'operations',
      },
      {
        label: 'Villages & Lines',
        href: '/villages',
        icon: MapPin,
        visible: profile.permissions.includes('customers:read') || profile.isAdmin,
        category: 'operations',
      },
      {
        label: 'Reports & P&L',
        href: '/reports',
        icon: FileText,
        visible: profile.permissions.includes('reports:view') || profile.isAdmin,
        category: 'finance',
      },
      {
        label: 'Partner Capital',
        href: '/partners',
        icon: PieChart,
        visible: profile.permissions.includes('partners:read') || profile.isAdmin,
        category: 'finance',
      },
      {
        label: 'User Management',
        href: '/admin/users',
        icon: Users,
        visible: profile.permissions.includes('users:read') || profile.isAdmin,
        category: 'admin',
      },
      {
        label: 'Audit Log',
        href: '/admin/audit',
        icon: ShieldCheck,
        visible: profile.permissions.includes('audit:read') || profile.isAdmin,
        category: 'admin',
      },
    ],
    [profile]
  );

  // 4 Primary Mobile Bottom Tabs
  const mobilePrimaryTabs = [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Collect', href: '/collections', icon: Compass },
    { label: 'Pay', href: '/payments', icon: Banknote },
    { label: 'Customers', href: '/customers', icon: Users },
  ];

  // Secondary items shown in the "More" drawer
  const drawerItems = navItems.filter(
    (item) => item.visible && !mobilePrimaryTabs.some((t) => t.href === item.href)
  );

  const isMoreTabActive = drawerItems.some((item) => pathname.startsWith(item.href));

  return (
    <div className="min-h-screen md:h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 md:overflow-hidden">
      {/* ============================================================== */}
      {/* 1. DESKTOP SIDEBAR — Fixed height and pinned to left */}
      {/* ============================================================== */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 h-full">
        {/* Brand header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-900/40">
            VF
          </div>
          <div>
            <div className="font-semibold text-white text-sm tracking-tight leading-none">
              Village Finance
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Micro-Lending System</div>
          </div>
        </div>

        {/* User profile card */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-medium text-xs text-blue-400">
              {profile.fullName?.slice(0, 2).toUpperCase() || 'VF'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{profile.fullName}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.roles.map((r) => (
                  <span
                    key={r}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-950 text-blue-300 border border-blue-800"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Nav list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
        </nav>

        {/* Sign out footer */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MAIN WORKSPACE AREA */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 md:h-full md:overflow-hidden">
        {/* Mobile Top Header (Compact & Finger-Friendly) */}
        <header className="md:hidden h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/90 flex items-center justify-between px-3.5 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center font-bold text-white text-xs shadow-sm">
              VF
            </div>
            <span className="font-semibold text-white text-sm tracking-tight">Village Finance</span>
          </div>

          <div className="flex items-center gap-2">
            <SyncStatusPill />
            <NotificationBell profile={profile} />
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-[11px] text-blue-400 active:scale-95 transition-transform"
              title="Open profile menu"
            >
              {profile.fullName?.slice(0, 2).toUpperCase() || 'VF'}
            </button>
          </div>
        </header>

        {/* Desktop Top Bar */}
        <header className="hidden md:flex h-14 bg-slate-900/60 border-b border-slate-800 items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">Tenant:</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 font-mono">
              Primary Branch
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SyncStatusPill />
            <NotificationBell profile={profile} />
          </div>
        </header>

        {/* Page Content with safe padding for mobile bottom bar */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 pb-24 md:pb-8 overflow-y-auto">
          <div className="max-w-7xl w-full mx-auto">{children}</div>
        </main>
      </div>

      {/* ============================================================== */}
      {/* 3. MOBILE BOTTOM NAVIGATION BAR (Thumb Zone) */}
      {/* ============================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-2">
          {mobilePrimaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-col items-center justify-center py-1 transition-all duration-150 active:scale-90 ${
                  isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Active glow indicator pill */}
                {isActive && (
                  <span className="absolute top-1.5 w-8 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 mt-1' : ''
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 font-medium tracking-tight ${
                    isActive ? 'font-semibold text-blue-400' : ''
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* 5th Tab: "More" Menu Button */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className={`relative flex flex-col items-center justify-center py-1 transition-all duration-150 active:scale-90 ${
              isMoreTabActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isMoreTabActive && (
              <span className="absolute top-1.5 w-8 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            )}
            <Grid
              className={`w-5 h-5 transition-transform duration-150 ${
                isMoreTabActive ? 'scale-110 mt-1' : ''
              }`}
            />
            <span
              className={`text-[10px] mt-1 font-medium tracking-tight ${
                isMoreTabActive ? 'font-semibold text-blue-400' : ''
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ============================================================== */}
      {/* 4. SLIDE-UP MOBILE DRAWER (For Secondary Modules & Account) */}
      {/* ============================================================== */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop click to dismiss */}
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close menu backdrop"
          />

          {/* Drawer Sheet Container */}
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250">
            {/* Grab handle bar */}
            <div className="py-2.5 flex justify-center">
              <div className="w-12 h-1.5 bg-slate-700/80 rounded-full" />
            </div>

            {/* Profile Bar */}
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center font-bold text-sm text-blue-400">
                  {profile.fullName?.slice(0, 2).toUpperCase() || 'VF'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white leading-tight">
                    {profile.fullName}
                  </div>
                  <div className="text-xs text-slate-400">{profile.email}</div>
                  <div className="flex gap-1.5 mt-1">
                    {profile.roles.map((r) => (
                      <span
                        key={r}
                        className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-950/80 text-blue-300 border border-blue-800/80"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Grid of Secondary Modules */}
            <div className="p-4 overflow-y-auto space-y-4 max-h-[55vh]">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  Operations & Finance
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {drawerItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-600/30 font-semibold'
                            : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-700/50 text-blue-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions: Sign Out */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-rose-300 bg-rose-950/40 border border-rose-900/60 hover:bg-rose-950/70 active:scale-98 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Village Finance</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
