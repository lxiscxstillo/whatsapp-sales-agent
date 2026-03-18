"""
detect_intent node — classifies the intent of the latest message.
Uses llama-3.1-8b-instant for fast structured classification.
"""

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from ..state import AgentState
from ...config import settings
from ...prompts.intent_prompt import (
    IntentClassification,
    INTENT_SYSTEM_PROMPT,
    INTENT_USER_TEMPLATE,
)

_classifier_llm = ChatGroq(
    model=settings.classifier_model,
    temperature=settings.classifier_temperature,
    api_key=settings.groq_api_key,
).with_structured_output(IntentClassification)


def detect_intent(state: AgentState) -> dict:
    """Classify the intent of the latest user message."""
    messages = state.get("messages", [])
    if not messages:
        return {"last_intent": "AMBIGUOUS", "last_confidence": 0.0}

    # Get latest user message
    latest_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            latest_message = str(msg.content)
            break

    # Build recent history context (last 5 turns)
    history_lines = []
    for msg in messages[-10:]:
        role = "Prospecto" if isinstance(msg, HumanMessage) else "Asesor"
        history_lines.append(f"{role}: {msg.content}")
    recent_history = "\n".join(history_lines[:-1]) if len(history_lines) > 1 else "(inicio de conversación)"

    user_content = INTENT_USER_TEMPLATE.format(
        recent_history=recent_history,
        message=latest_message,
    )

    try:
        result: IntentClassification = _classifier_llm.invoke([
            SystemMessage(content=INTENT_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ])

        # Force AMBIGUOUS if confidence is too low
        intent = result.intent
        confidence = result.confidence
        if confidence < 0.6:
            intent = "AMBIGUOUS"

        return {
            "last_intent": intent,
            "last_confidence": confidence,
        }

    except Exception as e:
        # On LLM error, treat as ambiguous rather than crashing
        return {
            "last_intent": "AMBIGUOUS",
            "last_confidence": 0.0,
        }
