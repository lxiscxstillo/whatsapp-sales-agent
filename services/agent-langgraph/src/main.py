"""
FastAPI app for the LangGraph agent.
Endpoint: POST /agent/process
Uses AsyncPostgresSaver for conversation state persistence.
thread_id = sender phone number (natural conversation isolation).
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional, Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from .config import settings
from .graph import build_graph

logger = logging.getLogger("agent")
logging.basicConfig(level=logging.INFO)

# Global graph instance (initialized on startup)
_compiled_graph = None


# ─── Request / Response schemas ──────────────────────────────────────────────

class ProcessRequest(BaseModel):
    phone: str
    message: str
    lead_id: str
    lead_status: str = "new"
    slots: dict = {}
    ambiguity_counter: int = 0
    interest_level: int = 1


class SlotUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    zone: Optional[str] = None
    property_type: Optional[str] = None
    budget: Optional[str] = None
    budget_numeric: Optional[int] = None
    intent: Optional[str] = None
    bedrooms: Optional[str] = None
    urgency: Optional[str] = None
    main_need: Optional[str] = None
    objections: Optional[list] = None


class ProcessResponse(BaseModel):
    response: str
    updated_slots: dict
    interest_level: int
    trigger_handoff: bool
    handoff_reason: Optional[str]
    is_fallback: bool
    fallback_action: Optional[str]
    ambiguity_counter: int
    langsmith_run_id: Optional[str]


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize AsyncPostgresSaver and compile the graph on startup."""
    global _compiled_graph

    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    import psycopg

    database_url = settings.database_url
    # LangGraph checkpoint requires standard postgresql:// scheme
    pg_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    async with await psycopg.AsyncConnection.connect(pg_url, autocommit=True) as conn:
        checkpointer = AsyncPostgresSaver(conn)
        await checkpointer.setup()
        _compiled_graph = build_graph(checkpointer)
        logger.info("LangGraph compiled with AsyncPostgresSaver")
        yield

    logger.info("Agent shutting down")


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="WhatsApp Sales Agent",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "graph_ready": _compiled_graph is not None}


@app.post("/agent/process", response_model=ProcessResponse)
async def process_message(req: ProcessRequest):
    """
    Process an incoming WhatsApp message through the LangGraph agent.
    Returns the agent's response plus updated lead state.
    """
    if _compiled_graph is None:
        raise HTTPException(status_code=503, detail="Graph not initialized")

    thread_id = req.phone
    config = {
        "configurable": {"thread_id": thread_id},
    }

    # Initial state override for this invocation
    initial_state = {
        "messages": [HumanMessage(content=req.message)],
        "slots": req.slots,
        "lead_status": req.lead_status,
        "lead_id": req.lead_id,
        "ambiguity_counter": req.ambiguity_counter,
        "interest_level": req.interest_level,
        "needs_handoff": False,
        "is_fallback": False,
        "fallback_action": None,
        "handoff_reason": None,
    }

    try:
        result = await _compiled_graph.ainvoke(initial_state, config=config)
    except Exception as e:
        logger.error(f"Graph invocation error for {thread_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    # Extract the last AI message as the response text
    from langchain_core.messages import AIMessage
    response_text = ""
    for msg in reversed(result.get("messages", [])):
        if isinstance(msg, AIMessage):
            response_text = str(msg.content)
            break

    # Extract LangSmith run ID from config metadata if available
    langsmith_run_id = None
    try:
        run_metadata = config.get("metadata", {})
        langsmith_run_id = run_metadata.get("run_id")
    except Exception:
        pass

    return ProcessResponse(
        response=response_text,
        updated_slots=result.get("slots", req.slots),
        interest_level=result.get("interest_level", req.interest_level),
        trigger_handoff=result.get("needs_handoff", False),
        handoff_reason=result.get("handoff_reason"),
        is_fallback=result.get("is_fallback", False),
        fallback_action=result.get("fallback_action"),
        ambiguity_counter=result.get("ambiguity_counter", req.ambiguity_counter),
        langsmith_run_id=langsmith_run_id,
    )
