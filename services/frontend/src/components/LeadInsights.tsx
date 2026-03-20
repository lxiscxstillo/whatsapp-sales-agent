import type { Lead } from '@/types/lead';

interface Insight {
  emoji: string;
  text: string;
  color: string;
}

function generateInsights(lead: Lead): Insight[] {
  const insights: Insight[] = [];
  const { slots, interestLevel, ambiguityCount, handoffReason } = lead;

  // Interest level
  if (interestLevel >= 5) {
    insights.push({ emoji: '🔥', text: 'Interés máximo — candidato muy calificado', color: 'text-orange-700 bg-orange-50 border-orange-200' });
  } else if (interestLevel >= 4) {
    insights.push({ emoji: '📈', text: 'Alta intención de compra confirmada', color: 'text-amber-700 bg-amber-50 border-amber-200' });
  } else if (interestLevel >= 3) {
    insights.push({ emoji: '💡', text: 'Interés moderado-alto, perfil en desarrollo', color: 'text-blue-700 bg-blue-50 border-blue-200' });
  } else if (interestLevel >= 1) {
    insights.push({ emoji: '🌱', text: 'Interés inicial — requiere más calificación', color: 'text-slate-600 bg-slate-50 border-slate-200' });
  }

  // Urgency
  const urgencyLow = slots.urgency?.toLowerCase() ?? '';
  if (urgencyLow && (urgencyLow.includes('alta') || urgencyLow.includes('urgente') || urgencyLow.includes('inmediato') || urgencyLow.includes('ya'))) {
    insights.push({ emoji: '⚡', text: 'Urgencia de compra alta — no dejar enfriar', color: 'text-red-700 bg-red-50 border-red-200' });
  }

  // Budget
  if (slots.budgetNumeric && slots.budgetNumeric > 0) {
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(slots.budgetNumeric);
    insights.push({ emoji: '💰', text: `Presupuesto calificado: ${fmt}`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' });
  } else if (slots.budget) {
    insights.push({ emoji: '💰', text: `Presupuesto declarado: ${slots.budget}`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' });
  }

  // Zone
  if (slots.zone) {
    insights.push({ emoji: '📍', text: `Busca en zona específica: ${slots.zone}`, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' });
  }

  // Intent
  const intentLow = slots.intent?.toLowerCase() ?? '';
  if (intentLow.includes('comprar') || intentLow.includes('compra')) {
    insights.push({ emoji: '🏠', text: 'Intención de compra declarada', color: 'text-violet-700 bg-violet-50 border-violet-200' });
  } else if (intentLow.includes('arrendar') || intentLow.includes('arriendo')) {
    insights.push({ emoji: '🔑', text: 'Busca arrendamiento', color: 'text-sky-700 bg-sky-50 border-sky-200' });
  }

  // Property type
  if (slots.propertyType) {
    insights.push({ emoji: '🏗️', text: `Tipo de inmueble: ${slots.propertyType}`, color: 'text-slate-600 bg-slate-50 border-slate-200' });
  }

  // Main need
  if (slots.mainNeed) {
    insights.push({ emoji: '🎯', text: `Prioridad del cliente: ${slots.mainNeed}`, color: 'text-teal-700 bg-teal-50 border-teal-200' });
  }

  // Handoff
  if (handoffReason) {
    insights.push({ emoji: '🤝', text: 'Calificado para asesoría humana directa', color: 'text-red-700 bg-red-50 border-red-200' });
  }

  // Ambiguity warning
  if (ambiguityCount >= 3) {
    insights.push({ emoji: '⚠️', text: 'Varias respuestas ambiguas — perfil incierto', color: 'text-amber-700 bg-amber-50 border-amber-200' });
  }

  return insights;
}

export function LeadInsights({ lead }: { lead: Lead }) {
  const insights = generateInsights(lead);

  if (insights.length === 0) return null;

  return (
    <div className="p-5 border-b border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Lead Insight
      </p>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs font-medium leading-snug ${insight.color}`}
          >
            <span className="flex-shrink-0 mt-px">{insight.emoji}</span>
            <span>{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
