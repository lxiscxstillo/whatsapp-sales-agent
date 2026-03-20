"""
Agent configuration loaded from environment variables.

Uses pydantic-settings for type-safe env loading. Required variables are
validated at startup with clear, operator-friendly error messages so that
misconfigured deployments fail fast with actionable guidance instead of
cryptic runtime errors.

Required variables:
    GROQ_API_KEY      — API key from https://console.groq.com → API Keys
    DATABASE_URL      — PostgreSQL connection string (postgresql://user:pass@host/db)

Optional variables (have defaults):
    LANGCHAIN_API_KEY, LANGCHAIN_TRACING_V2, LANGSMITH_PROJECT,
    classifier_model, responder_model, etc.
"""

import sys

from pydantic import ValidationError
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str
    langchain_api_key: str = ""
    langchain_tracing_v2: str = "false"
    langsmith_project: str = "whatsapp-sales-agent"
    database_url: str

    # Model configuration
    classifier_model: str = "llama-3.1-8b-instant"
    responder_model: str = "llama-3.3-70b-versatile"
    classifier_temperature: float = 0.0
    responder_temperature: float = 0.7
    max_response_tokens: int = 200
    history_turns: int = 8

    class Config:
        env_file = ".env"
        case_sensitive = False


# Variable-specific guidance for operators.
_REQUIRED_VARS_HELP: dict[str, str] = {
    "groq_api_key": (
        "GROQ_API_KEY — API key de Groq. "
        "Obtener en: https://console.groq.com → API Keys"
    ),
    "database_url": (
        "DATABASE_URL — Cadena de conexión PostgreSQL. "
        "Formato: postgresql://usuario:contraseña@host:5432/nombre_db"
    ),
}


def _load_settings() -> Settings:
    """
    Load and validate settings, exiting with clear error messages on failure.

    Returns:
        Validated Settings instance.

    Side effects:
        Prints operator-friendly error messages and calls sys.exit(1) if
        required environment variables are missing or malformed.
    """
    try:
        return Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        print("❌ Error de configuración — faltan variables de entorno requeridas:\n", flush=True)
        for error in exc.errors():
            field = str(error.get("loc", ("",))[0]).lower()
            guidance = _REQUIRED_VARS_HELP.get(field)
            if guidance:
                print(f"  • {guidance}", flush=True)
            else:
                print(f"  • {field.upper()}: {error.get('msg', 'valor inválido')}", flush=True)
        print(
            "\nVerifica tu archivo .env o las variables de entorno del contenedor.",
            flush=True,
        )
        sys.exit(1)


settings = _load_settings()
