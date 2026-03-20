import type { Message } from '@/types/lead';
import { Bot, User, UserCheck } from 'lucide-react';

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === 'INBOUND';
  const isHuman = message.senderType === 'HUMAN';

  const SenderIcon = isInbound ? User : isHuman ? UserCheck : Bot;
  const senderLabel = isInbound ? 'Lead' : isHuman ? 'Tú' : 'IA';

  const bubbleClass = isInbound
    ? 'bg-white border border-slate-200 text-slate-900 rounded-2xl rounded-tl-sm shadow-sm'
    : isHuman
    ? 'bg-emerald-500 text-white rounded-2xl rounded-tr-sm shadow-sm'
    : 'bg-indigo-500 text-white rounded-2xl rounded-tr-sm shadow-sm';

  const labelColor = isInbound
    ? 'text-slate-400'
    : isHuman
    ? 'text-emerald-600'
    : 'text-indigo-500';

  const iconBg = isInbound
    ? 'bg-slate-100 text-slate-400'
    : isHuman
    ? 'bg-emerald-100 text-emerald-500'
    : 'bg-indigo-100 text-indigo-500';

  return (
    <div className={`flex gap-2 mb-4 ${isInbound ? 'justify-start' : 'justify-end'}`}>
      {isInbound && (
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-5 ${iconBg}`}
        >
          <SenderIcon className="w-3.5 h-3.5" />
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${isInbound ? 'items-start' : 'items-end'}`}>
        <span className={`text-xs font-medium mb-1 ${labelColor}`}>{senderLabel}</span>
        <div className={`px-4 py-2.5 ${bubbleClass}`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body}</p>
          {message.isAmbiguous && (
            <span className="text-xs opacity-60 mt-1.5 block">⚠ Mensaje ambiguo</span>
          )}
        </div>
        <span className="text-xs text-slate-400 mt-1">{formatTime(message.createdAt)}</span>
      </div>

      {!isInbound && (
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-5 ${iconBg}`}
        >
          <SenderIcon className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
