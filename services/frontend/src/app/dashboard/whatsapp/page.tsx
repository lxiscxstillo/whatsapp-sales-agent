'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MaintenancePanel } from '@/components/MaintenancePanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  qrcode: string | null;
  session: string;
  checkedAt: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const QR_REFRESH_INTERVAL = 20; // seconds — QR expires at ~60s, refresh every 20s

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 22, stiffness: 280 },
  },
};

// ─── Countdown Hook ───────────────────────────────────────────────────────────

function useCountdown(checkedAt: string | undefined, total = QR_REFRESH_INTERVAL): number {
  const [secs, setSecs] = useState(total);

  useEffect(() => {
    setSecs(total);
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [checkedAt, total]);

  return secs;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonPanel() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 animate-shimmer rounded-2xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-5 animate-shimmer rounded-lg w-40" />
          <div className="h-3.5 animate-shimmer rounded-lg w-28" />
        </div>
      </div>
      {/* QR placeholder */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-64 h-64 animate-shimmer rounded-xl" />
        <div className="h-3 animate-shimmer rounded-lg w-36" />
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
      className="bg-red-50 border border-red-200/80 rounded-2xl p-8 shadow-sm"
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-700">
            Sin conexión con WPPConnect
          </h3>
          <p className="text-sm text-red-500 mt-1 font-mono break-all">{message}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-red-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Reintentando automáticamente…</span>
        </div>
      </div>
    </motion.div>
  );
}

function ConnectedPanel({ data }: { data: WhatsAppStatus }) {
  const secsSince = Math.round(
    (Date.now() - new Date(data.checkedAt).getTime()) / 1000
  );

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
      className="bg-white rounded-2xl border border-emerald-200/80 p-8 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <Smartphone className="w-7 h-7 text-emerald-500" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400" />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-emerald-600">Conectado</h3>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Sesión activa · {data.session}
          </p>
        </div>
      </div>

      {/* Status pill */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-xl px-4 py-2.5">
          <Wifi className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700">isLogged</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5">
          <CheckCircle className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500">
            Verificado hace {secsSince}s
          </span>
        </div>
      </div>

      {/* Bottom message */}
      <p className="text-sm text-slate-400 border-t border-slate-100 pt-4">
        El agente está activo y recibiendo mensajes de WhatsApp.
      </p>
    </motion.div>
  );
}

function QrPanel({ data, countdown }: { data: WhatsAppStatus; countdown: number }) {
  const progress = (countdown / QR_REFRESH_INTERVAL) * 100;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
      className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <WifiOff className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Escanea el código QR
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Vincula WhatsApp con el agente
          </p>
        </div>
      </div>

      {/* QR Image */}
      <div className="flex flex-col items-center gap-4 mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={data.checkedAt}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.qrcode!}
              alt="WhatsApp QR Code"
              width={256}
              height={256}
              className="rounded-xl border border-slate-200 shadow-inner"
            />
          </motion.div>
        </AnimatePresence>

        {/* Countdown */}
        <div className="w-64 space-y-1.5">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            {countdown <= 3 ? (
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
            ) : (
              <span className="w-3 h-3" />
            )}
            <span>
              {countdown <= 0
                ? 'Actualizando QR…'
                : `Nuevo QR en ${countdown}s`}
            </span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="border-t border-slate-100 pt-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Cómo escanear
        </p>
        <ol className="space-y-2">
          {[
            'Abre WhatsApp en tu teléfono',
            'Ve a Configuración → Dispositivos vinculados',
            'Toca "Vincular dispositivo" y escanea',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-500">
              <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

function RestartingPanel({ onRestart, isRestarting }: { onRestart: () => void; isRestarting: boolean }) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
      className="bg-white rounded-2xl border border-amber-200/80 p-8 shadow-sm"
    >
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center">
          <RefreshCw className={`w-7 h-7 text-amber-500 ${isRestarting ? 'animate-spin' : ''}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-700">Generando QR…</h3>
          <p className="text-sm text-slate-400 mt-1">
            La sesión se está reiniciando. El código QR aparecerá en unos segundos.
          </p>
        </div>
        {!isRestarting && (
          <button
            onClick={onRestart}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reiniciar sesión
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Circuit Breaker constants ────────────────────────────────────────────────
const FAILURE_THRESHOLD = 3;
const RECOVERY_DELAY_MS = 30_000;

function WhatsAppClient() {
  const [isRestarting, setIsRestarting] = useState(false);

  // Circuit breaker state
  const failureCount = useRef(0);
  const openedAt = useRef(0);
  const [circuitState, setCircuitState] = useState<'CLOSED' | 'OPEN' | 'HALF_OPEN'>('CLOSED');
  const [retryIn, setRetryIn] = useState(0);

  // Countdown to HALF_OPEN when circuit is OPEN
  useEffect(() => {
    if (circuitState !== 'OPEN') return;
    setRetryIn(Math.ceil(RECOVERY_DELAY_MS / 1000));
    const interval = setInterval(() => {
      const elapsed = Date.now() - openedAt.current;
      const remaining = Math.max(0, Math.ceil((RECOVERY_DELAY_MS - elapsed) / 1000));
      setRetryIn(remaining);
      if (elapsed >= RECOVERY_DELAY_MS) {
        setCircuitState('HALF_OPEN');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [circuitState]);

  const { data, error, isLoading, mutate } = useSWR<WhatsAppStatus>(
    '/api/whatsapp',
    fetcher,
    {
      refreshInterval: (d) => {
        if (circuitState === 'OPEN') return 0; // pause polling when open
        if (!d || d.connected) return 10_000;
        if (!d.qrcode) return 5_000;
        return QR_REFRESH_INTERVAL * 1000;
      },
      revalidateOnFocus: circuitState === 'CLOSED',
      dedupingInterval: 4_000,
      onSuccess: () => {
        failureCount.current = 0;
        if (circuitState !== 'CLOSED') setCircuitState('CLOSED');
      },
      onError: () => {
        failureCount.current += 1;
        if (failureCount.current >= FAILURE_THRESHOLD && circuitState === 'CLOSED') {
          openedAt.current = Date.now();
          setCircuitState('OPEN');
        } else if (circuitState === 'HALF_OPEN') {
          // Test request failed — reopen
          openedAt.current = Date.now();
          setCircuitState('OPEN');
        }
      },
    }
  );

  const countdown = useCountdown(data?.checkedAt);

  const handleManualRetry = () => {
    failureCount.current = 0;
    setCircuitState('HALF_OPEN');
    mutate();
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await fetch('/api/whatsapp', { method: 'POST' });
      setTimeout(() => mutate(), 3_000);
      setTimeout(() => mutate(), 6_000);
      setTimeout(() => mutate(), 10_000);
    } finally {
      setTimeout(() => setIsRestarting(false), 12_000);
    }
  };

  // Circuit OPEN or HALF_OPEN — show maintenance panel
  if (circuitState === 'OPEN' || circuitState === 'HALF_OPEN') {
    return (
      <MaintenancePanel
        state={circuitState}
        retryIn={retryIn}
        onManualRetry={handleManualRetry}
      />
    );
  }

  if (isLoading || (!data && !error)) {
    return <SkeletonPanel />;
  }

  if (error || data?.status === 'ERROR') {
    return <ErrorPanel message={data?.error ?? error?.message ?? 'Error desconocido'} />;
  }

  if (data!.connected) {
    return <ConnectedPanel data={data!} />;
  }

  if (data!.qrcode) {
    return <QrPanel data={data!} countdown={countdown} />;
  }

  // CLOSED / transitional state — no QR yet
  return <RestartingPanel onRestart={handleRestart} isRestarting={isRestarting} />;
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8 lg:pl-0 pl-12">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Conexión WhatsApp
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Estado de la sesión activa del agente.
        </p>
      </div>

      <WhatsAppClient />
    </div>
  );
}
