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
  Link,
  Loader2,
} from 'lucide-react';
import { MaintenancePanel } from '@/components/MaintenancePanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionState =
  | 'CONNECTED'
  | 'QR_CODE_READY'
  | 'AUTHENTICATING'
  | 'DISCONNECTED'
  | 'ERROR';

interface WhatsAppStatus {
  connectionState: ConnectionState;
  connected: boolean;
  status: string;
  qrcode: string | null;
  session: string;
  checkedAt: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const QR_DISPLAY_TIMEOUT_SECS = 60; // show "Reintentar" after 60s without scan

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 22, stiffness: 280 },
  },
};

// ─── Polling intervals by connectionState ─────────────────────────────────────
// QR_CODE_READY / AUTHENTICATING: 2s — detect scan within 2s of user action
// DISCONNECTED / ERROR: 5s — quick recovery detection
// CONNECTED: 10s — session rarely changes, keep load low

function getRefreshInterval(data: WhatsAppStatus | undefined, circuitOpen: boolean): number {
  if (circuitOpen) return 0;
  if (!data) return 5000;
  switch (data.connectionState) {
    case 'CONNECTED':      return 10000;
    case 'QR_CODE_READY':  return 2000;
    case 'AUTHENTICATING': return 2000;
    case 'DISCONNECTED':   return 5000;
    case 'ERROR':          return 5000;
    default:               return 5000;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonPanel() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 animate-shimmer rounded-2xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-5 animate-shimmer rounded-lg w-40" />
          <div className="h-3.5 animate-shimmer rounded-lg w-28" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="w-64 h-64 animate-shimmer rounded-xl" />
        <div className="h-3 animate-shimmer rounded-lg w-36" />
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <motion.div variants={cardVariants} initial="hidden" animate="show"
      className="bg-red-50 border border-red-200/80 rounded-2xl p-8 shadow-sm"
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-700">Sin conexión con WPPConnect</h3>
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

function DisconnectedPanel({ onStart, isStarting }: { onStart: () => void; isStarting: boolean }) {
  return (
    <motion.div variants={cardVariants} initial="hidden" animate="show"
      className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm"
    >
      <div className="flex flex-col items-center text-center gap-5 py-6">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-slate-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800">Desconectado</h3>
          <p className="text-sm text-slate-500 mt-1.5 max-w-xs">
            El agente no está vinculado a ningún teléfono. Inicia la vinculación para generar el código QR.
          </p>
        </div>
        <button
          onClick={onStart}
          disabled={isStarting}
          className="flex items-center gap-2.5 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-200"
        >
          {isStarting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Link className="w-4 h-4" />
          )}
          {isStarting ? 'Iniciando…' : 'Iniciar Vinculación'}
        </button>
      </div>
    </motion.div>
  );
}

function AuthenticatingPanel() {
  return (
    <motion.div variants={cardVariants} initial="hidden" animate="show"
      className="bg-white rounded-2xl border border-amber-200/80 p-8 shadow-sm"
    >
      <div className="flex flex-col items-center text-center gap-5 py-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 bg-amber-100 rounded-2xl flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-amber-500" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400" />
          </span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800">Autenticando…</h3>
          <p className="text-sm text-slate-500 mt-1.5">
            QR escaneado correctamente. Sincronizando sesión con WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-amber-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Esto tomará unos segundos</span>
        </div>
      </div>
    </motion.div>
  );
}

function ConnectedPanel({ data }: { data: WhatsAppStatus }) {
  const secsSince = Math.round((Date.now() - new Date(data.checkedAt).getTime()) / 1000);

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="show"
      className="bg-white rounded-2xl border border-emerald-200/80 p-8 shadow-sm"
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="relative flex-shrink-0">
          {/* Success animation: scale spring on first mount */}
          <motion.div
            className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.15, 1], opacity: 1 }}
            transition={{ type: 'spring', duration: 0.55, delay: 0.05 }}
          >
            <Smartphone className="w-7 h-7 text-emerald-500" />
          </motion.div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400" />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-emerald-600">Agente Activo</h3>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Sesión activa · {data.session}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-xl px-4 py-2.5">
          <Wifi className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700">Conectado</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5">
          <CheckCircle className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500">Verificado hace {secsSince}s</span>
        </div>
      </div>

      <p className="text-sm text-slate-400 border-t border-slate-100 pt-4">
        El agente está activo y recibiendo mensajes de WhatsApp.
      </p>
    </motion.div>
  );
}

