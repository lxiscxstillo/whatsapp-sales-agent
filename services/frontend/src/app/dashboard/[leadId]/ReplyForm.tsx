'use client';

import { useState, useCallback, useEffect } from 'react';
import { Send, PhoneForwarded, Loader2, CheckCircle2, PauseCircle, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContainer, type ToastData } from '@/components/Toast';

interface Props {
  leadId: string;
  status: string;
}

let toastCounter = 0;

export default function ReplyForm({ leadId, status }: Props) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  // Sync local state when the server re-sends a different status prop.
  // This fixes the case where Next.js reuses the client component without
  // remounting it (e.g., navigating back to the same lead after pausing it).
  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = String(++toastCounter);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isClosed = currentStatus === 'CLOSED';
  const isPaused = currentStatus === 'PAUSED';
  const isHandoff = currentStatus === 'HANDOFF';
  const agentStopped = isClosed || isPaused || isHandoff;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al enviar');
      }
      setBody('');
      addToast('success', 'Mensaje enviado');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  async function patchStatus(newStatus: string, label: string) {
    if (actionLoading) return;
    setActionLoading(newStatus);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`Error al ${label}`);
      setCurrentStatus(newStatus);
      addToast('success', `Lead ${label} correctamente`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : `Error al ${label}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleHandoff() {
    if (actionLoading || isHandoff) return;
    const res = await fetch(`/api/leads/${leadId}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Handoff manual desde panel del asesor' }),
    });
    if (res.ok) {
      setCurrentStatus('HANDOFF');
      addToast('success', 'Handoff activado — el agente IA se detuvo');
    } else {
      addToast('error', 'Error al activar handoff');
    }
  }

  // Status banner config
  const bannerConfig: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; msg: string }> = {
    CLOSED: {
      bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
      icon: <CheckCircle2 className="w-4 h-4 flex-shrink-0" />,
      msg: 'Lead cerrado — el agente IA no responderá más mensajes',
    },
    PAUSED: {
      bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
      icon: <PauseCircle className="w-4 h-4 flex-shrink-0" />,
      msg: 'Lead pausado — el agente IA está en pausa.',
    },
    HANDOFF: {
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600',
      icon: <PhoneForwarded className="w-4 h-4 flex-shrink-0" />,
      msg: 'Lead en handoff — estás respondiendo como asesor humano.',
    },
  };

  const banner = bannerConfig[currentStatus];

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="bg-white border-t border-slate-200 p-4 flex-shrink-0 space-y-3">

        {/* Status banner */}
        <AnimatePresence>
          {banner && (
            <motion.div
              key={currentStatus}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border ${banner.bg} ${banner.border} ${banner.text}`}>
                {banner.icon}
                <p className="text-xs font-medium flex-1">{banner.msg}</p>
                {/* Reactivar button for PAUSED, HANDOFF and CLOSED */}
                {(isPaused || isHandoff || isClosed) && (
                  <button
                    type="button"
                    onClick={() => patchStatus('QUALIFYING', 'reactivado')}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1 text-xs font-semibold bg-slate-700 text-white rounded-lg px-2.5 py-1 hover:bg-slate-900 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {actionLoading === 'QUALIFYING' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                    Reactivar IA
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea + send */}
        <form onSubmit={handleSubmit} className="flex gap-2.5 items-end">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder={
              isClosed
                ? 'Lead cerrado — no se pueden enviar mensajes'
                : agentStopped
                ? 'Escribe tu respuesta como asesor...'
                : 'Escribe tu respuesta al lead...'
            }
            rows={2}
            disabled={sending || isClosed}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 focus:bg-white transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending || isClosed}
            title="Enviar mensaje (Enter)"
            className="flex items-center justify-center w-10 h-10 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

        {/* Action buttons row */}
        <div className="flex gap-2">
          {/* Pausar / Reactivar */}
          <button
            type="button"
            onClick={() => agentStopped ? patchStatus('QUALIFYING', 'reactivado') : patchStatus('PAUSED', 'pausado')}
            disabled={!!actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              agentStopped
                ? 'bg-slate-700 text-white hover:bg-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700'
            }`}
          >
            {actionLoading === 'PAUSED' || actionLoading === 'QUALIFYING'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : agentStopped ? <Undo2 className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />
            }
            {agentStopped ? 'Reactivar IA' : 'Pausar IA'}
          </button>

          {/* Handoff */}
          <button
            type="button"
            onClick={handleHandoff}
            disabled={!!actionLoading || isHandoff || isClosed}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isHandoff
                ? 'bg-red-100 text-red-600 cursor-default'
                : 'bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600'
            }`}
          >
            {actionLoading === 'HANDOFF'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <PhoneForwarded className="w-3.5 h-3.5" />
            }
            {isHandoff ? 'En handoff' : 'Handoff'}
          </button>

          {/* Cerrar lead */}
          <button
            type="button"
            onClick={() => {
              if (isClosed) return;
              if (!confirm('¿Cerrar este lead? El agente dejará de responderle.')) return;
              patchStatus('CLOSED', 'cerrado');
            }}
            disabled={!!actionLoading || isClosed}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isClosed
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
            }`}
          >
            {actionLoading === 'CLOSED'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />
            }
            {isClosed ? 'Cerrado' : 'Cerrar lead'}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 px-0.5">
          Enter → enviar · Shift+Enter → nueva línea
        </p>
      </div>
    </>
  );
}
