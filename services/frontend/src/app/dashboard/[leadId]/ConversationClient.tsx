'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message, PaginatedResponse } from '@/types/lead';
import { MessageBubble } from '@/components/MessageBubble';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col bg-slate-50 scrollbar-thin"
      style={{ minHeight: 0 }}
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
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            >
              <MessageBubble message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
