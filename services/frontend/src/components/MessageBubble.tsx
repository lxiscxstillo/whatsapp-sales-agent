import type { Message } from '@/types/lead';

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === 'INBOUND';
  const isHuman = message.senderType === 'HUMAN';
  const isAgent = message.senderType === 'AGENT';

  const bubbleClass = isInbound
    ? 'bg-white border border-gray-200 text-gray-900 self-start'
    : isHuman
    ? 'bg-green-500 text-white self-end'
    : 'bg-blue-500 text-white self-end';

  const label = isInbound ? 'Lead' : isHuman ? 'Asesor' : 'Agente';
  const labelColor = isInbound ? 'text-gray-400' : isHuman ? 'text-green-600' : 'text-blue-600';

  return (
    <div className={`flex flex-col max-w-[80%] ${isInbound ? 'items-start' : 'items-end'} mb-3`}>
      <span className={`text-xs mb-1 font-medium ${labelColor}`}>{label}</span>
      <div className={`rounded-2xl px-4 py-2 shadow-sm ${bubbleClass}`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body}</p>
        {message.isAmbiguous && (
          <span className="text-xs opacity-70 mt-1 block">⚠ Ambiguo</span>
        )}
      </div>
      <span className="text-xs text-gray-400 mt-1">{formatTime(message.createdAt)}</span>
    </div>
  );
}
