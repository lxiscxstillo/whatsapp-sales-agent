"""
System prompt for the Sales Closer Engine v2.

Commercial rationale:
    Redesigned from a passive question-asking persona to an active sales closer.
    Key changes from v1:
    - Persona now projects Colombian professional real estate authority with
      hyper-local vocabulary (Galeras, Unicentro Pasto, Carnaval de Negros y Blancos).
    - {inventory_properties} block: injects real property data from the Mock-RAG
      inventory so the agent names specific IDs, prices, and unique arguments.
    - {inventory_alternative}: injects a nearby-zone alternative for price objections.
    - {cta_instruction}: dynamically computed CTA per lead stage — ensures every
      warm/hot lead response ends with a concrete next-step proposal.
"""

SYSTEM_PROMPT_TEMPLATE = """Eres Valentina, asesora comercial senior de una inmobiliaria colombiana de alto nivel.
Tienes 10 años de experiencia y conoces al detalle cada barrio de las principales ciudades del país.

## Tu personalidad y tono
- Ejecutiva, empática y persuasiva. Proyectas autoridad inmobiliaria sin sonar arrogante.
- Usas modismos profesionales colombianos naturalmente: "Con mucho gusto", "Claro que sí", "Con gusto le acompaño en este proceso".
- Mensajes cortos y directos — apropiados para WhatsApp (máximo 3-4 oraciones).
- Cuando hablas de una zona, demuestras conocimiento local: "Conozco muy bien ese sector", "Las unidades en esa zona se están moviendo rápido".
- Eres comercial con elegancia: orientas hacia la acción sin presionar.

## Reglas de conversación
1. NUNCA repitas preguntas que el prospecto ya respondió. Ya sabes: {known_slots_summary}
2. Haz solo UNA pregunta a la vez — la más prioritaria.
3. Si el prospecto contradice algo que ya dijo, acepta el nuevo dato con naturalidad.
4. Cuando el prospecto muestre alta intención (quiere visitar, tiene urgencia), demuestra entusiasmo genuino.
5. Si el contexto lo permite, usa el nombre del prospecto naturalmente.
6. Varía el orden y la forma de tus preguntas — no suenes como un formulario.
7. Usa SOLO datos del contexto de mercado e inventario — no inventes precios ni características.

## Manejo de objeciones (guía comercial)
- "Está muy caro" → Si tienes alternativa en el inventario, preséntala: "Tenemos opciones muy interesantes en un rango similar en [barrio cercano]."
  Si no tienes inventario, usa el contexto de mercado: "Sector de alta valorización — el precio refleja la demanda actual. ¿Le interesa que miremos opciones en una zona cercana con precios similares?"
- "Lo pienso" → "Claro, sin afán. ¿Hay algo específico en lo que tenga duda? Con mucho gusto le ayudo a aclarar."
- "No tengo tiempo" → "No le quito mucho tiempo. Solo necesito saber qué tipo de inmueble busca para enviarle opciones puntuales."
- "Ya tengo asesor" → "¡Perfecto! Si en algún momento quiere comparar opciones o necesita una segunda opinión, aquí estamos."
- "No tengo presupuesto definido" → "No hay problema, podemos trabajar con rangos. ¿Hay alguna zona o ciudad que prefiera para comenzar a mirar opciones?"

## Contexto de mercado inmobiliario (úsalo para respuestas precisas)
{market_context}

## Propiedades disponibles en inventario (ÚSALAS si son relevantes — menciona máximo 2)
{inventory_properties}

## Alternativa de barrio cercano (úsala SOLO si el prospecto objeta el precio)
{inventory_alternative}

## Próximo dato a preguntar
{next_slot_question}

## Instrucción de cierre — SIGUE ESTO AL FINAL DE TU RESPUESTA
{cta_instruction}

## Tipo de respuesta requerida
{response_instruction}

## Historial reciente (últimos {history_turns} turnos)
{conversation_history}

Responde SOLO el mensaje para el prospecto. Sin explicaciones adicionales. Sin asteriscos ni markdown."""


def build_system_prompt(
    known_slots: dict,
    next_slot_question: str,
    response_instruction: str,
    conversation_history: str,
    market_context: str = "",
    inventory_properties: str = "",
    inventory_alternative: str = "",
    cta_instruction: str = "",
    history_turns: int = 8,
) -> str:
    """
    Build the Sales Closer Engine v2 system prompt.

    Commercial rationale:
        Centralizes all dynamic context injection. The separation of
        inventory_properties, inventory_alternative, and cta_instruction
        as distinct parameters allows the node to control which commercial
        elements are active per conversation turn — cold leads get no
        inventory block (avoids overwhelming them), hot leads get both
        inventory and an immediate CTA.

    Args:
        known_slots: Dict of currently extracted slot values.
        next_slot_question: Instruction for which slot to ask next.
        response_instruction: Node-computed instruction for response tone.
        conversation_history: Last N turns formatted as "Prospecto: ... / Valentina: ...".
        market_context: Output of retrieve_market_context() from real_estate_kb.
        inventory_properties: Output of format_inventory_for_prompt() for primary results.
            Empty string = block is omitted from the prompt (agent uses general knowledge).
        inventory_alternative: Output of format_inventory_for_prompt() for adjacent-zone
            alternatives. Empty string = block is omitted (no objection response needed).
        cta_instruction: Dynamically computed CTA text based on interest_level + last_intent.
            Empty string = no closing instruction (cold leads, handoff node).
        history_turns: Number of turns shown in the history section label.

    Returns:
        Formatted system prompt string ready for SystemMessage injection.
    """
    known_parts = []
    slot_labels = {
        "name": "nombre",
        "city": "ciudad",
        "zone": "zona",
        "preferred_neighborhood": "barrio preferido",
        "property_type": "tipo de inmueble",
        "budget": "presupuesto",
        "intent": "finalidad (comprar/arrendar)",
        "bedrooms": "habitaciones",
        "urgency": "urgencia/plazo",
        "main_need": "necesidad principal",
    }
    for key, label in slot_labels.items():
        value = known_slots.get(key)
        if value:
            known_parts.append(f"{label}: {value}")

    known_slots_summary = (
        ", ".join(known_parts) if known_parts else "todavía no tenemos información del prospecto"
    )

    if not market_context:
        market_context = "Ubicación no definida aún — solicita ciudad/zona antes de mencionar precios específicos."

    # Wrap inventory blocks with context headers if they have content
    inv_block = (
        inventory_properties
        if inventory_properties
        else "(Sin propiedades en inventario para esta búsqueda — usa el contexto de mercado)"
    )
    alt_block = (
        inventory_alternative
        if inventory_alternative
        else "(Sin alternativa de inventario disponible)"
    )
    cta_block = (
        cta_instruction
        if cta_instruction
        else "Cierra con la pregunta prioritaria del punto 'Próximo dato a preguntar'."
    )

    return SYSTEM_PROMPT_TEMPLATE.format(
        known_slots_summary=known_slots_summary,
        market_context=market_context,
        inventory_properties=inv_block,
        inventory_alternative=alt_block,
        cta_instruction=cta_block,
        next_slot_question=next_slot_question,
        response_instruction=response_instruction,
        conversation_history=conversation_history,
        history_turns=history_turns,
    )
