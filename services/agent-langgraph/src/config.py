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


settings = Settings()  # type: ignore[call-arg]
