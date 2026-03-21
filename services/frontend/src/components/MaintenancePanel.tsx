'use client';

import { motion } from 'framer-motion';
import { Wrench, RefreshCw } from 'lucide-react';

export interface MaintenancePanelProps {
  state: 'OPEN' | 'HALF_OPEN';
  retryIn?: number;
  onManualRetry: () => void;
}

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 22, stiffness: 280 },
  },
};

export function MaintenancePanel({ state, retryIn, onManualRetry }: MaintenancePanelProps) {
  const isHalfOpen = state === 'HALF_OPEN';

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
      className="bg-white rounded-2xl border border-amber-200/80 p-8 shadow-sm"
    >
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            isHalfOpen ? 'bg-blue-50' : 'bg-amber-50'
          }`}
        >
          {isHalfOpen ? (
            <RefreshCw className="w-7 h-7 text-blue-500 animate-spin" />
          ) : (
            <Wrench className="w-7 h-7 text-amber-500" />
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-700">
            {isHalfOpen ? 'Verificando conexión…' : 'Mantenimiento Temporal'}
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">
            {isHalfOpen
              ? 'Comprobando si el servicio de WhatsApp ha vuelto a estar disponible.'
              : typeof retryIn === 'number' && retryIn > 0
              ? `El servicio de WhatsApp está temporalmente inaccesible. Se reintentará en ${retryIn}s.`
              : 'El servicio de WhatsApp está temporalmente inaccesible.'}
          </p>
        </div>

        {!isHalfOpen && (
          <button
            onClick={onManualRetry}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar ahora
          </button>
        )}
      </div>
    </motion.div>
  );
}
