"""
generate_response node — generates a natural, conversational reply.
Uses llama-3.3-70b-versatile for higher quality responses.
"""

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from ..state import AgentState
from ...config import settings
from ...prompts.system_prompt import build_system_prompt
from .slot_check import get_next_slot_question

_responder_llm = ChatGroq(
    model=settings.responder_model,
    temperature=settings.responder_temperature,
    max_tokens=250,
    api_key=settings.groq_api_key,
)


def generate_response(state: AgentState) -> dict:
    """Generate a natural response based on state and conversation history."""
    messages = state.get("messages", [])
    slots = state.get("slots", {})
    lead_status = state.get("lead_status", "new")

    # Build conversation history string (last 8 turns)
    history_lines = []
    history_msgs = []
    for msg in messages[-16:]:
        if isinstance(msg, HumanMessage):
            history_lines.append(f"Prospecto: {msg.content}")
            history_msgs.append(HumanMessage(content=msg.content))
        elif isinstance(msg, AIMessage):
            history_lines.append(f"Valentina: {msg.content}")
            history_msgs.append(AIMessage(content=msg.content))

    conversation_history = "\n".join(history_lines[:-1]) if len(history_lines) > 1 else "(inicio)"

    # Determine next slot to ask
    next_slot, next_question = get_next_slot_question(dict(slots))

    next_slot_question = (
        f"La siguiente pregunta prioritaria es sobre '{next_slot}': {next_question}"
        if next_slot
        else "Ya tienes suficiente información — orienta hacia agendar o cerrar."
    )

    if lead_status == "hot":
        response_instruction = "El lead tiene alta intención. Muéstrate entusiasmada y propón el siguiente paso concreto."
    else:
        response_instruction = "Responde naturalmente y haz la siguiente pregunta prioritaria de forma conversacional."

    # Build system prompt with known slots context
    system_content = build_system_prompt(
        known_slots=dict(slots),
        next_slot_question=next_slot_question,
        response_instruction=response_instruction,
        conversation_history=conversation_history,
        history_turns=min(8, len(history_lines)),
    )

    # Build messages for LLM (only the last HumanMessage as the current turn)
    llm_messages = [SystemMessage(content=system_content)] + history_msgs

    try:
        response = _responder_llm.invoke(llm_messages)
        response_text = str(response.content).strip()

        return {
            "messages": [AIMessage(content=response_text)],
        }

    except Exception:
        fallback_text = (
            "Disculpa, tuve un problema técnico. ¿Me puedes repetir lo que necesitas?"
        )
        return {
            "messages": [AIMessage(content=fallback_text)],
        }
