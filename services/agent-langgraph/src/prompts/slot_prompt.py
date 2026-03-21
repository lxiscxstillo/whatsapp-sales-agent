"""
Prompt for slot extraction using llama-3.1-8b-instant with structured output.
"""

from pydantic import BaseModel, Field
from typing import Optional


class SlotExtraction(BaseModel):
    """Structured output for slot extraction from a single message."""
    name: Optional[str] = Field(None, description="Prospect's name if mentioned")
    city: Optional[str] = Field(None, description="City or main area of interest")
    zone: Optional[str] = Field(None, description="Specific neighborhood or zone within the city")
    property_type: Optional[str] = Field(
        None,
        description="Type of property: 'casa', 'apartamento', 'lote', 'oficina', 'local', 'otro'"
    )
    budget: Optional[str] = Field(None, description="Budget in free text as stated by the user")
    budget_numeric: Optional[int] = Field(
        None,
        description="Budget normalized to Colombian pesos (COP). Examples: '300 millones' -> 300000000, '1.5M' -> 1500000000. Use minimum if range given."
    )
    intent: Optional[str] = Field(
        None,
        description="Purchase intent: 'comprar' or 'arrendar'. Only set if explicitly stated."
    )
    bedrooms: Optional[str] = Field(None, description="Number of bedrooms or description")
    urgency: Optional[str] = Field(None, description="Timeline or urgency as stated by user")
    main_need: Optional[str] = Field(None, description="Main identified need or priority")
    new_objection: Optional[str] = Field(None, description="New objection detected in this message, if any")
    contradicts_slot: Optional[str] = Field(
        None,
        description="Name of slot that this message contradicts (e.g., 'city' if user changes city)"
    )
    preferred_neighborhood: Optional[str] = Field(
        None,
        description=(
            "Specific barrio or neighborhood explicitly named by the lead — "
            "e.g., 'Palermo', 'Maridíaz', 'El Poblado', 'Chicó'. "
            "Extract ONLY if the lead explicitly names a neighborhood, not just a city. "
            "Pasto examples: 'busco en Palermo', 'me gusta Maridíaz', 'algo en El Prado'. "
            "Bogotá examples: 'en Chicó', 'sector Cedritos'. "
            "Leave null if only a city is mentioned without a specific barrio."
        )
    )


SLOT_SYSTEM_PROMPT = """Eres un extractor de información para una aplicación inmobiliaria colombiana.

Tu tarea es extraer datos estructurados de un mensaje de WhatsApp de un prospecto inmobiliario.

Reglas:
1. Solo extrae información EXPLÍCITAMENTE mencionada en el mensaje actual.
2. Si el dato no está en el mensaje, devuelve null para ese campo.
3. Para budget_numeric: convierte el presupuesto a pesos colombianos enteros.
   - "300 millones" = 300000000
   - "300M" = 300000000
   - "1.5 billones" = 1500000000
   - Si dan un rango, usa el mínimo.
4. Para property_type usa solo: "casa", "apartamento", "lote", "oficina", "local", "otro"
5. Para intent usa solo: "comprar" o "arrendar" — no inferir si no está claro.
6. Si el usuario corrige información previa (ej: "mejor en Bogotá" cuando antes dijo Medellín),
   marca contradicts_slot con el nombre del campo corregido.
7. Para preferred_neighborhood: extrae SOLO si el usuario nombra un barrio específico (no solo la ciudad).
   - Pasto: Palermo, Maridíaz, Tamasagra, Anganoy, El Prado, San Ignacio, Avenida Panamericana
   - Bogotá: Chicó, Cedritos, Rosales, Usaquén, Chapinero
   - Medellín: El Poblado, Laureles, Envigado, Belén
   - Cali: Pance, Ciudad Jardín, El Ingenio, Granada

Contexto ya conocido (NO extraer de nuevo si el usuario no lo modifica):
{known_slots_context}

Responde con el JSON exacto del schema."""


SLOT_USER_TEMPLATE = """Mensaje del prospecto: "{message}"

Extrae los datos disponibles."""
