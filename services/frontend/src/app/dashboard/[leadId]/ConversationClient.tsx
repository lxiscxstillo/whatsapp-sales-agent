'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 py-4 flex flex-col bg-gray-50"
      style={{ minHeight: 0 }}
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Sin mensajes aún
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
    </div>
  );
}
