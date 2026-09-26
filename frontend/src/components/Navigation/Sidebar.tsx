import React from 'react';
import {
  CloudLightning,
  Activity,
  ShieldAlert,
  Wrench,
  Award,
  Compass,
  Radio,
  LogOut,
  User,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import { StaffUser } from '../../types';

interface SidebarProps {
  activeTab: 'monitor' | 'alerts' | 'faults' | 'benchmark';
  onSelectTab: (tab: 'monitor' | 'alerts' | 'faults' | 'benchmark') => void;
  activeAlertCount: number;
  currentUser?: StaffUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onGoToLanding?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeAlertCount,
  currentUser,
  onOpenAuth,
  onLogout,
  onGoToLanding,
}) => {
  const navItems = [
    {
      id: 'monitor' as const,
      label: 'Live Monitor',
      icon: Activity,
      badge: null,
    },
    {
      id: 'alerts' as const,
      label: 'Alerts & Triage',
      icon: ShieldAlert,
      badge: activeAlertCount > 0 ? activeAlertCount : null,
    },
    {
      id: 'faults' as const,
      label: 'Fault Lab',
      icon: Wrench,
      badge: null,
    },
    {
      id: 'benchmark' as const,
      label: 'Benchmarks',
      icon: Award,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-[#161822] border-r border-[#262a38] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30">
      <div className="p-5 space-y-6">
        {/* Brand & Logo */}
        <div
          onClick={onGoToLanding}
          className="flex items-center gap-3 cursor-pointer group"
          title="Return to SkyGuard Overview Portal"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20 transition-all">
            <CloudLightning className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">
                SkyGuard AI
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#1c1f2b] border border-[#282c3c] text-amber-400 font-semibold">
                AWS
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              MoES / IMD Telemetry
            </span>
          </div>
        </div>

        {/* Primary Navigation Menu */}
        <div className="space-y-1 pt-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-3 block mb-2 font-semibold">
            Telemetry Operations
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c1f2b] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* System & Portal Links */}
        <div className="space-y-1 pt-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-3 block mb-2 font-semibold">
            System Navigation
          </span>

          {onGoToLanding && (
            <button
              onClick={onGoToLanding}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#1c1f2b] transition-all border border-transparent"
            >
              <Compass className="w-4 h-4 text-slate-400" />
              <span>Portal Landing Page</span>
            </button>
          )}

          <div className="p-3 rounded-xl bg-[#1c1f2b] border border-[#282c3c] mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Stream Engine
              </span>
              <span className="text-emerald-400 font-bold">1.0 Hz</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Latency: &lt; 14 ms • Kalman: Nominal
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Profile / Officer Card */}
      <div className="p-4 border-t border-[#262a38]">
        {currentUser ? (
          <div className="p-3 rounded-xl bg-[#1c1f2b] border border-[#282c3c] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-xs shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {currentUser.name}
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  {currentUser.badgeId} • {currentUser.role}
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all shrink-0"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/40 transition-all"
          >
            <User className="w-4 h-4" />
            <span>Staff Authentication</span>
          </button>
        )}
      </div>
    </aside>
  );
};
