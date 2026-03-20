'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import {
  Building2,
  Flame,
  PhoneForwarded,
  Clock,
  CheckCircle,
  Sparkles,
  Search,
  Menu,
  X,
  BarChart3,
  Smartphone,
} from 'lucide-react';
import type { Lead, PaginatedResponse } from '@/types/lead';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_CONFIG = [
  { key: 'NEW', label: 'Nuevos', icon: Sparkles, color: 'text-violet-400', dot: 'bg-violet-400', pulse: false },
  { key: 'QUALIFYING', label: 'Calificando', icon: Search, color: 'text-blue-400', dot: 'bg-blue-400', pulse: false },
  { key: 'HOT', label: 'Calientes', icon: Flame, color: 'text-orange-400', dot: 'bg-orange-400', pulse: false },
  { key: 'HANDOFF', label: 'Handoff', icon: PhoneForwarded, color: 'text-red-400', dot: 'bg-red-400', pulse: true },
  { key: 'PAUSED', label: 'Pausados', icon: Clock, color: 'text-amber-400', dot: 'bg-amber-400', pulse: false },
  { key: 'CLOSED', label: 'Cerrados', icon: CheckCircle, color: 'text-emerald-400', dot: 'bg-emerald-400', pulse: false },
];

interface Props {
  counts?: Record<string, number>;
}

function useWhatsAppStatus() {
  const { data } = useSWR<{ connected: boolean }>(
    '/api/whatsapp',
    fetcher,
    { refreshInterval: 10_000, dedupingInterval: 5_000 }
  );
  return data;
}

function useLiveCounts(initial?: Record<string, number>) {
  const { data } = useSWR<PaginatedResponse<Lead>>(
    '/api/leads?limit=200',
    fetcher,
    { refreshInterval: 5000, fallbackData: undefined }
  );

  if (!data?.data) return initial ?? {};
  const leads = data.data;
  const counts: Record<string, number> = { _total: leads.length };
  for (const lead of leads) {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1;
  }
  return counts;
}

function SidebarContent({ counts: initialCounts, onClose }: Props & { onClose?: () => void }) {
  const counts = useLiveCounts(initialCounts);
  const wppStatus = useWhatsAppStatus();
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Asesor Pro</h1>
            <p className="text-xs text-slate-400">Panel de Leads</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
        {/* All leads */}
        <Link
          href="/dashboard"
          onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-1 ${
            pathname === '/dashboard'
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 flex-shrink-0" />
          <span>Todos los leads</span>
          <span className="ml-auto text-xs font-semibold bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
            {counts._total ?? 0}
          </span>
        </Link>

        {/* Status section */}
        <div className="mt-4">
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider px-3 mb-2">
            Por estado
          </p>
          <div className="space-y-0.5">
            {STATUS_CONFIG.map((s) => {
              const Icon = s.icon;
              const count = counts[s.key] ?? 0;
              const isActive = pathname.includes(`status=${s.key}`);

              return (
                <Link
                  key={s.key}
                  href={`/dashboard?status=${s.key}`}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${
                      s.pulse ? 'animate-pulse' : ''
                    }`}
                  />
                  <Icon className={`w-4 h-4 flex-shrink-0 ${s.color}`} />
                  <span>{s.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        s.key === 'HANDOFF'
                          ? 'bg-red-500/20 text-red-400'
                          : s.key === 'HOT'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Tools section */}
        <div className="mt-4">
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider px-3 mb-2">
            Herramientas
          </p>
          <Link
            href="/dashboard/whatsapp"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
              pathname === '/dashboard/whatsapp'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                !wppStatus
                  ? 'bg-slate-600'
                  : wppStatus.connected
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <Smartphone className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span>WhatsApp</span>
            <span
              className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                !wppStatus
                  ? 'bg-white/10 text-slate-500'
                  : wppStatus.connected
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {!wppStatus ? '...' : wppStatus.connected ? 'ON' : 'OFF'}
            </span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 flex-shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">Asesor</p>
            <p className="text-xs text-slate-500">En línea</p>
          </div>
          <div className="ml-auto w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ counts }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-slate-900 flex-col flex-shrink-0 border-r border-slate-800">
        <SidebarContent counts={counts} />
      </aside>

      {/* Mobile hamburger trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg border border-slate-700"
      >
        <Menu className="w-4 h-4 text-white" />
      </button>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              key="drawer"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-60 bg-slate-900 z-50 border-r border-slate-800"
            >
              <SidebarContent counts={counts} onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
