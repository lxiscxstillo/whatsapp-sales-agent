"""
Base de conocimiento del mercado inmobiliario colombiano.
Sin embeddings ni infraestructura adicional — retrieval por coincidencia de slots.

Precios en millones de COP (2024-2025).
Arriendos en miles/millones de COP mensuales.
"""

from __future__ import annotations
from typing import Optional


# ─── Estructura de datos ──────────────────────────────────────────────────────

KNOWLEDGE_BASE: list[dict] = [

    # ══════════════════════════════════════════════════════════════════════════
    # BOGOTÁ
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "bogotá", "city_display": "Bogotá",
        "zone": "chapinero", "zone_display": "Chapinero",
        "strato": "3-5",
        "buy_apt": "280M–500M", "rent_apt": "1.5M–2.8M/mes",
        "buy_house": "600M–1.3B", "rent_house": "3M–5M/mes",
        "demand": "muy alta",
        "profile": "jóvenes profesionales, universitarios, bohemios",
        "highlights": [
            "zona universitaria (Los Andes, Externado, Rosario)",
            "vida nocturna y gastronómica activa",
            "excelente movilidad — TransMilenio y ciclovías",
            "barrios como Chapinero Alto, La Macarena, Quinta Camacho",
            "alta valorización en los últimos 5 años",
        ],
        "cons": ["tráfico en horas pico", "algunos sectores con seguridad variable"],
        "ideal_for": ["compra de inversión", "arriendo de larga duración", "primera vivienda profesionales"],
        "property_types": ["apartamento", "casa", "oficina"],
    },
    {
        "city": "bogotá", "city_display": "Bogotá",
        "zone": "usaquén", "zone_display": "Usaquén",
        "strato": "5-6",
        "buy_apt": "420M–900M", "rent_apt": "2.5M–4.5M/mes",
        "buy_house": "1.2B–3B", "rent_house": "5M–10M/mes",
        "demand": "alta",
        "profile": "familias clase alta, ejecutivos, extranjeros",
        "highlights": [
            "zona premium del norte de Bogotá",
            "centros comerciales Hacienda Santa Bárbara, Unicentro",
            "barrios como Santa Bárbara, La Calleja, Cedritos",
            "alta seguridad y calidad urbanística",
            "gran oferta de colegios bilingües y exclusivos",
        ],
        "cons": ["precios de los más altos en Bogotá", "lejos del centro financiero"],
        "ideal_for": ["familias con hijos en colegios privados", "ejecutivos senior", "inversión premium"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "bogotá", "city_display": "Bogotá",
        "zone": "rosales", "zone_display": "El Rosales / Chicó",
        "strato": "6",
        "buy_apt": "700M–1.5B", "rent_apt": "3.5M–7M/mes",
        "buy_house": "2B–5B", "rent_house": "8M–20M/mes",
        "demand": "media-alta",
        "profile": "élite bogotana, diplomáticos, empresarios",
        "highlights": [
            "barrio más exclusivo de Bogotá",
            "embajadas, clubes privados, restaurantes de lujo",
            "arquitectura premium y zonas verdes",
            "Parque de la 93 a pocos minutos",
            "muy baja densidad — tranquilidad total",
        ],
        "cons": ["los precios más altos de Colombia", "poca oferta disponible"],
        "ideal_for": ["compra de lujo", "inversión de alta gama"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "bogotá", "city_display": "Bogotá",
        "zone": "suba", "zone_display": "Suba",
        "strato": "2-4",
        "buy_apt": "180M–340M", "rent_apt": "900K–1.8M/mes",
        "buy_house": "280M–500M", "rent_house": "1.5M–2.5M/mes",
        "demand": "muy alta",
        "profile": "familias clase media, primera vivienda",
        "highlights": [
            "una de las localidades más grandes de Bogotá",
            "gran oferta de proyectos nuevos VIS y No-VIS",
            "múltiples centros comerciales (Subazar, Bulevar, Palatino)",
            "amplia oferta de colegios públicos y privados",
            "buena conectividad por Portal Suba (TransMilenio)",
        ],
        "cons": ["alta densidad poblacional", "tráfico intenso"],
        "ideal_for": ["primera vivienda", "inversión para arriendo popular"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "bogotá", "city_display": "Bogotá",
        "zone": "kennedy", "zone_display": "Kennedy",
        "strato": "2-3",
        "buy_apt": "160M–280M", "rent_apt": "800K–1.4M/mes",
        "buy_house": "220M–400M", "rent_house": "1.2M–2M/mes",
        "demand": "muy alta",
        "profile": "clase trabajadora, familias numerosas",
        "highlights": [
            "segunda localidad más poblada de Bogotá",
            "amplia oferta comercial y de servicios",
            "cerca de la Autopista Sur — buena movilidad",
            "proyectos VIS con subsidio disponibles",
        ],
        "cons": ["seguridad variable en algunos sectores", "alta congestión"],
        "ideal_for": ["VIS", "primer vivienda presupuesto ajustado"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "bogotá", "city_display": "Bogotá",
        "zone": "teusaquillo", "zone_display": "Teusaquillo / La Soledad",
        "strato": "4",
        "buy_apt": "280M–480M", "rent_apt": "1.4M–2.4M/mes",
        "buy_house": "500M–900M", "rent_house": "2.5M–4.5M/mes",
        "demand": "alta",
        "profile": "profesionales, familias consolidadas",
        "highlights": [
            "zona central con excelente movilidad",
            "cerca de la Calle 26 y el Aeropuerto El Dorado",
            "barrios consolidados con arboleda",
            "buena valorización histórica",
        ],
        "cons": ["oferta limitada de proyectos nuevos"],
        "ideal_for": ["vivir cerca del trabajo en zona central", "inversión estable"],
        "property_types": ["apartamento", "casa", "oficina"],
    },
    {
        "city": "bogotá", "city_display": "Bogotá",
        "zone": "fontibón", "zone_display": "Fontibón / Aeropuerto",
        "strato": "3-4",
        "buy_apt": "200M–360M", "rent_apt": "1M–1.8M/mes",
        "buy_house": "300M–550M", "rent_house": "1.5M–2.5M/mes",
        "demand": "alta",
        "profile": "ejecutivos que viajan, familias jóvenes",
        "highlights": [
            "a 5 minutos del Aeropuerto El Dorado",
            "zona franca y hub empresarial cercano",
            "buena oferta gastronómica en zona de Tintal",
            "precios más asequibles que el norte",
        ],
        "cons": ["ruido de aviones en algunos sectores"],
        "ideal_for": ["ejecutivos frecuentes viajeros", "arriendo empresarial"],
        "property_types": ["apartamento", "oficina", "local"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # MEDELLÍN
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "medellín", "city_display": "Medellín",
        "zone": "el poblado", "zone_display": "El Poblado",
        "strato": "5-6",
        "buy_apt": "420M–950M", "rent_apt": "2.2M–5.5M/mes",
        "buy_house": "1.2B–3.5B", "rent_house": "6M–18M/mes",
        "demand": "muy alta",
        "profile": "extranjeros, nómadas digitales, ejecutivos, clase alta",
        "highlights": [
            "zona más premium y deseada de Medellín",
            "Parque El Poblado, Parque Lleras — vida nocturna y gastronómica",
            "altísima demanda de nómadas digitales y extranjeros",
            "mejor oferta de restaurantes y cafés de Colombia",
            "valorización constante — excelente inversión",
            "cerca de clínicas de alto nivel (Clínica El Rosario, Cardio VID)",
        ],
        "cons": ["precio más alto de Antioquia", "tráfico intenso en fines de semana"],
        "ideal_for": ["inversión para Airbnb/alquiler turístico", "residencia premium", "extranjeros"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "medellín", "city_display": "Medellín",
        "zone": "laureles", "zone_display": "Laureles / Estadio",
        "strato": "4-5",
        "buy_apt": "280M–530M", "rent_apt": "1.5M–2.9M/mes",
        "buy_house": "600M–1.4B", "rent_house": "3M–6M/mes",
        "demand": "alta",
        "profile": "familias clase media-alta, profesionales, estudiantes universitarios",
        "highlights": [
            "uno de los barrios más queridos por paisas",
            "circular comercial con excelente oferta gastronómica",
            "El Estadio Atanasio Girardot a pocos metros",
            "Universidades (U de Medellín, CES) cerca",
            "tranquilo, familiar, con parques y zonas verdes",
            "muy buena movilidad — Metro cercano",
        ],
        "cons": ["precios subiendo rápido por demanda", "ruido los días de partido"],
        "ideal_for": ["primera vivienda clase media-alta", "familias jóvenes", "arriendo universitario"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "medellín", "city_display": "Medellín",
        "zone": "envigado", "zone_display": "Envigado",
        "strato": "4-5",
        "buy_apt": "260M–470M", "rent_apt": "1.3M–2.5M/mes",
        "buy_house": "500M–1.1B", "rent_house": "2.5M–5M/mes",
        "demand": "muy alta",
        "profile": "familias, profesionales que huyen del ruido de Medellín",
        "highlights": [
            "municipio más seguro del Área Metropolitana",
            "excelente calidad de vida — parques, colegios, servicios",
            "Parque El Salado y zonas recreativas",
            "conectado al Metro de Medellín",
            "precios más bajos que El Poblado con calidad similar",
            "alta valorización en los últimos años",
        ],
        "cons": ["algo alejado del centro empresarial de Medellín"],
        "ideal_for": ["familias con niños", "calidad de vida", "inversión residencial"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "medellín", "city_display": "Medellín",
        "zone": "sabaneta", "zone_display": "Sabaneta",
        "strato": "3-5",
        "buy_apt": "210M–400M", "rent_apt": "1.1M–2.1M/mes",
        "buy_house": "380M–750M", "rent_house": "2M–4M/mes",
        "demand": "alta",
        "profile": "familias jóvenes, profesionales, compradores de primera vivienda",
        "highlights": [
            "municipio de altísimo crecimiento inmobiliario",
            "Parroquia María Auxiliadora — punto de referencia cultural",
            "muchos proyectos nuevos en entrega",
            "excelente relación precio-calidad",
            "conectado por Metro al resto del Área Metropolitana",
        ],
        "cons": ["en proceso de desarrollo urbanístico — algunas zonas en construcción"],
        "ideal_for": ["primera vivienda", "inversión a mediano plazo"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "medellín", "city_display": "Medellín",
        "zone": "bello", "zone_display": "Bello",
        "strato": "2-3",
        "buy_apt": "120M–220M", "rent_apt": "700K–1.3M/mes",
        "buy_house": "200M–380M", "rent_house": "1M–2M/mes",
        "demand": "alta",
        "profile": "clase trabajadora, compradores VIS",
        "highlights": [
            "mayor municipio del norte del Área Metropolitana",
            "amplia oferta de proyectos VIS y VIP",
            "Terminal del Norte cercana",
            "Metro del Norte en operación",
        ],
        "cons": ["percepción de seguridad en algunas zonas", "menos servicios premium"],
        "ideal_for": ["VIS", "primer vivienda con subsidio"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "medellín", "city_display": "Medellín",
        "zone": "itagüí", "zone_display": "Itagüí",
        "strato": "3-4",
        "buy_apt": "160M–290M", "rent_apt": "850K–1.5M/mes",
        "buy_house": "280M–500M", "rent_house": "1.4M–2.5M/mes",
        "demand": "media-alta",
        "profile": "trabajadores industriales, familias clase media",
        "highlights": [
            "importante polo industrial del sur de Medellín",
            "Centro Comercial Mayorca — referente comercial",
            "buena oferta de vivienda nueva a precios competitivos",
            "conectado al Área Metropolitana por Metro del Sur",
        ],
        "cons": ["zona industrial puede generar ruido y tráfico pesado"],
        "ideal_for": ["primera vivienda", "inversión para arriendo popular"],
        "property_types": ["apartamento", "casa", "local"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # CALI
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "cali", "city_display": "Cali",
        "zone": "ciudad jardín", "zone_display": "Ciudad Jardín",
        "strato": "5-6",
        "buy_apt": "380M–800M", "rent_apt": "2M–4.5M/mes",
        "buy_house": "800M–2.5B", "rent_house": "4.5M–12M/mes",
        "demand": "alta",
        "profile": "familias clase alta, ejecutivos, extranjeros",
        "highlights": [
            "zona más exclusiva de Cali — sur residencial",
            "excelente arborización y calidad urbanística",
            "cerca de la Universidad Javeriana Cali",
            "amplia oferta de colegios privados bilingües",
            "bajo índice de criminalidad para Cali",
        ],
        "cons": ["los precios más altos de Cali", "alejado del centro"],
        "ideal_for": ["residencia familiar premium", "inversión alta gama"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "cali", "city_display": "Cali",
        "zone": "granada", "zone_display": "Barrio Granada",
        "strato": "4-5",
        "buy_apt": "300M–550M", "rent_apt": "1.6M–3M/mes",
        "buy_house": "700M–1.5B", "rent_house": "3.5M–7M/mes",
        "demand": "alta",
        "profile": "jóvenes profesionales, amantes de la gastronomía",
        "highlights": [
            "zona gastronómica y cultural más famosa de Cali",
            "restaurantes, bares, vida nocturna de primer nivel",
            "arquitectura republicana conservada",
            "excelente ubicación central norte",
        ],
        "cons": ["ruido nocturno en fines de semana", "tráfico intenso"],
        "ideal_for": ["arriendo de corta estadía", "Airbnb", "vivir cerca de la acción"],
        "property_types": ["apartamento", "casa", "local"],
    },
    {
        "city": "cali", "city_display": "Cali",
        "zone": "el peñón", "zone_display": "El Peñón",
        "strato": "5-6",
        "buy_apt": "420M–820M", "rent_apt": "2.2M–4.5M/mes",
        "buy_house": "1B–2.5B", "rent_house": "5M–12M/mes",
        "demand": "media-alta",
        "profile": "clase alta caleña, familias consolidadas",
        "highlights": [
            "barrio exclusivo a orillas del Río Cali",
            "Club Campestre de Cali cercano",
            "tranquilidad y seguridad",
            "casas con jardín y piscina disponibles",
        ],
        "cons": ["poca movilidad sin vehículo propio"],
        "ideal_for": ["residencia familiar de lujo", "inversión premium"],
        "property_types": ["casa", "apartamento"],
    },
    {
        "city": "cali", "city_display": "Cali",
        "zone": "meléndez", "zone_display": "Meléndez / Univalle",
        "strato": "2-3",
        "buy_apt": "140M–240M", "rent_apt": "700K–1.3M/mes",
        "buy_house": "220M–380M", "rent_house": "1M–2M/mes",
        "demand": "alta",
        "profile": "universitarios, familias de clase media-baja",
        "highlights": [
            "zona universitaria (Universidad del Valle)",
            "alta demanda de arriendo estudiantil",
            "precios de los más asequibles de Cali",
            "buena oferta de servicios básicos",
        ],
        "cons": ["seguridad variable", "zona en proceso de mejora urbanística"],
        "ideal_for": ["inversión para arriendo universitario", "primera vivienda presupuesto bajo"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "cali", "city_display": "Cali",
        "zone": "chipichape", "zone_display": "Chipichape / San Fernando",
        "strato": "3-5",
        "buy_apt": "250M–480M", "rent_apt": "1.3M–2.5M/mes",
        "buy_house": "500M–950M", "rent_house": "2.5M–5M/mes",
        "demand": "alta",
        "profile": "familias, profesionales zona norte-central",
        "highlights": [
            "zona central con excelente movilidad",
            "Centro Comercial Chipichape a pasos",
            "barrios consolidados y seguros",
            "buena valorización histórica",
        ],
        "cons": ["menos verde que el sur", "tráfico en horas pico"],
        "ideal_for": ["primera vivienda", "arriendo largo plazo"],
        "property_types": ["apartamento", "casa", "oficina"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # BARRANQUILLA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "barranquilla", "city_display": "Barranquilla",
        "zone": "el golf", "zone_display": "El Golf / Villa Santos",
        "strato": "5-6",
        "buy_apt": "380M–750M", "rent_apt": "2M–3.8M/mes",
        "buy_house": "900M–2B", "rent_house": "4.5M–10M/mes",
        "demand": "alta",
        "profile": "empresarios, ejecutivos, familias clase alta",
        "highlights": [
            "zona premium del norte de Barranquilla",
            "Estadio Metropolitano y Country Club cercanos",
            "excelente oferta gastronómica en la zona",
            "alta seguridad y urbanismo de calidad",
        ],
        "cons": ["calor intenso todo el año", "precios altos para el mercado barranquillero"],
        "ideal_for": ["residencia ejecutiva premium", "inversión"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "barranquilla", "city_display": "Barranquilla",
        "zone": "alto prado", "zone_display": "Alto Prado / Prado",
        "strato": "5-6",
        "buy_apt": "320M–600M", "rent_apt": "1.8M–3.2M/mes",
        "buy_house": "800M–1.8B", "rent_house": "4M–9M/mes",
        "demand": "media-alta",
        "profile": "familias tradicionales barranquilleras, clase alta",
        "highlights": [
            "barrio histórico de la élite barranquillera",
            "El Prado Hotel — ícono arquitectónico",
            "amplias casas con jardín y piscina",
            "casonas coloniales restauradas",
        ],
        "cons": ["infraestructura algo antigua en algunas zonas"],
        "ideal_for": ["casas familiares grandes", "patrimonio arquitectónico"],
        "property_types": ["casa", "apartamento"],
    },
    {
        "city": "barranquilla", "city_display": "Barranquilla",
        "zone": "buenavista", "zone_display": "Buenavista",
        "strato": "4-5",
        "buy_apt": "260M–490M", "rent_apt": "1.4M–2.6M/mes",
        "buy_house": "600M–1.2B", "rent_house": "3M–6M/mes",
        "demand": "alta",
        "profile": "familias clase media-alta, jóvenes profesionales",
        "highlights": [
            "zona de alto crecimiento en el norte",
            "Portal del Prado — centro comercial de referencia",
            "buena oferta de proyectos nuevos",
            "excelente movilidad hacia la Vía 40 y el río",
        ],
        "cons": ["tráfico en horas pico hacia el norte"],
        "ideal_for": ["primera vivienda clase media-alta", "inversión"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "barranquilla", "city_display": "Barranquilla",
        "zone": "riomar", "zone_display": "Riomar / Las Américas",
        "strato": "3-4",
        "buy_apt": "200M–360M", "rent_apt": "1.1M–2M/mes",
        "buy_house": "380M–700M", "rent_house": "2M–3.5M/mes",
        "demand": "alta",
        "profile": "familias clase media, primera vivienda",
        "highlights": [
            "cerca del Río Magdalena — vista al río disponible",
            "zona turística y ferial (Pumarejo, feria)",
            "precios competitivos con buenas características",
            "conectividad hacia el resto de la ciudad",
        ],
        "cons": ["algunos sectores en proceso de mejora"],
        "ideal_for": ["primera vivienda", "inversión para arriendo"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # CARTAGENA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "cartagena", "city_display": "Cartagena",
        "zone": "bocagrande", "zone_display": "Bocagrande",
        "strato": "5-6",
        "buy_apt": "380M–900M", "rent_apt": "2.5M–6M/mes",
        "buy_house": "N/A (zona mayormente de apartamentos)", "rent_house": "N/A",
        "demand": "muy alta",
        "profile": "turistas, inversores, nómadas digitales, familias vacacionistas",
        "highlights": [
            "zona turística prime frente al mar Caribe",
            "altísima demanda de alquiler vacacional (Airbnb)",
            "excelente retorno de inversión — $150K-300K/noche en temporada",
            "restaurantes y vida nocturna de primer nivel",
            "cerca del Centro Histórico declarado Patrimonio Mundial",
        ],
        "cons": ["precio elevado", "alta temporada genera mucho ruido", "algunas torres antiguas con mantenimiento"],
        "ideal_for": ["inversión vacacional/Airbnb", "segunda vivienda de descanso"],
        "property_types": ["apartamento"],
    },
    {
        "city": "cartagena", "city_display": "Cartagena",
        "zone": "el laguito", "zone_display": "El Laguito",
        "strato": "6",
        "buy_apt": "450M–1.1B", "rent_apt": "3M–7M/mes",
        "buy_house": "2B–5B", "rent_house": "10M–25M/mes",
        "demand": "alta",
        "profile": "élite cartagenera, extranjeros, inversores premium",
        "highlights": [
            "frente al mar — vistas espectaculares al Caribe",
            "playa privada para residentes",
            "ultra exclusivo — inventario muy limitado",
            "Hotel Caribe y Club de Pesca como referentes del sector",
        ],
        "cons": ["poca oferta disponible", "precios fuera del alcance de la mayoría"],
        "ideal_for": ["inversión de lujo", "segunda vivienda vacacional premium"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "cartagena", "city_display": "Cartagena",
        "zone": "getsemaní", "zone_display": "Getsemaní",
        "strato": "2-4",
        "buy_apt": "220M–500M", "rent_apt": "1.5M–3.5M/mes",
        "buy_house": "300M–700M", "rent_house": "2M–5M/mes",
        "demand": "alta y en crecimiento",
        "profile": "artistas, turistas, inversores en gentrificación",
        "highlights": [
            "barrio bohemio en plena transformación",
            "arquitectura colonial restaurada — Instagram-worthy",
            "a pasos del Centro Histórico amurallado",
            "alta valorización en proceso de gentrificación",
            "cafés, hostales y galerías de arte",
        ],
        "cons": ["proceso de cambio social — algunos conflictos de vecindad"],
        "ideal_for": ["inversión de transformación", "Airbnb boutique"],
        "property_types": ["casa", "apartamento", "local"],
    },
    {
        "city": "cartagena", "city_display": "Cartagena",
        "zone": "manga", "zone_display": "Manga",
        "strato": "4-5",
        "buy_apt": "260M–490M", "rent_apt": "1.4M–2.8M/mes",
        "buy_house": "600M–1.4B", "rent_house": "3M–7M/mes",
        "demand": "media-alta",
        "profile": "familias locales clase media-alta, residentes permanentes",
        "highlights": [
            "isla conectada con Bocagrande y el Centro",
            "vista al Canal del Dique",
            "zona residencial tranquila sin el caos turístico",
            "Club de Pesca cercano",
        ],
        "cons": ["depende de puentes para movilidad — puede haber cuellos de botella"],
        "ideal_for": ["residencia permanente", "familias que buscan tranquilidad cerca del mar"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # BUCARAMANGA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "bucaramanga", "city_display": "Bucaramanga",
        "zone": "cabecera del llano", "zone_display": "Cabecera del Llano",
        "strato": "4-5",
        "buy_apt": "260M–480M", "rent_apt": "1.3M–2.4M/mes",
        "buy_house": "550M–1.2B", "rent_house": "2.8M–5.5M/mes",
        "demand": "alta",
        "profile": "profesionales, familias clase media-alta bumanguesa",
        "highlights": [
            "zona comercial y residencial más dinámica de Bucaramanga",
            "Parque de Los Niños, Parque La Flora",
            "excelente oferta gastronómica y comercial",
            "muy buena valorización en los últimos 5 años",
        ],
        "cons": ["tráfico en horas pico", "precios subiendo aceleradamente"],
        "ideal_for": ["primera y segunda vivienda clase media-alta", "inversión"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "bucaramanga", "city_display": "Bucaramanga",
        "zone": "lagos del cacique", "zone_display": "Lagos del Cacique",
        "strato": "5-6",
        "buy_apt": "320M–600M", "rent_apt": "1.7M–3M/mes",
        "buy_house": "700M–1.6B", "rent_house": "3.5M–7M/mes",
        "demand": "media-alta",
        "profile": "familias clase alta, ejecutivos",
        "highlights": [
            "zona premium con lagos artificiales como elemento paisajístico",
            "Parque Lagos del Cacique — referente de la zona",
            "alta seguridad y urbanismo planificado",
            "cerca de los principales centros comerciales",
        ],
        "cons": ["inventario limitado"],
        "ideal_for": ["familias que buscan calidad de vida premium"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "bucaramanga", "city_display": "Bucaramanga",
        "zone": "floridablanca", "zone_display": "Floridablanca",
        "strato": "3-4",
        "buy_apt": "180M–320M", "rent_apt": "950K–1.7M/mes",
        "buy_house": "320M–620M", "rent_house": "1.6M–3M/mes",
        "demand": "alta",
        "profile": "familias jóvenes, primera vivienda",
        "highlights": [
            "municipio contiguo a Bucaramanga — prácticamente integrado",
            "clima más fresco que Bucaramanga",
            "alta oferta de proyectos nuevos",
            "Parque Ecológico El Gallineral cercano",
        ],
        "cons": ["movilidad depende de vías compartidas con Bucaramanga"],
        "ideal_for": ["primera vivienda", "familias con presupuesto moderado"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # SANTA MARTA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "santa marta", "city_display": "Santa Marta",
        "zone": "bello horizonte", "zone_display": "Bello Horizonte",
        "strato": "5-6",
        "buy_apt": "300M–650M", "rent_apt": "1.8M–4M/mes",
        "buy_house": "700M–1.8B", "rent_house": "4M–10M/mes",
        "demand": "alta",
        "profile": "inversores, familias vacacionistas, nómadas digitales",
        "highlights": [
            "zona premium norte con playas privadas",
            "urbanizaciones cerradas con seguridad 24/7",
            "altísima demanda de alquiler vacacional",
            "cerca de la Sierra Nevada — paisajes únicos",
        ],
        "cons": ["calor intenso (>28°C todo el año)", "dependencia del turismo"],
        "ideal_for": ["inversión vacacional", "segunda vivienda de playa"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "santa marta", "city_display": "Santa Marta",
        "zone": "rodadero", "zone_display": "El Rodadero",
        "strato": "3-5",
        "buy_apt": "200M–450M", "rent_apt": "1.3M–3.5M/mes",
        "buy_house": "500M–1.2B", "rent_house": "3M–7M/mes",
        "demand": "muy alta en temporada",
        "profile": "turistas, inversores en corta estadía",
        "highlights": [
            "balneario más famoso del Caribe colombiano",
            "alta rentabilidad en alquiler vacacional — hasta 100% ocupación en temporada",
            "infraestructura turística completa",
            "playámbulo, acuario, Parque Isla de la Victoria",
        ],
        "cons": ["saturado en temporada alta", "algunos sectores con infraestructura antigua"],
        "ideal_for": ["Airbnb y alquiler turístico", "segunda vivienda costera"],
        "property_types": ["apartamento"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # PEREIRA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "pereira", "city_display": "Pereira",
        "zone": "pinares", "zone_display": "Pinares",
        "strato": "4-5",
        "buy_apt": "230M–430M", "rent_apt": "1.2M–2.3M/mes",
        "buy_house": "500M–1.1B", "rent_house": "2.5M–5M/mes",
        "demand": "alta",
        "profile": "profesionales, familias clase media-alta, paisas en expansión",
        "highlights": [
            "zona más exclusiva de Pereira",
            "Vista hermosa de la ciudad y el Río Otún",
            "cerca de los principales centros comerciales (Unicentro, Victoria)",
            "clima cafetero agradable todo el año (18-24°C)",
            "hub del Eje Cafetero — aeropuerto internacional a 20 min",
        ],
        "cons": ["tráfico en conexión con el centro", "zona en expansión — algunas obras"],
        "ideal_for": ["primera vivienda premium", "inversión en el Eje Cafetero"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "pereira", "city_display": "Pereira",
        "zone": "cerritos", "zone_display": "Cerritos",
        "strato": "4-6",
        "buy_apt": "N/A", "rent_apt": "N/A",
        "buy_house": "450M–1.5B", "rent_house": "2.5M–7M/mes",
        "demand": "alta",
        "profile": "familias que buscan espacio, fincas recreo, aire puro",
        "highlights": [
            "corredor de fincas y casas campestres entre Pereira y Dosquebradas",
            "cerca del Aeropuerto Internacional Matecaña",
            "terrenos grandes con piscina a precios competitivos",
            "ideal para work from home con conexión a la ciudad",
        ],
        "cons": ["requiere vehículo propio", "distancia al centro puede ser incómoda"],
        "ideal_for": ["fincas de recreo", "casas campestres", "residencia con espacio"],
        "property_types": ["casa", "lote", "finca"],
    },
    {
        "city": "pereira", "city_display": "Pereira",
        "zone": "cuba", "zone_display": "Cuba",
        "strato": "2-3",
        "buy_apt": "130M–230M", "rent_apt": "700K–1.2M/mes",
        "buy_house": "200M–350M", "rent_house": "1M–1.8M/mes",
        "demand": "alta",
        "profile": "clase trabajadora, primera vivienda presupuesto bajo",
        "highlights": [
            "zona popular con todos los servicios",
            "buena oferta de proyectos VIS",
            "conectado con el centro de Pereira",
        ],
        "cons": ["zona densa y popular", "tráfico intenso"],
        "ideal_for": ["VIS", "primera vivienda presupuesto ajustado"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # MANIZALES
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "manizales", "city_display": "Manizales",
        "zone": "chipre", "zone_display": "Chipre",
        "strato": "4-5",
        "buy_apt": "210M–400M", "rent_apt": "1.1M–2.2M/mes",
        "buy_house": "450M–950M", "rent_house": "2.3M–5M/mes",
        "demand": "alta",
        "profile": "familias, profesionales, amantes del paisaje",
        "highlights": [
            "vista panorámica más famosa de Manizales — volcán Nevado del Ruiz",
            "Parque Chipre — paseo obligado de la ciudad",
            "zona de clase media-alta con excelente calidad urbanística",
            "clima de ciudad cafetera (17-22°C)",
        ],
        "cons": ["niebla frecuente en temporadas", "acceso por vías en pendiente"],
        "ideal_for": ["familias que valoran el paisaje", "primera vivienda premium"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "manizales", "city_display": "Manizales",
        "zone": "el cable", "zone_display": "El Cable",
        "strato": "4-5",
        "buy_apt": "230M–420M", "rent_apt": "1.2M–2.3M/mes",
        "buy_house": "480M–1B", "rent_house": "2.5M–5.5M/mes",
        "demand": "media-alta",
        "profile": "ejecutivos, familias consolidadas",
        "highlights": [
            "zona de la antigua estación del cable aéreo — histórica",
            "centro comercial Fundadores y Plaza de Bolívar cerca",
            "excelente conectividad con el resto de la ciudad",
            "proyectos nuevos con amenidades modernas",
        ],
        "cons": ["zona montañosa — acceso en pendiente"],
        "ideal_for": ["residencia con acceso al centro", "inversión estable"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # ARMENIA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "armenia", "city_display": "Armenia",
        "zone": "el bosque", "zone_display": "El Bosque",
        "strato": "3-4",
        "buy_apt": "160M–290M", "rent_apt": "850K–1.6M/mes",
        "buy_house": "300M–580M", "rent_house": "1.5M–3M/mes",
        "demand": "alta",
        "profile": "familias cafeteras, profesionales locales",
        "highlights": [
            "zona residencial más valorizada de Armenia",
            "ciudad capital del Quindío — patrimonio cafetero",
            "cerca del Parque Nacional del Café",
            "clima cafetero ideal (18-24°C) todo el año",
            "precios muy competitivos vs Bogotá y Medellín",
        ],
        "cons": ["ciudad pequeña — oferta laboral limitada vs capitales grandes"],
        "ideal_for": ["segunda vivienda en el Eje Cafetero", "retiro pensional"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # IBAGUÉ
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "ibagué", "city_display": "Ibagué",
        "zone": "la pola", "zone_display": "La Pola / El Vergel",
        "strato": "3-4",
        "buy_apt": "160M–290M", "rent_apt": "850K–1.5M/mes",
        "buy_house": "280M–530M", "rent_house": "1.4M–2.8M/mes",
        "demand": "media-alta",
        "profile": "familias locales, primera vivienda",
        "highlights": [
            "zona residencial más valorizada de Ibagué",
            "capital musical de Colombia",
            "clima cálido (22-28°C)",
            "puerta de entrada a los Llanos Orientales",
            "precios muy asequibles — buena relación valor/m²",
        ],
        "cons": ["mercado inmobiliario menor que las grandes ciudades"],
        "ideal_for": ["primera vivienda a bajo costo", "retiro en ciudad intermedia"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # VILLAVICENCIO
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "villavicencio", "city_display": "Villavicencio",
        "zone": "barzal alto", "zone_display": "Barzal Alto",
        "strato": "4-5",
        "buy_apt": "210M–400M", "rent_apt": "1.1M–2.2M/mes",
        "buy_house": "450M–950M", "rent_house": "2.3M–5M/mes",
        "demand": "alta",
        "profile": "empresarios llaneros, familias, migrantes de Bogotá",
        "highlights": [
            "zona más exclusiva de la ciudad",
            "puerta de entrada a los Llanos Orientales",
            "auge turístico y ganadero — economía en crecimiento",
            "a 2 horas de Bogotá por vía Bogotá-Villavicencio",
            "clima cálido con naturaleza espectacular",
        ],
        "cons": ["vía Bogotá-Villavicencio con frecuentes cierres", "ciudad en desarrollo urbanístico"],
        "ideal_for": ["residencia en ciudad intermedia en crecimiento", "inversión llanera"],
        "property_types": ["apartamento", "casa", "lote"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # CÚCUTA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "cúcuta", "city_display": "Cúcuta",
        "zone": "la riviera", "zone_display": "La Riviera / Caobos",
        "strato": "4-5",
        "buy_apt": "160M–300M", "rent_apt": "850K–1.6M/mes",
        "buy_house": "300M–600M", "rent_house": "1.5M–3M/mes",
        "demand": "media",
        "profile": "familias cucuteñas, comerciantes fronterizos",
        "highlights": [
            "ciudad fronteriza con Venezuela — dinámica comercial única",
            "precios de los más bajos entre capitales de departamento",
            "clima cálido (28-35°C)",
            "en recuperación económica post-crisis venezolana",
        ],
        "cons": ["clima muy caliente", "economía dependiente de la frontera", "inseguridad en algunos sectores"],
        "ideal_for": ["primera vivienda a bajo costo", "comerciantes de la frontera"],
        "property_types": ["apartamento", "casa", "local"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # NEIVA
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "neiva", "city_display": "Neiva",
        "zone": "conjunto campestre", "zone_display": "Zona Norte / Conjuntos",
        "strato": "3-4",
        "buy_apt": "170M–310M", "rent_apt": "900K–1.7M/mes",
        "buy_house": "300M–600M", "rent_house": "1.5M–3M/mes",
        "demand": "media",
        "profile": "familias huilenses, trabajadores del sector petrolero",
        "highlights": [
            "capital del Huila — ciudad en crecimiento",
            "zona agrícola rica (café, cacao, frutas tropicales)",
            "Tatacoa — desterto y astronomía cercanos",
            "sector petrolero genera demanda de arriendo ejecutivo",
        ],
        "cons": ["clima muy caliente (32-38°C)", "mercado inmobiliario pequeño"],
        "ideal_for": ["inversión en arriendos ejecutivos del petróleo", "primera vivienda local"],
        "property_types": ["apartamento", "casa"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # POPAYÁN
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "popayán", "city_display": "Popayán",
        "zone": "centro histórico", "zone_display": "Centro Histórico / La Pamba",
        "strato": "2-4",
        "buy_apt": "140M–260M", "rent_apt": "700K–1.4M/mes",
        "buy_house": "250M–500M", "rent_house": "1.2M–2.5M/mes",
        "demand": "media",
        "profile": "estudiantes universitarios, familias locales, pensionados",
        "highlights": [
            "Ciudad Blanca — arquitectura colonial única en Colombia",
            "Universidad del Cauca — alta demanda estudiantil",
            "Semana Mayor de Popayán — Patrimonio Cultural de la Humanidad",
            "clima fresco agradable (16-20°C)",
            "precios de los más asequibles del país",
        ],
        "cons": ["actividad sísmica — zona de riesgo", "economía más lenta que grandes ciudades"],
        "ideal_for": ["arriendo universitario", "segunda vivienda de patrimonio", "pensionados"],
        "property_types": ["casa", "apartamento"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # EJE CAFETERO - FINCAS Y CASAS CAMPESTRES
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "eje cafetero", "city_display": "Eje Cafetero (Quindío/Risaralda/Caldas)",
        "zone": "finca cafetera", "zone_display": "Fincas Cafeteras",
        "strato": "N/A",
        "buy_apt": "N/A", "rent_apt": "N/A",
        "buy_house": "350M–2.5B (según hectáreas)", "rent_house": "N/A",
        "demand": "muy alta (turismo)",
        "profile": "inversores en turismo rural, parejas, familias, extranjeros",
        "highlights": [
            "Paisaje Cultural Cafetero — Patrimonio de la Humanidad UNESCO",
            "altísima demanda de turismo rural y glamping",
            "fincas con cafetal producen ingresos adicionales",
            "clima ideal 18-24°C todo el año — sin temporada baja real",
            "destino favorito de extranjeros que buscan vida rural",
            "retorno de inversión en hospedaje rural: 15-25% anual",
        ],
        "cons": ["requiere administración activa si es para turismo", "acceso por vías rurales"],
        "ideal_for": ["hospedaje rural/turismo", "retiro de vida tranquila", "inversión en turismo"],
        "property_types": ["finca", "casa", "lote"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # NARIÑO — PASTO Y MUNICIPIOS
    # ══════════════════════════════════════════════════════════════════════════

    # ── San Juan de Pasto ─────────────────────────────────────────────────────
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "lorenzo", "zone_display": "Lorenzo / El Refugio",
        "strato": "4-5",
        "buy_apt": "220M–420M", "rent_apt": "1.1M–2.2M/mes",
        "buy_house": "380M–900M", "rent_house": "2M–4.5M/mes",
        "demand": "alta",
        "profile": "profesionales pastusas, familias clase media-alta, ejecutivos",
        "highlights": [
            "zona más exclusiva y valorizada del norte de Pasto",
            "urbanizaciones cerradas con seguridad privada",
            "cerca del Centro Comercial Unicentro Pasto",
            "excelente oferta de colegios privados (Boston, Champagnat, Pedagógico)",
            "alta valorización — proyectos nuevos con amenidades modernas",
            "vistas al volcán Galeras desde varios conjuntos",
        ],
        "cons": ["precios más altos de Pasto", "tráfico en hora pico hacia el norte"],
        "ideal_for": ["primera y segunda vivienda clase media-alta", "inversión residencial"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "el dorado", "zone_display": "El Dorado / Villa Flor",
        "strato": "3-4",
        "buy_apt": "170M–310M", "rent_apt": "900K–1.7M/mes",
        "buy_house": "280M–560M", "rent_house": "1.5M–3M/mes",
        "demand": "muy alta",
        "profile": "familias jóvenes, profesionales, primera vivienda",
        "highlights": [
            "zona de mayor crecimiento inmobiliario de Pasto",
            "amplia oferta de proyectos nuevos en entrega y preventa",
            "cerca de la Avenida Los Estudiantes y la Universidad Mariana",
            "buena conectividad con el centro de Pasto",
            "relación precio-calidad muy competitiva",
            "múltiples conjuntos residenciales con piscina y zonas comunes",
        ],
        "cons": ["tráfico intenso en la vía principal", "algunas obras de construcción activas"],
        "ideal_for": ["primera vivienda", "familias jóvenes", "inversión para arriendo"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "aranda", "zone_display": "Aranda / La Carolina",
        "strato": "3-4",
        "buy_apt": "160M–290M", "rent_apt": "850K–1.6M/mes",
        "buy_house": "260M–500M", "rent_house": "1.3M–2.8M/mes",
        "demand": "alta",
        "profile": "familias clase media, profesionales sector occidente",
        "highlights": [
            "zona nor-occidental de Pasto en pleno desarrollo",
            "proyectos de vivienda nueva con financiación accesible",
            "cerca de la Institución Universitaria CESMAG y la UDENAR",
            "barrios tranquilos con parques y zonas verdes",
            "precios competitivos para compradores de primera vivienda",
        ],
        "cons": ["algo alejado del centro comercial", "movilidad depende de vías principales"],
        "ideal_for": ["primera vivienda presupuesto moderado", "familias con niños"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "chapalito", "zone_display": "Chapalito / El Bosque",
        "strato": "3-4",
        "buy_apt": "155M–280M", "rent_apt": "800K–1.5M/mes",
        "buy_house": "250M–480M", "rent_house": "1.2M–2.5M/mes",
        "demand": "media-alta",
        "profile": "familias, docentes, empleados públicos",
        "highlights": [
            "barrio residencial consolidado y tranquilo",
            "cerca de la Universidad de Nariño (UDENAR) — campus Torobajo",
            "comunidad pastusa tradicional — ambiente familiar",
            "buena oferta de casas amplias con patio",
            "acceso fácil hacia el sur y el centro de Pasto",
        ],
        "cons": ["oferta de proyectos nuevos limitada", "infraestructura más antigua"],
        "ideal_for": ["familias que buscan casas amplias", "docentes universitarios", "arriendo universitario"],
        "property_types": ["casa", "apartamento"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "mijitayo", "zone_display": "Mijitayo / La Esmeralda",
        "strato": "3-4",
        "buy_apt": "150M–270M", "rent_apt": "780K–1.4M/mes",
        "buy_house": "240M–450M", "rent_house": "1.2M–2.3M/mes",
        "demand": "media-alta",
        "profile": "empleados del sector salud y educación, familias consolidadas",
        "highlights": [
            "zona central-sur con buena infraestructura de servicios",
            "cerca del Hospital Departamental Universitario de Nariño",
            "Clínica Nuestra Señora de Fátima y clínicas privadas cercanas",
            "barrio establecido con comercio local completo",
            "buena valorización histórica por consolidación urbana",
        ],
        "cons": ["poco espacio para expansión de nuevos proyectos"],
        "ideal_for": ["profesionales del sector salud", "familias consolidadas"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "venecia", "zone_display": "Venecia / San Martín",
        "strato": "2-3",
        "buy_apt": "130M–230M", "rent_apt": "680K–1.2M/mes",
        "buy_house": "200M–370M", "rent_house": "1M–2M/mes",
        "demand": "alta",
        "profile": "clase trabajadora, primera vivienda presupuesto ajustado, estudiantes",
        "highlights": [
            "zona popular con todos los servicios básicos completos",
            "amplia oferta de vivienda VIS y VIP en el sector",
            "alta demanda de arriendo por cercanía a la UDENAR",
            "transporte público frecuente hacia el centro",
            "mercado mayorista Potrerillo cercano",
        ],
        "cons": ["densidad alta", "algunos sectores con seguridad variable"],
        "ideal_for": ["VIS", "primera vivienda presupuesto bajo", "arriendo estudiantil"],
        "property_types": ["apartamento", "casa"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "centro histórico", "zone_display": "Centro Histórico / Corazón de Jesús",
        "strato": "2-3",
        "buy_apt": "120M–220M", "rent_apt": "650K–1.3M/mes",
        "buy_house": "180M–400M", "rent_house": "1M–2.5M/mes",
        "demand": "media",
        "profile": "comerciantes, arrendatarios de locales, inversionistas de patrimonio",
        "highlights": [
            "centro histórico de Pasto — Carnaval de Negros y Blancos (Patrimonio UNESCO)",
            "Catedral de Pasto, Alcaldía, edificios republicanos",
            "alta concentración de comercio y servicios públicos",
            "demanda de locales comerciales muy alta",
            "casas coloniales con potencial de restauración",
        ],
        "cons": ["zona ruidosa y congestionada", "estacionamiento difícil", "no apto para familias con niños"],
        "ideal_for": ["locales comerciales", "inversión en patrimonio", "arrendamiento comercial"],
        "property_types": ["local", "oficina", "casa", "apartamento"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "jamondino", "zone_display": "Jamondino / Obrero",
        "strato": "2-3",
        "buy_apt": "110M–200M", "rent_apt": "580K–1.1M/mes",
        "buy_house": "180M–340M", "rent_house": "900K–1.8M/mes",
        "demand": "media-alta",
        "profile": "trabajadores, familias de clase media-baja, sector sur",
        "highlights": [
            "zona sur con conexión a la vía Pasto-Ipiales",
            "Terminal de Transporte de Pasto cercana",
            "acceso rápido hacia municipios del sur de Nariño",
            "proyectos VIS activos en el sector",
        ],
        "cons": ["zona de uso mixto industrial-residencial", "seguridad variable en algunos sectores"],
        "ideal_for": ["VIS", "trabajadores del sector sur", "primera vivienda presupuesto mínimo"],
        "property_types": ["casa", "apartamento"],
    },
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "torobajo", "zone_display": "Torobajo / San Vicente",
        "strato": "3-4",
        "buy_apt": "145M–260M", "rent_apt": "750K–1.4M/mes",
        "buy_house": "230M–430M", "rent_house": "1.2M–2.3M/mes",
        "demand": "alta",
        "profile": "universitarios, docentes, familias sector UDENAR",
        "highlights": [
            "campus principal de la Universidad de Nariño (UDENAR) en la zona",
            "alta demanda de arriendo universitario todo el año",
            "mercado inmobiliario estable por la presencia universitaria",
            "zona verde — Campus UDENAR con bosques y zonas de estudio",
            "restaurantes, papelerías y comercio estudiantil",
        ],
        "cons": ["congestión en épocas de inicio de semestre universitario"],
        "ideal_for": ["arriendo universitario", "inversión inmobiliaria estable", "docentes"],
        "property_types": ["apartamento", "casa"],
    },
    # Contexto general de Pasto
    {
        "city": "pasto", "city_display": "San Juan de Pasto",
        "zone": "general", "zone_display": "Pasto — Mercado General",
        "strato": "N/A",
        "buy_apt": "110M–420M", "rent_apt": "650K–2.2M/mes",
        "buy_house": "180M–900M", "rent_house": "1M–4.5M/mes",
        "demand": "activa y creciente",
        "profile": "todos los perfiles",
        "highlights": [
            "capital del departamento de Nariño — 450.000 habitantes aprox.",
            "clima frio andino agradable: 14-18°C todo el año — sin estaciones extremas",
            "ciudad universitaria: UDENAR, Mariana, CESMAG, IU CESMAG, Cooperativa",
            "fuerte identidad cultural: Carnaval de Negros y Blancos — Patrimonio UNESCO",
            "ciudad en crecimiento — nuevas vías, expansión norte hacia Lorenzo y El Dorado",
            "costo de vida muy por debajo de Bogotá y Medellín — ideal para pensionados y nómadas",
            "mercado de arriendos activo por alta población universitaria y de servidores públicos",
            "valorización anual histórica: 6-10% en zonas de mayor demanda",
            "próximo al Ecuador — comercio fronterizo dinámico vía Ipiales",
        ],
        "cons": [
            "menor oferta laboral vs Bogotá/Medellín — dependencia del empleo público",
            "vías de acceso nacionales con riesgo de cierres por volcán Galeras o derrumbes",
            "mercado inmobiliario formal menos desarrollado que grandes capitales",
        ],
        "ideal_for": ["primera vivienda", "inversión para arriendo universitario", "pensionados", "nómadas digitales"],
        "property_types": ["todos"],
    },

    # ── Ipiales ───────────────────────────────────────────────────────────────
    {
        "city": "ipiales", "city_display": "Ipiales",
        "zone": "centro", "zone_display": "Centro / La Victoria",
        "strato": "2-4",
        "buy_apt": "100M–220M", "rent_apt": "550K–1.2M/mes",
        "buy_house": "160M–380M", "rent_house": "900K–2M/mes",
        "demand": "alta",
        "profile": "comerciantes fronterizos, familias locales, importadores",
        "highlights": [
            "ciudad fronteriza con Ecuador — Puente Internacional Rumichaca",
            "Santuario de Las Lajas — maravilla arquitectónica y destino turístico mundial",
            "dinámica comercial única por el paso fronterizo — zona franca informal",
            "mercado de importaciones y exportaciones muy activo",
            "precios de los más bajos de Colombia en compra de vivienda",
            "a solo 1 hora de Pasto por vía panamericana",
        ],
        "cons": ["dependencia del comercio fronterizo — sensible a regulaciones", "clima muy frío (8-14°C)"],
        "ideal_for": ["comerciantes fronterizos", "primera vivienda muy asequible", "locales comerciales"],
        "property_types": ["local", "casa", "apartamento"],
    },

    # ── Tumaco ────────────────────────────────────────────────────────────────
    {
        "city": "tumaco", "city_display": "Tumaco",
        "zone": "isla tumaco", "zone_display": "Isla Tumaco / El Morro",
        "strato": "1-3",
        "buy_apt": "80M–180M", "rent_apt": "450K–1M/mes",
        "buy_house": "120M–320M", "rent_house": "700K–1.8M/mes",
        "demand": "media",
        "profile": "familias locales, pescadores, inversores en zona costera pacífica",
        "highlights": [
            "principal puerto del Pacífico colombiano — Nariño",
            "playas del Pacífico sur — turismo en crecimiento",
            "zona de inversión pública en infraestructura (vía Pasto-Tumaco mejorada)",
            "alto potencial turístico inexplotado en playas y manglares",
            "actividad pesquera y palmicultora — economía diversa",
        ],
        "cons": [
            "contexto de seguridad complejo — zona de conflicto activo",
            "infraestructura urbana en desarrollo",
            "clima húmedo tropical — lluvia casi todo el año",
        ],
        "ideal_for": ["inversión a largo plazo con perfil de riesgo alto", "residencia de nativos del Pacífico"],
        "property_types": ["casa", "lote"],
    },

    # ── La Unión ──────────────────────────────────────────────────────────────
    {
        "city": "la unión", "city_display": "La Unión (Nariño)",
        "zone": "centro", "zone_display": "Centro / Zona Residencial",
        "strato": "2-3",
        "buy_apt": "90M–180M", "rent_apt": "480K–1M/mes",
        "buy_house": "140M–300M", "rent_house": "750K–1.6M/mes",
        "demand": "media-alta",
        "profile": "familias campesinas, comerciantes, agricultores de la región",
        "highlights": [
            "capital del Valle del Patía nariñense — importante centro agrícola",
            "conocida por la producción de mora, lulo y papa criolla",
            "mercado regional muy activo los días de plaza",
            "clima templado agradable: 16-22°C",
            "precios de vivienda muy asequibles",
            "a 2.5 horas de Pasto por vía Las Acacias",
        ],
        "cons": ["ciudad pequeña con oferta laboral limitada", "vía de acceso con curvas y riesgo de derrumbes"],
        "ideal_for": ["primera vivienda para familias del sector", "fincas de producción agrícola"],
        "property_types": ["casa", "lote", "finca"],
    },

    # ── Túquerres ─────────────────────────────────────────────────────────────
    {
        "city": "túquerres", "city_display": "Túquerres",
        "zone": "centro", "zone_display": "Centro / Zona Urbana",
        "strato": "2-3",
        "buy_apt": "80M–160M", "rent_apt": "420K–900K/mes",
        "buy_house": "130M–270M", "rent_house": "650K–1.4M/mes",
        "demand": "media",
        "profile": "familias indígenas y campesinas, docentes, empleados públicos",
        "highlights": [
            "municipio en la meseta de Los Pastos — 3.100 m.s.n.m.",
            "Laguna de La Cocha — uno de los humedales más importantes de Colombia, a 40 min",
            "fuerte identidad indígena Pasto — comunidades Los Pastos",
            "mercado artesanal y agropecuario activo",
            "clima muy frío: 8-12°C — ideal para quien ama el frío andino",
            "precios de vivienda entre los más económicos del departamento",
        ],
        "cons": ["ciudad pequeña", "clima muy frío", "conectividad limitada"],
        "ideal_for": ["primera vivienda muy asequible", "personas de la región que regresan"],
        "property_types": ["casa", "lote"],
    },

    # ── Samaniego ─────────────────────────────────────────────────────────────
    {
        "city": "samaniego", "city_display": "Samaniego",
        "zone": "centro", "zone_display": "Centro / Barrios Residenciales",
        "strato": "1-3",
        "buy_apt": "70M–150M", "rent_apt": "380K–850K/mes",
        "buy_house": "110M–240M", "rent_house": "600K–1.3M/mes",
        "demand": "media",
        "profile": "familias locales, agricultores del piedemonte",
        "highlights": [
            "municipio cafetero y cacaotero — producción agrícola diversa",
            "clima templado: 18-24°C — agradable y húmedo",
            "zona de alto potencial agroturístico",
            "cerca de la reserva natural La Planada",
        ],
        "cons": ["zona históricamente afectada por conflicto armado — mejoría progresiva", "infraestructura vial en desarrollo"],
        "ideal_for": ["fincas productivas", "residencia en municipio en recuperación"],
        "property_types": ["casa", "finca", "lote"],
    },

    # ── Contexto general Nariño ───────────────────────────────────────────────
    {
        "city": "nariño", "city_display": "Departamento de Nariño",
        "zone": "general", "zone_display": "Nariño — Contexto Departamental",
        "strato": "N/A",
        "buy_apt": "70M–420M (según municipio)", "rent_apt": "380K–2.2M/mes",
        "buy_house": "110M–900M", "rent_house": "600K–4.5M/mes",
        "demand": "activa en zonas urbanas",
        "profile": "todos los perfiles",
        "highlights": [
            "departamento fronterizo con Ecuador — posición geopolítica estratégica",
            "gran diversidad climática: frío andino (Pasto, Túquerres), templado (La Unión), tropical (Tumaco)",
            "capital cultural: Carnaval de Negros y Blancos de Pasto — Patrimonio UNESCO",
            "economía: ganadería, papa, café, cacao, flores, palma africana y comercio fronterizo",
            "Pasto es la ciudad principal — mercado inmobiliario más desarrollado",
            "mercado de arriendos impulsado por universidades y sector público",
            "San Juan de Pasto tiene 9 instituciones de educación superior — alta demanda estudiantil",
            "costo de vida muy por debajo del promedio nacional — calidad de vida alta",
            "nueva vía Pasto-Popayán en doble calzada — mejora conectividad con el interior del país",
            "Aeropuerto Antonio Nariño en Chachagüí — vuelos a Bogotá, Cali, Medellín",
        ],
        "cons": [
            "acceso terrestre con dificultades por geografía montañosa y riesgo de derrumbes",
            "mercado inmobiliario formal más pequeño que las grandes ciudades",
            "algunos municipios con contexto de seguridad complejo",
        ],
        "ideal_for": ["primera vivienda de bajo costo", "inversión para arriendo universitario", "fincas y tierras productivas", "pensionados"],
        "property_types": ["todos"],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # TENDENCIAS DE MERCADO GENERAL
    # ══════════════════════════════════════════════════════════════════════════
    {
        "city": "colombia", "city_display": "Colombia (mercado general)",
        "zone": "general", "zone_display": "Tendencias nacionales",
        "strato": "N/A",
        "buy_apt": "variable", "rent_apt": "variable",
        "buy_house": "variable", "rent_house": "variable",
        "demand": "activa con ajuste de tasas",
        "profile": "todo tipo de comprador",
        "highlights": [
            "tasas de crédito hipotecario en Colombia: entre 12%-16% efectivo anual (2024-2025)",
            "subsidio Mi Casa Ya disponible para VIS (hasta 135 SMMLV ~$168M COP)",
            "VIS = Vivienda de Interés Social — hasta 135 SMMLV",
            "VIP = Vivienda de Interés Prioritario — hasta 70 SMMLV (~$87M COP)",
            "valorización promedio de inmuebles en Colombia: 6-12% anual según ciudad",
            "ciudades con mayor valorización 2024: Medellín, Bogotá norte, Pereira, Barranquilla norte",
            "arriendos han subido 8-15% en 2024 por alta demanda y menor oferta",
            "fiducias en preventas: se puede comprar sobre planos con cuotas durante construcción",
        ],
        "cons": [
            "tasas de interés relativamente altas — crédito hipotecario costoso",
            "proceso de compra puede tardar 2-4 meses en escritura y registro",
        ],
        "ideal_for": ["todo tipo de comprador e inversor"],
        "property_types": ["todos"],
    },
]


# ─── Función de retrieval ─────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase + strip accents básico para comparación."""
    replacements = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
        "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "ñ": "n", "Ñ": "N",
    }
    result = text.lower()
    for src, dst in replacements.items():
        result = result.replace(src, dst)
    return result


# Alias de ciudades y departamentos para resolver variantes coloquiales
_CITY_ALIASES: dict[str, list[str]] = {
    "pasto": ["san juan de pasto", "san juan", "pastusa", "pasto narino", "pasto nariño"],
    "nariño": ["narino", "departamento de nariño", "dpto nariño", "dpto narino"],
    "bogotá": ["bogota", "bta", "la capital", "distrito", "dc"],
    "medellín": ["medellin", "medallo", "la ciudad de la eterna primavera", "antioquia"],
    "cali": ["cali colombia", "sultana del valle", "valle"],
    "barranquilla": ["barranquilla colombia", "la arenosa", "barranquillera", "atlantico"],
    "cartagena": ["cartagena de indias", "la heroica", "bolivar"],
    "bucaramanga": ["bucaramanga colombia", "la ciudad bonita", "santander"],
    "santa marta": ["santamarta", "la perla de america", "magdalena"],
    "pereira": ["pereira colombia", "la querendona", "risaralda"],
    "manizales": ["manizales colombia", "la ciudad de las puertas abiertas", "caldas"],
    "armenia": ["armenia colombia", "quindio", "quindío"],
    "ipiales": ["ipiales narino", "ipiales nariño"],
    "tumaco": ["san andres de tumaco", "la perla del pacifico", "tumaco narino"],
    "la unión": ["la union", "la union narino", "la unión nariño"],
    "túquerres": ["tuperres", "tuquerres", "tuquerres narino"],
    "samaniego": ["samaniego narino", "samaniego nariño"],
    "eje cafetero": ["eje cafetero colombia", "triangulo del cafe", "zona cafetera"],
}


def _expand_city(city_norm: str) -> list[str]:
    """Devuelve el city_norm más sus alias normalizados."""
    variants = [city_norm]
    for canonical, aliases in _CITY_ALIASES.items():
        canonical_norm = _normalize(canonical)
        aliases_norm = [_normalize(a) for a in aliases]
        if city_norm == canonical_norm or city_norm in aliases_norm:
            variants.append(canonical_norm)
            variants.extend(aliases_norm)
    return list(set(variants))


def _score_entry(entry: dict, city_norm: str, zone_norm: str, property_type: str) -> int:
    """Puntaje de relevancia: más alto = más relevante."""
    score = 0
    entry_city = _normalize(entry["city"])
    entry_zone = _normalize(entry["zone"])

    city_variants = _expand_city(city_norm) if city_norm else []

    # Ciudad match — con aliases
    if city_norm:
        if any(v in entry_city or entry_city in v for v in city_variants):
            score += 10
        # Match de entrada general del departamento
        elif entry_city == "narino" and any("narino" in v or "pasto" in v or "ipiales" in v for v in city_variants):
            score += 4

    # Zona match
    if zone_norm and zone_norm in entry_zone:
        score += 6
    elif zone_norm and entry_zone in zone_norm:
        score += 5

    # Entry general de Colombia siempre tiene algo de relevancia
    if entry["city"] == "colombia":
        score += 2

    # Property type match
    if property_type:
        pt_norm = _normalize(property_type)
        for pt in entry.get("property_types", []):
            if pt_norm in _normalize(pt) or _normalize(pt) in pt_norm:
                score += 3
                break

    return score


def retrieve_market_context(
    city: Optional[str],
    zone: Optional[str],
    property_type: Optional[str],
    intent: Optional[str],
    budget_numeric: Optional[int] = None,
    max_entries: int = 3,
) -> str:
    """
    Busca en la knowledge base y devuelve contexto de mercado formateado
    listo para inyectar en el system prompt.
    """
    if not city and not zone:
        # Sin ubicación: devolvemos solo tendencias generales
        general = next((e for e in KNOWLEDGE_BASE if e["city"] == "colombia"), None)
        if general:
            return _format_entry(general, intent)
        return ""

    city_norm = _normalize(city) if city else ""
    zone_norm = _normalize(zone) if zone else ""
    pt_norm = property_type or ""

    # Score todos los entries
    scored = [(e, _score_entry(e, city_norm, zone_norm, pt_norm)) for e in KNOWLEDGE_BASE]
    scored.sort(key=lambda x: x[1], reverse=True)

    # Filtrar los que tienen score > 0
    relevant = [(e, s) for e, s in scored if s > 0][:max_entries]

    if not relevant:
        return ""

    parts = []
    for entry, score in relevant:
        parts.append(_format_entry(entry, intent, budget_numeric))

    context = "\n\n---\n\n".join(parts)
    return context


def _format_entry(entry: dict, intent: Optional[str], budget_numeric: Optional[int] = None) -> str:
    """Formatea un entry del KB como texto para el prompt."""
    lines = []

    if entry["city"] == "colombia":
        lines.append("📊 CONTEXTO DE MERCADO COLOMBIANO:")
    else:
        lines.append(f"📍 {entry['zone_display']} — {entry['city_display']} (Estrato {entry['strato']})")

    # Precios según intención
    is_buy = not intent or "comprar" in (intent or "").lower() or "compra" in (intent or "").lower()
    is_rent = "arrendar" in (intent or "").lower() or "arriendo" in (intent or "").lower() or "alquiler" in (intent or "").lower()

    if entry["city"] != "colombia":
        if is_rent and not is_buy:
            if entry.get("rent_apt") and entry["rent_apt"] != "N/A":
                lines.append(f"  • Arriendo apartamentos: {entry['rent_apt']}")
            if entry.get("rent_house") and entry["rent_house"] != "N/A":
                lines.append(f"  • Arriendo casas: {entry['rent_house']}")
        elif is_buy and not is_rent:
            if entry.get("buy_apt") and entry["buy_apt"] != "N/A":
                lines.append(f"  • Compra apartamentos: {entry['buy_apt']}")
            if entry.get("buy_house") and entry["buy_house"] != "N/A":
                lines.append(f"  • Compra casas: {entry['buy_house']}")
        else:
            if entry.get("buy_apt") and entry["buy_apt"] != "N/A":
                lines.append(f"  • Compra aptos: {entry['buy_apt']} | Arriendo: {entry['rent_apt']}")
            if entry.get("buy_house") and entry["buy_house"] != "N/A":
                lines.append(f"  • Compra casas: {entry['buy_house']} | Arriendo: {entry['rent_house']}")

        lines.append(f"  • Demanda: {entry['demand']}")
        lines.append(f"  • Perfil típico: {entry['profile']}")

    if entry.get("highlights"):
        lines.append("  • Características:")
        for h in entry["highlights"][:4]:
            lines.append(f"    - {h}")

    if entry.get("ideal_for") and entry["city"] != "colombia":
        lines.append(f"  • Ideal para: {', '.join(entry['ideal_for'][:2])}")

    # Alerta de presupuesto si aplica
    if budget_numeric and entry["city"] != "colombia":
        buy_apt = entry.get("buy_apt", "")
        if buy_apt and buy_apt != "N/A":
            # Extrae rango mínimo
            try:
                min_str = buy_apt.split("–")[0].replace("M", "").replace("B", "000").strip()
                min_val = float(min_str) * 1_000_000
                if budget_numeric < min_val * 0.9:
                    lines.append(f"  ⚠️ Nota: el presupuesto mencionado podría ser ajustado para esta zona. "
                                  f"Puede haber opciones en zonas contiguas o con menor área.")
            except Exception:
                pass

    return "\n".join(lines)
