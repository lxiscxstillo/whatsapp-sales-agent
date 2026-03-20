'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message, PaginatedResponse } from '@/types/lead';
import { Bot, User, UserCheck } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ msg, isFirst }: { msg: Message; isFirst: boolean }) {
  const isInbound = msg.direction === 'INBOUND';
  const isHuman = msg.senderType === 'HUMAN';
  const isAgent = msg.senderType === 'AGENT';

  // Avatar
  const Avatar = () => {
    if (!isFirst) return <div className="w-7 flex-shrink-0" />;
    if (isInbound) return (
      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 self-end">
        <User className="w-3.5 h-3.5 text-slate-500" />
      </div>
    );
    if (isHuman) return (
      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 self-end">
        <UserCheck className="w-3.5 h-3.5 text-white" />
      </div>
    );
    return (
      <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 self-end">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
    );
  };

  // Bubble colors
  const bubbleCls = isInbound
    ? 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-sm'
    : isHuman
    ? 'bg-emerald-500 text-white rounded-tr-sm'
    : 'bg-indigo-500 text-white rounded-tr-sm';

  const containerCls = isInbound ? 'flex-row' : 'flex-row-reverse';

  return (
    <div className={`flex items-end gap-1.5 ${containerCls} max-w-[82%] ${isInbound ? 'self-start' : 'self-end'}`}>
      <Avatar />
      <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm ${bubbleCls}`} style={{ wordBreak: 'break-word' }}>
        {!isInbound && isFirst && (
          <p className={`text-[10px] font-semibold mb-1 ${isHuman ? 'text-emerald-100' : 'text-indigo-200'}`}>
            {isHuman ? 'Asesor' : 'Valentina IA'}
          </p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        <p className={`text-[10px] mt-1.5 text-right ${isInbound ? 'text-slate-400' : isHuman ? 'text-emerald-100' : 'text-indigo-200'}`}>
          {formatTime(msg.createdAt)}
          {msg.isAmbiguous && <span className="ml-1 opacity-60">· ambiguo</span>}
        </p>
      </div>
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-slate-200/80" />
      <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2">{label}</span>
      <div className="flex-1 h-px bg-slate-200/80" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ConversationClient({ leadId }: { leadId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = useSWR<PaginatedResponse<Message>>(
    `/api/leads/${leadId}/messages?limit=100`,
    fetcher,
    { refreshInterval: 2000 }
  );

  const messages = data?.data ?? [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Group consecutive messages by same sender for avatar logic
  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1 scrollbar-thin"
      style={{
        minHeight: 0,
        backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        backgroundColor: '#f8fafc',
      }}
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Sin mensajes aún</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Los mensajes de WhatsApp aparecerán aquí en tiempo real.
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const prev = messages[idx - 1];
            const showDateSep = !prev || !isSameDay(msg.createdAt, prev.createdAt);
            const isFirstInGroup = !prev
              || prev.direction !== msg.direction
              || prev.senderType !== msg.senderType
              || showDateSep;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                className="flex flex-col"
              >
                {showDateSep && <DateSeparator label={formatDateLabel(msg.createdAt)} />}
                <div className={`flex ${msg.direction === 'INBOUND' ? 'justify-start' : 'justify-end'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
                  <Bubble msg={msg} isFirst={isFirstInGroup} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
