'use client';

import { useState } from 'react';
import { Send, PhoneForwarded, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  leadId: string;
  isHandoff?: boolean;
}

export default function ReplyForm({ leadId, isHandoff }: Props) {
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al enviar');
      }

      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje');
    } finally {
      setLoading(false);
    }
  }

  async function handleHandoff() {
    if (handoffLoading || handoffDone || isHandoff) return;

    setHandoffLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/leads/${leadId}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Handoff manual desde panel del asesor' }),
      });

      if (!res.ok) throw new Error('Error al activar handoff');
      setHandoffDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar handoff');
    } finally {
      setHandoffLoading(false);
    }
  }

  return (
    <div className="bg-white border-t border-slate-200 p-4 flex-shrink-0">
      {/* HANDOFF banner */}
      {isHandoff && (
        <div className="mb-3 flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
          <PhoneForwarded className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 font-medium">
            Lead en handoff — respondiendo como asesor humano
          </p>
        </div>
      )}

      {handoffDone && (
        <div className="mb-3 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-emerald-700 font-medium">
            Handoff activado — este lead ya no recibirá respuestas automáticas
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mb-2 px-1">{error}</p>
      )}

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
          placeholder="Escribe tu respuesta al lead..."
          rows={2}
          disabled={loading}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 focus:bg-white transition-all disabled:opacity-60"
        />

        <div className="flex flex-col gap-2 flex-shrink-0">
          {/* Send button */}
          <motion.button
            type="submit"
            disabled={!body.trim() || loading}
            whileTap={{ scale: 0.92 }}
            title="Enviar mensaje"
            className="flex items-center justify-center w-10 h-10 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </motion.button>

          {/* Handoff button */}
          <motion.button
            type="button"
            onClick={handleHandoff}
            disabled={handoffLoading || handoffDone || !!isHandoff}
            whileTap={{ scale: 0.92 }}
            title={
              isHandoff
                ? 'Handoff ya activo'
                : handoffDone
                ? 'Handoff activado'
                : 'Activar handoff humano'
            }
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-sm ${
              handoffDone
                ? 'bg-emerald-100 text-emerald-500 cursor-default'
                : isHandoff
                ? 'bg-red-100 text-red-400 cursor-default'
                : 'bg-red-500 text-white hover:bg-red-600 shadow-red-200 hover:shadow-red-300'
            }`}
          >
            {handoffLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : handoffDone ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <PhoneForwarded className="w-4 h-4" />
            )}
          </motion.button>
        </div>
      </form>

      <p className="text-xs text-slate-400 mt-2 px-1">
        Enter → enviar · Shift+Enter → nueva línea ·{' '}
        <span className="text-red-400 font-medium">↗ botón rojo = handoff humano</span>
      </p>
    </div>
  );
}