function QrPanel({
  data,
  qrTimeoutExpired,
  onRestart,
}: {
  data: WhatsAppStatus;
  qrTimeoutExpired: boolean;
  onRestart: () => void;
}) {
  // Local countdown (0→QR_DISPLAY_TIMEOUT_SECS) reset every time checkedAt changes
  const [secs, setSecs] = useState(QR_DISPLAY_TIMEOUT_SECS);

  useEffect(() => {
    setSecs(QR_DISPLAY_TIMEOUT_SECS);
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [data.checkedAt]);

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="show"
      className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <WifiOff className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">Escanea el código QR</h3>
          <p className="text-sm text-slate-500 mt-0.5">Vincula WhatsApp con el agente</p>
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

        {/* Progress bar */}
        <div className="w-64 space-y-1.5">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(secs / QR_DISPLAY_TIMEOUT_SECS) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            {secs <= 5 ? (
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
            ) : (
              <span className="w-3 h-3" />
            )}
            <span>{secs <= 0 ? 'Actualizando QR…' : `Expira en ${secs}s`}</span>
          </div>
        </div>

        {/* T006: 60s timeout CTA */}
        {qrTimeoutExpired && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onRestart}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar
          </motion.button>
        )}
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

// ─── Circuit Breaker constants ────────────────────────────────────────────────
const FAILURE_THRESHOLD = 3;
const RECOVERY_DELAY_MS = 30_000;

// ─── Main Client Component ────────────────────────────────────────────────────

function WhatsAppClient() {
  const [isStarting, setIsStarting] = useState(false);

  // Circuit breaker
  const failureCount = useRef(0);
  const openedAt = useRef(0);
  const [circuitState, setCircuitState] = useState<'CLOSED' | 'OPEN' | 'HALF_OPEN'>('CLOSED');
  const [retryIn, setRetryIn] = useState(0);

  useEffect(() => {
    if (circuitState !== 'OPEN') return;
    setRetryIn(Math.ceil(RECOVERY_DELAY_MS / 1000));
    const interval = setInterval(() => {
      const elapsed = Date.now() - openedAt.current;
      const remaining = Math.max(0, Math.ceil((RECOVERY_DELAY_MS - elapsed) / 1000));
      setRetryIn(remaining);
      if (elapsed >= RECOVERY_DELAY_MS) setCircuitState('HALF_OPEN');
    }, 1000);
    return () => clearInterval(interval);
  }, [circuitState]);

  // QR 60s timeout (T006)
  const qrStartedAt = useRef<number>(0);
  const [qrExpired, setQrExpired] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<WhatsAppStatus>(
    '/api/whatsapp',
    fetcher,
    {
      refreshInterval: (d) => getRefreshInterval(d, circuitState === 'OPEN'),
      revalidateOnFocus: circuitState === 'CLOSED',
      dedupingInterval: 2000,
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
          openedAt.current = Date.now();
          setCircuitState('OPEN');
        }
      },
    }
  );

  // Track QR_CODE_READY start time for 60s timeout
  useEffect(() => {
    if (data?.connectionState === 'QR_CODE_READY') {
      if (qrStartedAt.current === 0) {
        qrStartedAt.current = Date.now();
        setQrExpired(false);
      }
      const elapsed = Date.now() - qrStartedAt.current;
      const remaining = QR_DISPLAY_TIMEOUT_SECS * 1000 - elapsed;
      if (remaining <= 0) {
        setQrExpired(true);
        return;
      }
      const timer = setTimeout(() => setQrExpired(true), remaining);
      return () => clearTimeout(timer);
    } else {
      qrStartedAt.current = 0;
      setQrExpired(false);
    }
  }, [data?.connectionState]);

  const handleManualRetry = () => {
    failureCount.current = 0;
    setCircuitState('HALF_OPEN');
    mutate();
  };

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await fetch('/api/whatsapp', { method: 'POST' });
      // Poll aggressively after restart to catch QR_CODE_READY quickly
      setTimeout(() => mutate(), 3000);
      setTimeout(() => mutate(), 6000);
      setTimeout(() => mutate(), 10000);
    } finally {
      setTimeout(() => setIsStarting(false), 12000);
    }
  };

  // Circuit OPEN / HALF_OPEN — show maintenance panel
  if (circuitState === 'OPEN' || circuitState === 'HALF_OPEN') {
    return (
      <MaintenancePanel
        state={circuitState}
        retryIn={retryIn}
        onManualRetry={handleManualRetry}
      />
    );
  }

  if (isLoading || (!data && !error)) return <SkeletonPanel />;

  // Determine effective state — fallback to legacy fields for older backend responses
  const connectionState: ConnectionState =
    data?.connectionState ??
    (error ? 'ERROR' : data?.connected ? 'CONNECTED' : data?.qrcode ? 'QR_CODE_READY' : 'DISCONNECTED');

  if (connectionState === 'ERROR') {
    return <ErrorPanel message={data?.error ?? error?.message ?? 'Error desconocido'} />;
  }

  if (connectionState === 'CONNECTED') {
    return <ConnectedPanel data={data!} />;
  }

  if (connectionState === 'QR_CODE_READY') {
    return (
      <QrPanel
        data={data!}
        qrTimeoutExpired={qrExpired}
        onRestart={handleStart}
      />
    );
  }

  if (connectionState === 'AUTHENTICATING') {
    return <AuthenticatingPanel />;
  }

  // DISCONNECTED (default)
  return <DisconnectedPanel onStart={handleStart} isStarting={isStarting} />;
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
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
