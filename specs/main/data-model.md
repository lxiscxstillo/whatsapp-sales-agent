# Data Model: Sales Closer Engine v2

**Phase**: 1 — Design
**Date**: 2026-03-21

---

## 1. `data/inventory_colombia.json` — Property Inventory Schema

### Top-Level Structure

```json
{
  "version": "1.0.0",
  "last_updated": "2026-03-21",
  "total_properties": 50,
  "properties": [ ...PropertyRecord[] ]
}
```

### PropertyRecord Schema

```typescript
interface PropertyRecord {
  id: string;                  // "PST-001" — city prefix + sequential number
  type: "Casa" | "Apartamento" | "Lote" | "Oficina";
  city: string;                // "Pasto" | "Bogotá" | "Medellín" | "Cali"
  zone: string;                // Neighborhood/barrio name
  price_cop: number;           // Simulated price in COP (e.g., 280000000)
  price_display: string;       // Human-readable: "280 millones COP"
  area_m2: number;             // Total area in square meters
  bedrooms: number | null;     // null for Lote/Oficina
  bathrooms: number | null;    // null for Lote/Oficina
  amenities: string[];         // e.g., ["Vista al Galeras", "Cerca a Unicentro Pasto"]
  unique_selling_argument: string;  // One sentence, commercial tone, Colombian modisms
  stratum: number | null;      // Colombian estrato (1–6), null if N/A
  status: "Disponible" | "Reservado" | "En Negociación";
  contact_advisor: string;     // Advisor name for handoff context
}
```

### Example Records

#### Pasto (Nariño)

```json
[
  {
    "id": "PST-001",
    "type": "Apartamento",
    "city": "Pasto",
    "zone": "Palermo",
    "price_cop": 280000000,
    "price_display": "280 millones COP",
    "area_m2": 72,
    "bedrooms": 3,
    "bathrooms": 2,
    "amenities": ["Vista al Volcán Galeras", "Cerca a Unicentro Pasto", "Parqueadero cubierto", "Conjunto cerrado"],
    "unique_selling_argument": "Sector de alta valorización con vista privilegiada al Galeras — ideal para familias que buscan tranquilidad sin alejarse del centro.",
    "stratum": 4,
    "status": "Disponible",
    "contact_advisor": "Andrés Mora"
  },
  {
    "id": "PST-002",
    "type": "Casa",
    "city": "Pasto",
    "zone": "Palermo",
    "price_cop": 420000000,
    "price_display": "420 millones COP",
    "area_m2": 140,
    "bedrooms": 4,
    "bathrooms": 3,
    "amenities": ["Jardín privado", "Cerca a colegios bilingües", "Zona tranquila"],
    "unique_selling_argument": "Casa independiente en Palermo, barrio residencial consolidado — perfecta para inversión o familia numerosa.",
    "stratum": 4,
    "status": "Disponible",
    "contact_advisor": "Andrés Mora"
  },
  {
    "id": "PST-003",
    "type": "Apartamento",
    "city": "Pasto",
    "zone": "Maridíaz",
    "price_cop": 195000000,
    "price_display": "195 millones COP",
    "area_m2": 58,
    "bedrooms": 2,
    "bathrooms": 1,
    "amenities": ["Zona comercial cercana", "Transporte público directo al centro"],
    "unique_selling_argument": "Excelente opción de entrada al mercado en Maridíaz — barrio con gran proyección y acceso rápido a todos los servicios.",
    "stratum": 3,
    "status": "Disponible",
    "contact_advisor": "Andrés Mora"
  },
  {
    "id": "PST-004",
    "type": "Apartamento",
    "city": "Pasto",
    "zone": "Avenida Panamericana",
    "price_cop": 310000000,
    "price_display": "310 millones COP",
    "area_m2": 85,
    "bedrooms": 3,
    "bathrooms": 2,
    "amenities": ["Avenida principal", "Cerca Plaza del Carnaval de Negros y Blancos", "Parqueadero"],
    "unique_selling_argument": "Ubicación estratégica sobre la Panamericana — la arteria más importante de Pasto, con valorización garantizada.",
    "stratum": 4,
    "status": "Disponible",
    "contact_advisor": "Laura Benavides"
  },
  {
    "id": "PST-005",
    "type": "Casa",
    "city": "Pasto",
    "zone": "Tamasagra",
    "price_cop": 245000000,
    "price_display": "245 millones COP",
    "area_m2": 110,
    "bedrooms": 3,
    "bathrooms": 2,
    "amenities": ["Barrio tranquilo", "Cerca a zona universitaria", "Amplio garaje"],
    "unique_selling_argument": "Tamasagra es una de las zonas de mayor crecimiento en Pasto — con cercanía a la Universidad Nariño, ideal para inversión en renta.",
    "stratum": 3,
    "status": "Disponible",
    "contact_advisor": "Laura Benavides"
  },
  {
    "id": "PST-006",
    "type": "Apartamento",
    "city": "Pasto",
    "zone": "Anganoy",
    "price_cop": 170000000,
    "price_display": "170 millones COP",
    "area_m2": 50,
    "bedrooms": 2,
    "bathrooms": 1,
    "amenities": ["Sector económico", "Fácil acceso vial"],
    "unique_selling_argument": "La mejor relación precio-m² en Pasto — ideal para primera vivienda o inversión con arriendo.",
    "stratum": 2,
    "status": "Disponible",
    "contact_advisor": "Laura Benavides"
  },
  {
    "id": "PST-007",
    "type": "Casa",
    "city": "Pasto",
    "zone": "El Prado",
    "price_cop": 380000000,
    "price_display": "380 millones COP",
    "area_m2": 130,
    "bedrooms": 4,
    "bathrooms": 3,
    "amenities": ["Sector residencial exclusivo", "Club house", "Piscina comunitaria"],
    "unique_selling_argument": "El Prado es el sector de mayor status en Pasto — elegancia, seguridad y valorización sostenida año tras año.",
    "stratum": 5,
    "status": "Disponible",
    "contact_advisor": "Andrés Mora"
  },
  {
    "id": "PST-008",
    "type": "Apartamento",
    "city": "Pasto",
    "zone": "San Ignacio",
    "price_cop": 225000000,
    "price_display": "225 millones COP",
    "area_m2": 65,
    "bedrooms": 3,
    "bathrooms": 2,
    "amenities": ["Conjunto residencial con portería 24h", "Zona verde", "Cerca a Cementerio Jardines"],
    "unique_selling_argument": "San Ignacio ofrece seguridad y comunidad — uno de los barrios más consolidados de Pasto con excelente convivencia.",
    "stratum": 4,
    "status": "Disponible",
    "contact_advisor": "Andrés Mora"
  }
]
```

