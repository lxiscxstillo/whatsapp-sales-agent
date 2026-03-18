"""
LangGraph agent graph — complete conversation orchestration.
Nodes: receive_message → detect_intent → [slot_check | fallback | handoff]
       → evaluate_lead → [handoff | generate_response] → END
"""

from typing import Literal

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from .state import AgentState
from .nodes import (
    receive_message,
    detect_intent,
    slot_check,
    evaluate_lead,
    generate_response,
    handoff,
    fallback,
)


# ─── Routing functions ────────────────────────────────────────────────────────

def route_after_intent(state: AgentState) -> Literal["slot_check", "fallback", "handoff"]:
    """Route after intent detection."""
    last_intent = state.get("last_intent", "AMBIGUOUS")
    lead_status = state.get("lead_status", "new")

    # No automatic responses to leads already in handoff
    if lead_status == "handoff":
        return "handoff"

    # Explicit handoff request
    if last_intent == "HANDOFF_REQUEST":
        return "handoff"

    # Ambiguous or off-topic → fallback handler
    if last_intent in ("AMBIGUOUS", "OFF_TOPIC"):
        return "fallback"

    # All other intents → extract slots
    return "slot_check"


def route_after_fallback(state: AgentState) -> Literal["handoff", END]:
    """Route after fallback node."""
    fallback_action = state.get("fallback_action", "")

    if fallback_action == "ESCALATE_HANDOFF":
        return "handoff"

    # OFF_TOPIC_REDIRECT and ASK_CLARIFICATION → message already set, end
    return END


def route_after_evaluate(state: AgentState) -> Literal["handoff", "generate_response"]:
    """Route after lead evaluation."""
    needs_handoff = state.get("needs_handoff", False)

    if needs_handoff:
        return "handoff"

    return "generate_response"


# ─── Graph builder ────────────────────────────────────────────────────────────

def build_graph(checkpointer: AsyncPostgresSaver) -> StateGraph:
    """Build and compile the conversation graph with the given checkpointer."""
    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("receive_message", receive_message)
    graph.add_node("detect_intent", detect_intent)
    graph.add_node("slot_check", slot_check)
    graph.add_node("evaluate_lead", evaluate_lead)
    graph.add_node("generate_response", generate_response)
    graph.add_node("handoff", handoff)
    graph.add_node("fallback", fallback)

    # Entry point
    graph.set_entry_point("receive_message")

    # Edges
    graph.add_edge("receive_message", "detect_intent")

    graph.add_conditional_edges(
        "detect_intent",
        route_after_intent,
        {
            "slot_check": "slot_check",
            "fallback": "fallback",
            "handoff": "handoff",
        },
    )

    graph.add_conditional_edges(
        "fallback",
        route_after_fallback,
        {
            "handoff": "handoff",
            END: END,
        },
    )

    graph.add_edge("slot_check", "evaluate_lead")

    graph.add_conditional_edges(
        "evaluate_lead",
        route_after_evaluate,
        {
            "handoff": "handoff",
            "generate_response": "generate_response",
        },
    )

    graph.add_edge("generate_response", END)
    graph.add_edge("handoff", END)

    return graph.compile(checkpointer=checkpointer)
