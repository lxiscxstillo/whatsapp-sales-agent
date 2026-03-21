"""
FastAPI app for the LangGraph agent.
Endpoint: POST /agent/process
Uses AsyncPostgresSaver for conversation state persistence.
thread_id = sender phone number (natural conversation isolation).
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from .config import settings
from .graph import build_graph
from .tools.inventory_service import InventoryService

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

async def _init_graph_with_retry(max_attempts: int = 5, base_delay: float = 3.0):
    """Connect to Postgres and compile the graph, retrying on transient failures."""
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg_pool import AsyncConnectionPool

    database_url = settings.database_url
    pg_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    for attempt in range(1, max_attempts + 1):
        try:
            pool = AsyncConnectionPool(
                conninfo=pg_url,
                max_size=10,
                max_idle=300,          # recycle idle connections after 5 min
                reconnect_timeout=30,
                open=False,
                kwargs={
                    "autocommit": True,
                    "prepare_threshold": 0,
                    # TCP keepalive — detect dead connections before using them
                    "keepalives": 1,
                    "keepalives_idle": 30,
                    "keepalives_interval": 10,
                    "keepalives_count": 5,
                },
            )
            await pool.open()
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()
            graph = build_graph(checkpointer)
            logger.info("LangGraph compiled with AsyncPostgresSaver (attempt %d)", attempt)
            return pool, graph
        except Exception as exc:
            delay = base_delay * (2 ** (attempt - 1))
            if attempt == max_attempts:
                logger.error("Failed to initialise graph after %d attempts: %s", max_attempts, exc)
                raise
            logger.warning(
                "Graph init failed (attempt %d/%d): %s — retrying in %.0fs",
                attempt, max_attempts, exc, delay,
            )
            await asyncio.sleep(delay)


async def _keepalive_loop(pool):
    """Ping Neon every 4 minutes to prevent scale-to-zero disconnection."""
    while True:
        await asyncio.sleep(240)
        try:
            async with pool.connection() as conn:
                await conn.execute("SELECT 1")
        except Exception as exc:
            logger.warning("Keepalive ping failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize AsyncPostgresSaver, compile the LangGraph, and load the property inventory.

    Sales Closer Engine v2:
        InventoryService is loaded from data/inventory_colombia.json (relative to the
        repository root — four levels up from this file). If the file is missing or
        malformed, InventoryService gracefully initializes with an empty property list
        and logs a WARNING. The agent remains fully functional, falling back to the
        real_estate_kb.py market-level knowledge base.

        The inventory is attached to app.state and passed to each graph invocation via
        config["configurable"]["inventory"] so nodes remain stateless and testable.
    """
    global _compiled_graph

    # ── Load property inventory (Sales Closer Engine v2) ─────────────────────
    # Path: /app/src/main.py → /app/src/ → /app/ (workdir) → data/
    # In Docker, WORKDIR is /app and data/ is copied to /app/data/ via "COPY data ./data"
    inventory_path = Path(__file__).parent.parent / "data" / "inventory_colombia.json"
    app.state.inventory = InventoryService(inventory_path)
    logger.info(
        "inventory.startup_status",
        extra={"total_properties": len(app.state.inventory._properties)},
    )

    pool, _compiled_graph = await _init_graph_with_retry()
    keepalive_task = asyncio.create_task(_keepalive_loop(pool))
    try:
        yield
    finally:
        keepalive_task.cancel()
        await pool.close()
        logger.info("Agent shutting down")


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="WhatsApp Sales Agent",
    version="1.0.0",
    lifespan=lifespan,
)


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    if _compiled_graph is None:
        raise HTTPException(status_code=503, detail="Graph not ready")
    return {"status": "ok", "graph_ready": True}


@app.post("/agent/process", response_model=ProcessResponse)
async def process_message(req: ProcessRequest):
    """
    Process an incoming WhatsApp message through the LangGraph agent.
    Returns the agent's response plus updated lead state.

    ISO 25010 — Functional Correctness:
    - thread_id = req.phone: LangGraph checkpoint key for conversation isolation.
      Each unique phone number gets its own independent conversation thread stored
      in PostgreSQL via AsyncPostgresSaver. Consistent across all invocations.
    - lead_id = req.lead_id: PostgreSQL row identifier injected into initial_state
      on every call. The backend (webhook.route.ts) uses its own lead.id for DB
      updates — it does not read lead_id from this response. The agent carries it
      in state for potential future use by nodes that need the DB reference.
    """
    if _compiled_graph is None:
        raise HTTPException(status_code=503, detail="Graph not initialized")

    thread_id = req.phone
    # Pass InventoryService via configurable so generate_response node can query it
    # without holding global state. This keeps nodes stateless and independently testable.
    # app.state.inventory is set during lifespan startup; getattr with None fallback
    # ensures backward compatibility if InventoryService failed to initialize.
    inventory_service = getattr(app.state, "inventory", None)
    config = {
        "configurable": {
            "thread_id": thread_id,
            "inventory": inventory_service,
        },
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

    # Build updated_slots dict — includes Sales Closer Engine v2 fields
    # (preferred_neighborhood, urgency_level) so backend-api can persist them.
    result_slots = dict(result.get("slots", req.slots) or req.slots)

    return ProcessResponse(
        response=response_text,
        updated_slots=result_slots,
        interest_level=result.get("interest_level", req.interest_level),
        trigger_handoff=result.get("needs_handoff", False),
        handoff_reason=result.get("handoff_reason"),
        is_fallback=result.get("is_fallback", False),
        fallback_action=result.get("fallback_action"),
        ambiguity_counter=result.get("ambiguity_counter", req.ambiguity_counter),
        langsmith_run_id=langsmith_run_id,
    )