#### Bogotá

```json
[
  {
    "id": "BOG-001",
    "type": "Apartamento",
    "city": "Bogotá",
    "zone": "Chicó",
    "price_cop": 850000000,
    "price_display": "850 millones COP",
    "area_m2": 90,
    "bedrooms": 2,
    "bathrooms": 2,
    "amenities": ["Zona rosa", "Edificio con gimnasio", "Conserje 24h"],
    "unique_selling_argument": "El Chicó es el corazón financiero y social del norte de Bogotá — cada metro cuadrado es una inversión de primer nivel.",
    "stratum": 6,
    "status": "Disponible",
    "contact_advisor": "Camila Torres"
  },
  {
    "id": "BOG-002",
    "type": "Casa",
    "city": "Bogotá",
    "zone": "Chicó",
    "price_cop": 1800000000,
    "price_display": "1.800 millones COP",
    "area_m2": 250,
    "bedrooms": 5,
    "bathrooms": 4,
    "amenities": ["Casa esquinera", "Jardín privado", "Estudio independiente", "3 garajes"],
    "unique_selling_argument": "Casa de lujo en Chicó Norte — rareza en el mercado bogotano, ideal para embajadas o familias de alto perfil.",
    "stratum": 6,
    "status": "Disponible",
    "contact_advisor": "Camila Torres"
  },
  {
    "id": "BOG-003",
    "type": "Apartamento",
    "city": "Bogotá",
    "zone": "Cedritos",
    "price_cop": 450000000,
    "price_display": "450 millones COP",
    "area_m2": 78,
    "bedrooms": 3,
    "bathrooms": 2,
    "amenities": ["Cerca a Centro Comercial Cedritos", "Parque cercano", "Zona familiar"],
    "unique_selling_argument": "Cedritos: el punto dulce del norte de Bogotá — precio accesible con acceso a todo lo que Chicó ofrece.",
    "stratum": 5,
    "status": "Disponible",
    "contact_advisor": "Camila Torres"
  }
]
```

#### Medellín

