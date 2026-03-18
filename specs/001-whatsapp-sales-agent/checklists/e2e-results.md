# E2E Demo Checklist Results

**Feature**: Agente de Ventas Inmobiliarias en WhatsApp
**Date**: 2026-03-18
**Status**: Implementation complete — awaiting live environment for validation

---

## Flujo 1: Mensaje inicial de un nuevo prospecto

- [ ] Lead escribe "Hola" al número de WhatsApp
- [ ] Webhook recibido en backend-api con payload correcto
- [ ] Lead creado en DB con `status: NEW`
- [ ] Agente detecta `GREETING` y genera respuesta de bienvenida
- [ ] Lead actualizado a `status: QUALIFYING`
- [ ] Respuesta enviada via WPPConnect en < 5s
- [ ] Evento `message.received` en logs

## Flujo 2: Calificación de slots (5-6 mensajes)

- [ ] Lead proporciona tipo de inmueble → `slotPropertyType` guardado
- [ ] Lead proporciona ciudad → `slotCity` guardado
- [ ] Lead proporciona presupuesto → `slotBudget` y `slotBudgetNumeric` guardados
- [ ] Lead proporciona intención (comprar/arrendar) → `slotIntent` guardado
- [ ] Agente NO repite preguntas ya respondidas
- [ ] `interestLevel` incrementa progresivamente

## Flujo 3: Handoff automático

- [ ] Lead expresa urgencia alta (ej: "necesito mudarse esta semana")
- [ ] `evaluate_lead` calcula `interest_level >= 4`
- [ ] `needs_handoff = True` activado en grafo
- [ ] Mensaje de cierre cálido enviado al lead
- [ ] Lead actualizado a `status: HANDOFF` en DB
- [ ] `isHandoffRequested: true` en DB
- [ ] Evento `lead.handoff` en logs
- [ ] Mensajes siguientes del lead NO generan respuesta automática

## Flujo 4: Manejo de ambigüedad (3 mensajes consecutivos)

- [ ] Lead envía mensaje incomprensible (1) → respuesta de clarificación, `ambiguityCount: 1`
- [ ] Lead envía mensaje incomprensible (2) → segunda clarificación, `ambiguityCount: 2`
- [ ] Lead envía mensaje incomprensible (3) → escalación a HANDOFF, `ambiguityCount: 3`
- [ ] Evento `agent.ambiguous_message` emitido con `ambiguityCount: 3`
- [ ] Lead en HANDOFF, mensaje explicativo enviado

## Flujo 5: Mensaje fuera de tema (OFF_TOPIC)

- [ ] Lead pregunta algo no relacionado (ej: clima)
- [ ] Agente redirige amablemente sin escalar ambiguity_counter
- [ ] Conversación continúa normalmente

## Flujo 6: Panel de leads (US3)

- [ ] Panel carga lista de leads en `/dashboard`
- [ ] Filtro por estado funciona (ej: `?status=HANDOFF`)
- [ ] Click en fila abre conversación completa
- [ ] Historial de mensajes visible con burbujas diferenciadas
- [ ] Formulario de respuesta manual envía mensaje y aparece en WhatsApp
- [ ] Mensaje manual guardado con `senderType: HUMAN`
- [ ] Panel se actualiza automáticamente cada 4 segundos (SWR polling)

## Flujo 7: Slots de lead y trazabilidad

- [ ] `GET /api/v1/leads/:id` retorna slots anidados correctamente
- [ ] Trazas visibles en LangSmith Studio con todos los nodos
- [ ] `langsmithRunId` guardado en tabla `Message`
- [ ] Logs estructurados JSON en consola del backend

---

## Notas de Validación

> Completar durante la validación en entorno de staging/producción.
> Documentar cualquier discrepancia entre comportamiento esperado y real.
