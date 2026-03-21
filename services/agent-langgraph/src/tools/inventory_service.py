"""
inventory_service.py — Mock-RAG in-process property inventory lookup.

Commercial rationale:
    Provides hyper-local property data (barrio level) for Pasto, Bogotá,
    Medellín, and Cali. The agent injects matching properties into the LLM
    system prompt so it can reference specific IDs, prices, and unique selling
    arguments instead of generating generic real estate platitudes.

    The "Mock-RAG" pattern is used instead of a vector database because:
    1. The inventory fits in memory (~50 records) — no semantic search needed.
    2. Zero network latency — query completes in microseconds vs. ~100ms for
       an external embedding API call.
    3. Graceful degradation: if the JSON file is missing or malformed, the
       service returns an empty result and the agent falls back to the existing
       real_estate_kb.py market-level knowledge. The conversation never breaks.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger("agent.inventory")

# ---------------------------------------------------------------------------
# Zone adjacency map — used for objection handling ("está muy caro").
# When a lead objects to price in zone X, query adjacent zones and surface
# a cheaper alternative. Adjacency is hardcoded to prevent the LLM from
# hallucinating that distant zones are "close" — critical for building trust
# with Pasto buyers who know their city's geography intimately.
# ---------------------------------------------------------------------------
ADJACENT_ZONES: dict[str, list[str]] = {
    # Pasto (Nariño)
    "Palermo":              ["Maridíaz", "El Prado"],
    "Maridíaz":             ["Palermo", "San Ignacio"],
    "Avenida Panamericana": ["Tamasagra", "Anganoy"],
    "Tamasagra":            ["Avenida Panamericana", "Anganoy"],
    "Anganoy":              ["Tamasagra", "El Prado"],
    "El Prado":             ["Anganoy", "San Ignacio"],
    "San Ignacio":          ["El Prado", "Maridíaz"],
    # Bogotá
    "Chicó":                ["Cedritos", "Rosales"],
    "Cedritos":             ["Chicó", "Santa Bárbara"],
    # Medellín
    "El Poblado":           ["Laureles", "Envigado"],
    "Laureles":             ["El Poblado", "Belén"],
    # Cali
    "Pance":                ["Ciudad Jardín", "El Ingenio"],
}


@dataclass
class PropertyRecord:
    """
    A single property from the inventory JSON.

    Commercial rationale:
        Each record carries a unique_selling_argument — a one-sentence commercial
        pitch written in Colombian professional real estate tone. This is injected
        directly into the LLM prompt so the agent quotes it verbatim, projecting
        hyper-local expertise rather than generic market commentary.
    """
    id: str
    type: str                       # "Casa" | "Apartamento" | "Lote" | "Oficina"
    city: str
    zone: str
    price_cop: int
    price_display: str              # "280 millones COP"
    area_m2: int
    bedrooms: Optional[int]
    bathrooms: Optional[int]
    amenities: list[str]
    unique_selling_argument: str
    stratum: Optional[int]          # Colombian estrato 1–6
    status: str                     # "Disponible" | "Reservado" | "En Negociación"
    contact_advisor: str


@dataclass
class InventoryQueryResult:
    """
    Return value of InventoryService.query().

    Commercial rationale:
        Separating primary results from alternatives enables the prompt builder
        to present them in different conversational contexts:
        - properties → shown proactively when lead mentions a zone/budget
        - alternatives → shown reactively when lead objects to price
        The query_succeeded flag lets the node decide whether to use inventory
        data or fall back to real_estate_kb.py market-level knowledge.
    """
    properties: list[PropertyRecord] = field(default_factory=list)
    alternatives: list[PropertyRecord] = field(default_factory=list)
    query_succeeded: bool = True
    total_matches: int = 0


class InventoryService:
    """
    In-process property inventory loader and query engine.

    Commercial rationale:
        Loads data/inventory_colombia.json once at FastAPI startup and holds
        all records in RAM. At ~50 records the full dataset is ~15 KB — well
        within acceptable memory usage for a Fly.io micro-VM. query() runs in
        microseconds and never makes network calls, keeping agent latency dominated
        by the LLM call rather than data retrieval.

    Fallback contract:
        If the JSON file is missing, unreadable, or malformed, self._properties
        is set to [] and a WARNING (not ERROR) is logged. query() will always
        return InventoryQueryResult(query_succeeded=False) in this case, and
        callers must handle this by omitting the {inventory_properties} block
        from the system prompt. This satisfies ISO 25010 Reliability (Fault Tolerance).
    """

    def __init__(self, json_path: Path) -> None:
        """
        Initialize by loading the inventory JSON.

        Commercial rationale:
            Loading at startup (not per-request) ensures zero per-query I/O.
            The json_path is resolved relative to the repo root so the same
            file is shared across services if needed in future (e.g., admin panel).

        Args:
            json_path: Absolute path to inventory_colombia.json.
        """
        self._properties: list[PropertyRecord] = self._load(json_path)
        logger.info(
            "inventory.loaded",
            extra={"total": len(self._properties)},
        )

    def _load(self, path: Path) -> list[PropertyRecord]:
        """
        Parse the JSON file into PropertyRecord dataclasses.

        Commercial rationale:
            Any I/O or parse error is caught here — never propagated. The
            agent must stay available even if the inventory file is temporarily
            inaccessible (e.g., during a Fly.io volume remount). Logging at
            WARNING allows ops to detect the issue without paging on-call.

        Returns:
            List of PropertyRecord objects, or [] on any failure.
        """
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            records = []
            for item in raw.get("properties", []):
                records.append(PropertyRecord(
                    id=item["id"],
                    type=item["type"],
                    city=item["city"],
                    zone=item["zone"],
                    price_cop=int(item["price_cop"]),
                    price_display=item["price_display"],
                    area_m2=int(item["area_m2"]),
                    bedrooms=item.get("bedrooms"),
                    bathrooms=item.get("bathrooms"),
                    amenities=item.get("amenities", []),
                    unique_selling_argument=item.get("unique_selling_argument", ""),
                    stratum=item.get("stratum"),
                    status=item.get("status", "Disponible"),
                    contact_advisor=item.get("contact_advisor", ""),
                ))
            return records
        except Exception as exc:
            logger.warning(
                "inventory.load_failed",
                extra={"path": str(path), "error": str(exc)},
            )
            return []

    def query(
        self,
        *,
        city: Optional[str] = None,
        zone: Optional[str] = None,
        budget_max: Optional[int] = None,
        property_type: Optional[str] = None,
        limit: int = 3,
        include_alternatives: bool = False,
    ) -> InventoryQueryResult:
        """
        Filter the in-memory inventory and return the best-matching properties.

        Commercial rationale:
            Results are sorted by price_cop ASC so the agent always leads with
            the most accessible option — reducing sticker shock and maintaining
            lead engagement before moving up-market. The `limit` default of 3
            prevents the system prompt from being overwhelmed with property data,
            which would dilute the conversational tone.

        Args:
            city: Case-insensitive city match. None = all cities.
            zone: Case-insensitive partial zone match. None = all zones.
            budget_max: Maximum price in COP. Properties above this are excluded.
                None = no upper limit.
            property_type: "Casa" | "Apartamento" | "Lote" | "Oficina". None = all.
            limit: Maximum primary results to return. Clamped to [1, 10].
            include_alternatives: If True, also queries adjacent zones for
                objection-handling alternatives (properties ≤ budget_max * 0.95
                in neighboring zones). Used when last_intent == OBJECTION.

        Returns:
            InventoryQueryResult. Never raises — returns query_succeeded=False
            if the inventory failed to load at startup.
        """
        if not self._properties:
            return InventoryQueryResult(query_succeeded=False)

        limit = max(1, min(limit, 10))

        # --- Primary filter ---
        filtered = self._filter(
            city=city,
            zone=zone,
            budget_max=budget_max,
            property_type=property_type,
        )
        sorted_props = sorted(filtered, key=lambda p: p.price_cop)
        primary = sorted_props[:limit]

        # --- Alternative properties for objection handling ---
        alternatives: list[PropertyRecord] = []
        if include_alternatives and zone:
            alt_budget = int(budget_max * 0.95) if budget_max else None
            adjacent = ADJACENT_ZONES.get(zone, [])
            for adj_zone in adjacent:
                adj_props = self._filter(
                    city=city,
                    zone=adj_zone,
                    budget_max=alt_budget,
                    property_type=property_type,
                )
                alternatives.extend(adj_props)
                if alternatives:
                    break  # stop after first adjacent zone that has results
            # Sort alternatives by price ASC and cap at 2
            alternatives = sorted(alternatives, key=lambda p: p.price_cop)[:2]

        return InventoryQueryResult(
            properties=primary,
            alternatives=alternatives,
            query_succeeded=True,
            total_matches=len(filtered),
        )

    def _filter(
        self,
        city: Optional[str],
        zone: Optional[str],
        budget_max: Optional[int],
        property_type: Optional[str],
    ) -> list[PropertyRecord]:
        """
        Apply all active filters to self._properties.

        Matching is case-insensitive. All filters are AND conditions.
        Properties with status != "Disponible" are excluded.
        """
        results = []
        city_lower = city.lower().strip() if city else None
        zone_lower = zone.lower().strip() if zone else None
        type_lower = property_type.lower().strip() if property_type else None

        for prop in self._properties:
            if prop.status != "Disponible":
                continue
            if city_lower and city_lower not in prop.city.lower():
                continue
            if zone_lower and zone_lower not in prop.zone.lower():
                continue
            if budget_max and prop.price_cop > budget_max:
                continue
            if type_lower and type_lower not in prop.type.lower():
                continue
            results.append(prop)
        return results


def format_inventory_for_prompt(properties: list[PropertyRecord]) -> str:
    """
    Format a list of PropertyRecord objects into a compact prompt block.

    Commercial rationale:
        The format uses bullet points with the property ID first so the LLM
        can naturally reference it in conversation ("el apartamento PST-001 en
        Palermo"). The ✨ marker draws the LLM's attention to the unique_selling_argument
        — the one phrase it should quote verbatim to project hyper-local expertise.

    Args:
        properties: List of PropertyRecord objects to format. Empty list → "".

    Returns:
        Formatted string ready for injection into {inventory_properties} or
        {inventory_alternative} template variables.
    """
    if not properties:
        return ""

    lines = []
    for prop in properties:
        rooms_info = ""
        if prop.bedrooms is not None and prop.bathrooms is not None:
            rooms_info = f" | {prop.bedrooms} hab/{prop.bathrooms} baños"
        elif prop.bedrooms is not None:
            rooms_info = f" | {prop.bedrooms} hab"

        amenities_str = ", ".join(prop.amenities[:3])  # max 3 amenities to keep prompt concise
        lines.append(
            f"• [{prop.id}] {prop.type} en {prop.zone} — {prop.price_display}"
            f" | {prop.area_m2}m²{rooms_info}\n"
            f"  Amenidades: {amenities_str}\n"
            f"  ✨ Argumento: {prop.unique_selling_argument}"
        )
    return "\n\n".join(lines)