```json
[
  {
    "id": "MED-001",
    "type": "Apartamento",
    "city": "Medellín",
    "zone": "El Poblado",
    "price_cop": 680000000,
    "price_display": "680 millones COP",
    "area_m2": 80,
    "bedrooms": 2,
    "bathrooms": 2,
    "amenities": ["Vista a las montañas", "Zona rosa del Poblado", "Edificio boutique"],
    "unique_selling_argument": "El Poblado es el barrio más cotizado de Medellín — alta demanda de arriendo internacional garantiza rentabilidad inmediata.",
    "stratum": 6,
    "status": "Disponible",
    "contact_advisor": "Sebastián Ríos"
  },
  {
    "id": "MED-002",
    "type": "Casa",
    "city": "Medellín",
    "zone": "Laureles",
    "price_cop": 520000000,
    "price_display": "520 millones COP",
    "area_m2": 160,
    "bedrooms": 4,
    "bathrooms": 3,
    "amenities": ["Barrio tradicional", "Cerca a Estadio Atanasio", "Amplios antejardines"],
    "unique_selling_argument": "Laureles: tradición, familia y valorización constante — el barrio paisa más querido para vivir bien.",
    "stratum": 5,
    "status": "Disponible",
    "contact_advisor": "Sebastián Ríos"
  }
]
```

#### Cali

```json
[
  {
    "id": "CAL-001",
    "type": "Casa",
    "city": "Cali",
    "zone": "Pance",
    "price_cop": 920000000,
    "price_display": "920 millones COP",
    "area_m2": 300,
    "bedrooms": 5,
    "bathrooms": 4,
    "amenities": ["Piscina privada", "Zona verde 500m²", "Río Pance cercano", "Seguridad 24h"],
    "unique_selling_argument": "Pance es el retiro exclusivo de Cali — lujo, naturaleza y privacidad a 20 minutos del centro financiero.",
    "stratum": 6,
    "status": "Disponible",
    "contact_advisor": "Valentina Ospina"
  },
  {
    "id": "CAL-002",
    "type": "Apartamento",
    "city": "Cali",
    "zone": "Pance",
    "price_cop": 480000000,
    "price_display": "480 millones COP",
    "area_m2": 95,
    "bedrooms": 3,
    "bathrooms": 2,
    "amenities": ["Torre con piscina", "Zona BBQ", "Cancha de tenis"],
    "unique_selling_argument": "Apartamento en conjunto cerrado de Pance — la mejor opción para quienes desean exclusividad sin el mantenimiento de una casa.",
    "stratum": 6,
    "status": "Disponible",
    "contact_advisor": "Valentina Ospina"
  }
]
```

---

## 2. Prisma Schema Additions

Two new nullable columns on the `Lead` model:

```prisma
model Lead {
  // ... all existing fields unchanged ...

  // NEW: Sales Closer Engine v2 fields
  slotNeighborhood   String?     // Preferred barrio/neighborhood extracted by agent
  urgencyLevel       String?     // Normalized urgency enum:
                                 //   "inmediata" | "1-3_meses" | "3-6_meses"
                                 //   | "mas_de_6_meses" | "no_definida"
}
```

### Migration SQL (generated by Prisma)
```sql
-- AlterTable: non-destructive ADD COLUMN
ALTER TABLE "Lead" ADD COLUMN "slotNeighborhood" TEXT;
ALTER TABLE "Lead" ADD COLUMN "urgencyLevel" TEXT;
```

---

## 3. Updated `LeadSlots` TypedDict

```python
class LeadSlots(TypedDict, total=False):
    # Existing fields (unchanged)
    name: Optional[str]
    city: Optional[str]
    zone: Optional[str]
    property_type: Optional[str]
    budget: Optional[str]
    budget_numeric: Optional[int]
    intent: Optional[str]
    bedrooms: Optional[str]
    urgency: Optional[str]        # Raw extracted text — unchanged
    main_need: Optional[str]
    objections: Optional[list[str]]

    # NEW: Sales Closer Engine v2
    preferred_neighborhood: Optional[str]  # Specific barrio preference (may match zone or differ)
    urgency_level: Optional[str]           # Normalized urgency enum (computed in evaluate_lead)
```

---

## 4. `InventoryService` In-Memory Structure

```python
@dataclass
class PropertyRecord:
    """Represents a single property from the inventory JSON."""
    id: str
    type: str                    # "Casa" | "Apartamento" | "Lote" | "Oficina"
    city: str
    zone: str
    price_cop: int
    price_display: str
    area_m2: int
    bedrooms: Optional[int]
    bathrooms: Optional[int]
    amenities: list[str]
    unique_selling_argument: str
    stratum: Optional[int]
    status: str
    contact_advisor: str
```

### Query Result
```python
@dataclass
class InventoryQueryResult:
    """Output of InventoryService.query()."""
    properties: list[PropertyRecord]  # Top-N matches, price ASC
    alternatives: list[PropertyRecord]  # Adjacent-zone properties for objection handling
    query_succeeded: bool  # False if JSON failed to load (fallback mode)
```
