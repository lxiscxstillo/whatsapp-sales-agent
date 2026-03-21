# Contract: InventoryService.query()

**Service**: agent-langgraph (Python)
**Module**: `services/agent-langgraph/src/tools/inventory_service.py`
**Consumer**: `generate_response` node, `evaluate_lead` node
**Purpose**: Retrieve matching property records from the in-memory inventory for injection into LLM system prompts and objection-handling logic.

---

## Method Signature

```python
def query(
    self,
    *,
    city: str | None = None,
    zone: str | None = None,
    budget_max: int | None = None,
    property_type: str | None = None,
    limit: int = 3,
    include_alternatives: bool = False,
) -> InventoryQueryResult:
    """
    Query the in-memory property inventory.

    Commercial rationale: Returns the most affordable matching properties first
    (price ASC) so the agent always leads with the most accessible option,
    maintaining lead engagement before upselling.

    Args:
        city: Filter by city name (case-insensitive). None = all cities.
        zone: Filter by neighborhood/barrio (case-insensitive). None = all zones.
        budget_max: Maximum price in COP. None = no upper limit.
        property_type: "Casa" | "Apartamento" | "Lote" | "Oficina". None = all.
        limit: Maximum number of primary results to return (default 3).
        include_alternatives: If True, also returns adjacent-zone properties
            for objection handling (price 10–30% below budget_max).

    Returns:
        InventoryQueryResult with properties, alternatives, query_succeeded flag.
    """
```

---

## Input Validation

| Parameter | Validation | On Failure |
|-----------|-----------|------------|
| `city` | Case-insensitive match against known cities | Returns empty list (not error) |
| `zone` | Case-insensitive partial match against `zone` field | Returns empty list |
| `budget_max` | Must be positive int if provided | Ignored if ≤ 0 |
| `property_type` | Must be in `["Casa", "Apartamento", "Lote", "Oficina"]` | Ignored if invalid |
| `limit` | Clamped to 1–10 | Never raises |

---

## Response: `InventoryQueryResult`

```python
@dataclass
class InventoryQueryResult:
    properties: list[PropertyRecord]   # Primary matches, sorted price ASC, max `limit`
    alternatives: list[PropertyRecord] # Adjacent-zone matches (only if include_alternatives=True)
    query_succeeded: bool              # False only if JSON never loaded (fallback mode)
    total_matches: int                 # Total properties matching filters (before limit)
```

---

## Fallback Behavior

When `query_succeeded = False` (JSON load failed at startup):
- `properties = []`
- `alternatives = []`
- Calling code MUST check `query_succeeded` and fall back to `real_estate_kb.py`

When `properties = []` (no matches, but service is healthy):
- `query_succeeded = True`
- `total_matches = 0`
- Calling code SHOULD inject a "no properties in zone" message and pivot to adjacent zone

---

## Usage in `generate_response.py`

```python
# Example: called before building system prompt
result = app.state.inventory.query(
    city=slots.get("city"),
    zone=slots.get("preferred_neighborhood") or slots.get("zone"),
    budget_max=slots.get("budget_numeric"),
    property_type=slots.get("property_type"),
    limit=3,
    include_alternatives=(last_intent == "OBJECTION"),
)

if result.query_succeeded and result.properties:
    inventory_block = _format_inventory_for_prompt(result.properties)
    alternative_block = _format_inventory_for_prompt(result.alternatives) if result.alternatives else ""
else:
    inventory_block = ""  # Agent falls back to general market knowledge
    alternative_block = ""
```

---

## `_format_inventory_for_prompt()` Output Format

```
PROPIEDADES DISPONIBLES EN INVENTARIO:
• [PST-001] Apartamento en Palermo — 280 millones COP | 72m² | 3 hab/2 baños
  Amenidades: Vista al Volcán Galeras, Cerca a Unicentro Pasto, Parqueadero cubierto
  ✨ Argumento: Sector de alta valorización con vista privilegiada al Galeras...

• [PST-007] Casa en El Prado — 380 millones COP | 130m² | 4 hab/3 baños
  Amenidades: Sector residencial exclusivo, Club house, Piscina comunitaria
  ✨ Argumento: El Prado es el sector de mayor status en Pasto...
```

---

## Initialization

```python
# In services/agent-langgraph/src/main.py lifespan
from tools.inventory_service import InventoryService
from pathlib import Path

@asynccontextmanager
async def lifespan(app: FastAPI):
    inventory_path = Path(__file__).parent.parent.parent.parent / "data" / "inventory_colombia.json"
    app.state.inventory = InventoryService(inventory_path)
    # InventoryService logs a warning (not error) if file not found — never crashes startup
    yield
```

---

## Error Contract

`InventoryService` NEVER raises exceptions in `query()`. All errors are:
1. Logged at WARNING level with structured fields: `event`, `error`, `path`
2. Reflected in `query_succeeded = False`
3. Transparent to LangGraph — agent continues normally

This satisfies ISO 25010 **Reliability (Fault Tolerance)** requirement.
