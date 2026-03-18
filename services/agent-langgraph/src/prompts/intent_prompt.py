"""
Prompt for intent classification using llama-3.1-8b-instant.
Returns structured JSON with intent and confidence.
"""

from pydantic import BaseModel, Field
from typing import Literal


class IntentClassification(BaseModel):
    """Structured output for intent classification."""
    intent: Literal[
        "GREETING",
        "PROPERTY_INQUIRY",
        "SLOT_INFO",
        "OBJECTION",
        "HIGH_INTEREST",
        "HANDOFF_REQUEST",
        "AMBIGUOUS",
        "OFF_TOPIC",
    ] = Field(description="Classified intent of the message")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0.0 to 1.0")
    reasoning: str = Field(description="Brief reasoning for the classification")


INTENT_SYSTEM_PROMPT = """Eres un clasificador de intención para una aplicación de ventas inmobiliarias colombiana.

Clasifica el mensaje del usuario en UNA de estas categorías:

- GREETING: Saludo inicial o mensaje de cortesía sin info específica ("hola", "buenos días", "como estás")
- PROPERTY_INQUIRY: Pregunta sobre un inmueble, zona, precio o disponibilidad
- SLOT_INFO: El usuario proporciona datos sobre lo que busca (tipo, ciudad, presupuesto, etc.)
- OBJECTION: Expresa duda, limitación de tiempo o presupuesto ("está muy caro", "no tengo tiempo", "lo pienso")
- HIGH_INTEREST: Señales claras de querer avanzar ("quiero visitarlo", "cuándo puedo ver", "tengo preaprobación")
- HANDOFF_REQUEST: Pide hablar con una persona explícitamente ("quiero hablar con alguien", "me comunicas con un asesor")
- AMBIGUOUS: Mensaje poco claro, inentendible, o que no puedes clasificar con certeza
- OFF_TOPIC: Tema completamente fuera del contexto inmobiliario (clima, política, otros temas)

Responde con el JSON exacto según el schema.

Ejemplos few-shot:
- "hola buenas" → GREETING (0.99)
- "busco apartamento de 3 habitaciones" → SLOT_INFO (0.95)
- "en medellín preferiblemente el poblado" → SLOT_INFO (0.93)
- "cuánto vale ese" → PROPERTY_INQUIRY (0.88)
- "está muy caro para mi presupuesto" → OBJECTION (0.91)
- "quiero ir a verlo esta semana" → HIGH_INTEREST (0.96)
- "me puede comunicar con alguien del equipo" → HANDOFF_REQUEST (0.97)
- "sí bueno lo que le comenté antes" → AMBIGUOUS (0.72)
- "qué opinas del partido de ayer" → OFF_TOPIC (0.99)"""


INTENT_USER_TEMPLATE = """Últimos mensajes de la conversación:
{recent_history}

Mensaje actual del usuario: "{message}"

Clasifica la intención."""
