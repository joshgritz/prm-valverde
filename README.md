# 🗳️ Sistema Electoral PRM — Provincia Valverde
## Documentación Técnica del Proyecto
**Última actualización:** 10 de marzo de 2026  
**Estado:** En desarrollo activo  
**Entorno:** Frontend puro (HTML/CSS/JS) + Supabase (PostgreSQL en la nube)

---

## 1. Objetivo del Proyecto

Construir un **sistema electoral multi-tenant** para el Partido Revolucionario Moderno (PRM) en la provincia Valverde, República Dominicana. El sistema permite gestionar:

- **Inscripción de planchas** para organismos internos (Comités Zonales, Municipales, etc.)
- **Validación estatutaria automática** — cuotas de género (Art. 155), juventud (Art. 154), militancia mínima (Art. 151)
- **Inteligencia electoral** — búsqueda en el padrón oficial PRM con foto real del militante
- **Control de acceso por jerarquía** — cada candidato ve solo su nivel territorial

### Modelo de Negocio
El sistema se vende a candidatos PRM individualmente. Cada candidato accede únicamente a su nivel:
- Senador → ve toda la provincia
- Diputado → ve su circunscripción
- Alcalde → ve su municipio
- Regidor → ve solo su zona

### Alcance Inicial
Provincia **Valverde** (Mao como cabecera). Módulo inicial: **Comité Zonal de Mao**.  
Expansión planificada: municipios Esperanza, Laguna Salada, y distritos municipales (Amina, Guatapanal, Jaibón, Potrero).

---

## 2. Arquitectura Actual

### 2.1 Archivos del Proyecto

| Archivo | Tipo | Descripción | Tamaño |
|---|---|---|---|
| `index.html` | Frontend | UI principal — 4 módulos de navegación | ~46 KB |
| `app.js` | Frontend | Lógica JavaScript completa | ~49 KB |
| `estructura_db.sql` | Base de datos | Esquema Supabase + datos semilla | ~15 KB |
| `importador_padron.html` | Herramienta | Extractor de PDFs del padrón (standalone) | ~28 KB |
| `extractor_padron.py` | Script | Extractor Python para procesamiento en lote | ~11 KB |
| `padron_0071.json` | Datos | Padrón procesado del Colegio 0071 (570 militantes + fotos) | ~3.1 MB |

### 2.2 Stack Tecnológico

```
Frontend:
  - HTML5 + CSS3 (Tailwind CSS via CDN)
  - JavaScript vanilla (ES2020+)
  - Font Awesome (iconos)
  - PDF.js 3.11.174 (extracción de PDFs en el navegador)

Base de datos:
  - Supabase (PostgreSQL en la nube)
  - URL y Key configurables en las primeras líneas de app.js

Fallback (sin Supabase):
  - localStorage del navegador para planchas
  - JSON local cargado en memoria para el padrón
```

### 2.3 Dependencias Externas (CDN)

```html
<!-- En index.html -->
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/..."></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- En importador_padron.html -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
```

### 2.4 Estructura de la Base de Datos (Supabase)

**16 objetos de base de datos:**

```
Tablas territoriales:
  provincias → municipios → zonas → sectores

Tablas de padrón:
  padron_maestro         (cédula PK, nombre, foto_base64, teléfono, dirección,
                          sexo, fecha_nacimiento, anios_militancia, zona_id,
                          voto_primaria, concurrencia_2016, concurrencia_2010,
                          empadronado_exterior, colegio_num, recinto_nombre)

Tablas de acceso:
  roles_sistema          (8 roles jerárquicos)
  usuarios               (con rol_id, zona_id, municipio_id)

Tablas de organismos:
  catalogo_cargos        (21 cargos zonales según Art. 117 + 96 + 77)
  planchas               (con estatus, cuotas calculadas)
  plancha_miembros       (cargo + titular)

Tablas electorales:
  recintos_electorales
  colegios_electorales
  comites_base
  comite_base_miembros

Automatización:
  TRIGGER trg_cuotas     (recalcula % género y juventud en planchas)
  VIEW v_planchas_resumen
  VIEW v_plancha_detalle
```

**Datos semilla incluidos en el SQL:**
- 1 provincia (Valverde)
- 7 municipios/DM (Mao, Esperanza, Laguna Salada, Amina, Guatapanal, Jaibón, Potrero)
- 10 zonas (Mao: A–F; Esperanza: 1–3; Laguna Salada: Zona Única)
- Sectores principales de Mao
- 8 roles del sistema
- 21 cargos del Comité Zonal

### 2.5 Módulos de la UI (`index.html`)

```
┌─────────────────────────────────────────────┐
│  Navegación principal (4 módulos)            │
├──────────────┬──────────────────────────────┤
│ mod-buscador │ Búsqueda por cédula           │
│              │ Ficha con foto real del padrón │
│              │ Filtros: municipio/zona/sector  │
├──────────────┼──────────────────────────────┤
│ mod-organismos│ Tab: Inscripción plancha     │
│              │ Tab: Configuración zona        │
│              │ Tab: Resultados                │
│              │ Tab: Acta Final                │
├──────────────┼──────────────────────────────┤
│ mod-dirigentes│ Tabla de planchas registradas│
│              │ CRUD de planchas               │
│              │ Comité efectivo                │
├──────────────┼──────────────────────────────┤
│ mod-reportes │ Grid plancha activa           │
│              │ Rendimiento colegios           │
│              │ Efectividad dirigentes         │
└──────────────┴──────────────────────────────┘
```

---

## 3. Progreso Realizado

### ✅ Completado

#### Base de datos
- [x] Esquema completo en `estructura_db.sql` con 16 objetos
- [x] Trigger automático de cuotas estatutarias
- [x] Datos semilla para toda la provincia Valverde
- [x] Catálogo completo de 21 cargos zonales

#### Módulo de Inscripción Zonal
- [x] Formulario de 21 cargos dividido en 3 secciones (Alta Dirección, Secretarías, Frentes Sectoriales)
- [x] Validación Art. 155: cuota de género mínimo 40%/máximo 60% — en tiempo real
- [x] Validación Art. 154: cuota de juventud (18–35 años) mínimo 10% — en tiempo real
- [x] Validación Art. 151: militancia mínima 3 años — al validar cada cargo
- [x] Detección de duplicados dentro de la misma plancha
- [x] Guardado en Supabase con fallback a `localStorage`
- [x] Panel estatutario sticky con barras de progreso en vivo

#### Módulo de Dirigentes / Planchas
- [x] Tabla de planchas registradas con estatus (BORRADOR/PENDIENTE/VALIDADA/etc.)
- [x] CRUD completo (crear, editar, eliminar)
- [x] Simulación de datos si no hay conexión Supabase

#### Extractor de Padrón Electoral
- [x] `importador_padron.html` — procesa PDFs del padrón oficial PRM directamente en el navegador
- [x] Extrae por persona: cédula, nombre, teléfono, dirección, voto (PA/PC), exterior, concurrencia 2016/2010
- [x] Extrae la **foto real** del militante (recorte por coordenadas del canvas renderizado)
- [x] Exporta a JSON (con fotos en base64) y SQL (para Supabase)
- [x] `extractor_padron.py` — script Python equivalente para procesamiento en lote
- [x] Probado y funcionando: Colegio 0071 → 570 militantes, 570 con foto
- [x] Probado con múltiples PDFs: hasta 4,571 militantes cargados simultáneamente ✅

#### Integración Padrón → Sistema Principal
- [x] Barra de estado del padrón en el módulo buscador ("SIN PADRÓN" / "PADRÓN ACTIVO")
- [x] Botón "Cargar Padrón JSON" para subir los archivos exportados
- [x] Búsqueda por cédula encuentra al militante en el JSON cargado en memoria
- [x] Ficha del militante muestra foto real del padrón
- [x] Ficha muestra: teléfono, dirección, tipo de voto (PA/PC), concurrencia electoral
- [x] Fallback a Supabase si no hay JSON local; fallback a avatar generado si no hay foto

---

## 4. Problemas Pendientes y Bugs

### 🐛 Bug Confirmado
| # | Descripción | Módulo | Prioridad |
|---|---|---|---|
| 1 | **Botones de planchas no responden** — los botones de editar/eliminar en la tabla de planchas del `mod-dirigentes` no ejecutan sus funciones | `mod-dirigentes` + `app.js` → `editarPlancha()` / `eliminarPlancha()` | Alta |

### ⚠️ Pendiente de Implementar
| # | Descripción | Notas |
|---|---|---|
| 2 | **Supabase no conectado** — el sistema funciona en modo local/offline pero no está vinculado a ningún proyecto Supabase real todavía | El usuario necesita crear su proyecto en supabase.com, correr el SQL, y poner URL + Key en `app.js` líneas 14–15 |
| 3 | **Fotos en Supabase** — el campo `foto_base64` en `padron_maestro` no está siendo llenado con los datos del extractor | El SQL exportado por el importador trunca las fotos; se necesita un proceso de carga de fotos separado |
| 4 | **Validación de militancia real** — actualmente `validarCargo()` usa `anios_militancia` del `padron_maestro`, que no existe en el padrón electoral (solo está en los datos del sistema, no en el PDF) | Se necesita un campo editable o una tabla separada de registro de militancia |
| 5 | **Módulo de Votación en vivo** — el tab "Resultados" existe en la UI pero no tiene lógica implementada | |
| 6 | **Módulo de Acta Final** — el tab "Acta Final" existe en la UI pero no genera el documento oficial | |
| 7 | **Mapa electoral interactivo** — el área del mapa en `mod-buscador` muestra placeholder | Planificado para versión futura |

---

## 5. Próximos Pasos Planificados

### Inmediato (sesión actual pendiente)
1. **Corregir bug de botones en planchas** — investigar por qué `editarPlancha(id)` y `eliminarPlancha(id)` no responden al click

### Corto Plazo
2. **Conectar Supabase real** — guiar al usuario a crear proyecto, correr `estructura_db.sql`, y configurar credenciales
3. **Carga de fotos a Supabase** — construir proceso para subir los `foto_b64` del JSON al storage de Supabase o directamente a la tabla

### Mediano Plazo
4. **Nivel Municipal** — replicar el módulo de inscripción para Comité Municipal (Art. 110 Estatutos)
5. **Control multi-tenant** — implementar login por rol con restricción de acceso por jerarquía
6. **Módulo de votación en vivo** — marcar votos durante el día de elecciones internas
7. **Generador de acta** — exportar el acta oficial firmable en PDF

### Largo Plazo
8. **Expansión provincial** — otros municipios de Valverde (Esperanza, Laguna Salada, DMs)
9. **Mapa interactivo** — visualización de cobertura por sector/zona
10. **App móvil** — versión PWA para dirigentes de base

---

## 6. Decisiones Técnicas Importantes

### 6.1 Frontend sin framework
**Decisión:** Usar HTML/CSS/JS vanilla en lugar de React o Vue.  
**Razón:** El sistema se abre como un archivo `.html` local en el navegador del usuario (no hay servidor). Sin build step, sin Node.js, cero instalación. Funciona offline.

### 6.2 Supabase como backend
**Decisión:** PostgreSQL en la nube via Supabase (gratuito hasta cierto límite).  
**Razón:** El usuario no tiene servidor propio. Supabase provee: base de datos, autenticación, API REST automática, y almacenamiento de archivos.  
**Fallback:** Si no hay Supabase configurado, el sistema usa `localStorage` para planchas y JSON en memoria para el padrón.

### 6.3 Extracción de fotos en el navegador
**Decisión:** Usar PDF.js para renderizar cada página del padrón en un `<canvas>` a 2x de escala, luego recortar las fotos por coordenadas fijas.  
**Razón:** El usuario no tiene Python instalado. El procesamiento es 100% local, no se envía nada a internet.  
**Coordenadas fijas del padrón PRM:** columna izquierda `x=12`, columna derecha `x=305`, incremento vertical `y+79` por persona, tamaño de foto `72x79px` en coordenadas PDF.

### 6.4 Padrón como JSON en memoria
**Decisión:** El padrón se exporta como JSON desde el importador y se carga en memoria en el sistema principal (no se persiste en el servidor).  
**Razón:** Las fotos en base64 pesan ~3 MB por colegio. Para 20+ colegios eso es ~60 MB, demasiado para `localStorage` (límite ~5 MB). En memoria no hay límite práctico.  
**Consecuencia:** El usuario debe re-cargar los JSONs cada vez que abre el sistema hasta que se conecte a Supabase con storage de fotos.

### 6.5 Estructura del padrón PDF
**Estructura identificada del padrón oficial PRM Valverde (Febrero 2020):**
- Página tamaño: 612 × 792 pts (Letter)
- 2 columnas por página, 8 personas por página (~285 por columna)
- Cada persona ocupa exactamente 79pts de altura
- Fotos: JPEG embebidas (`/DCTDecode`), ~115×150px en el PDF
- Texto: cédula (xxx-xxxxxxx-x), nombre, teléfono, dirección, flags PRM/PLD/PA/PC/EXT/2016/2010

### 6.6 Catálogo de 21 cargos del Comité Zonal
**Según Estatutos PRM (enero 2022):**

| Categoría | Cargos | Artículo |
|---|---|---|
| Alta Dirección (8) | Presidente/a, 3 Vicepresidentes, Secretario/a General, 3 Subsecretarios/as | Art. 117 |
| Secretarías (8) | Organización, Electoral, Educación, Finanzas, Comunicación, Tecnología, Asuntos Municipales, Actas | Art. 96 |
| Frentes Sectoriales (5) | Mujeres *(obligatorio)*, Juventud *(obligatorio)*, Magisterial, Agropecuario, Salud | Art. 77 |

### 6.7 Jerarquía de roles del sistema (multi-tenant)
```
ADMIN_SISTEMA          → acceso total
CANDIDATO_SENADOR      → ve toda la provincia (no ve estructuras de otros candidatos)
CANDIDATO_DIPUTADO     → ve su circunscripción
CANDIDATO_ALCALDE      → ve su municipio, inscribe planchas municipales
CANDIDATO_REGIDOR      → ve su zona, inscribe planchas zonales
SECRETARIO_ZONA        → gestiona inscripciones de su zona
COORDINADOR_RECINTO    → nivel de recinto electoral
DIRIGENTE_BASE         → comité de base 10×1
```

### 6.8 Estructura territorial de Valverde
```
Provincia Valverde
├── Mao (Municipio cabecera)
│   ├── Zona A, B, C, D, E, F
│   └── Sectores: Los Multis, El Centro, Barrio Nuevo, etc.
├── Esperanza (Municipio)
│   └── Zona 1, 2, 3
├── Laguna Salada (Municipio)
│   └── Zona Única
└── Distritos Municipales: Amina, Guatapanal, Jaibón, Potrero
```

---

## 7. Configuración Inicial para Retomar el Proyecto

### Para el desarrollador (contexto de Claude)
1. Los archivos de código están en `/mnt/user-data/outputs/`
2. El padrón del Colegio 0071 ya procesado está en `padron_0071.json` (3.1 MB, 570 militantes con fotos)
3. El bug de botones en planchas está en `renderTablaPlanchas()` → `editarPlancha(id)` / `eliminarPlancha(id)`
4. El usuario **no tiene Python instalado** → toda solución debe ser en el navegador o en Supabase
5. El usuario tiene **más de 20 PDFs** de colegios para Mao

### Para conectar Supabase
```javascript
// En app.js, líneas 14-15:
const SUPABASE_URL  = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_KEY  = 'TU-ANON-PUBLIC-KEY';
```
Pasos:
1. Ir a [supabase.com](https://supabase.com) → Crear proyecto
2. SQL Editor → Copiar y ejecutar `estructura_db.sql`
3. Settings → API → Copiar URL y anon key
4. Pegar en `app.js` líneas 14-15

### Instrucciones de trabajo acordadas
- No cambiar nada a menos que el usuario lo pida
- Ir paso a paso, terminar un módulo antes de pasar al siguiente
- Basarse siempre en los **Estatutos PRM (enero 2022)** para elecciones internas
- Sistema provincial Valverde primero, luego expandible

---

## 8. Referencias

| Documento | Descripción |
|---|---|
| `ESTATUTOS_PRM_DIGITAL.pdf` | Estatutos PRM enero 2022 (134 páginas) — subido por el usuario |
| Art. 77 | Frentes Sectoriales |
| Art. 89 | Estructura territorial del partido |
| Art. 96 | Secretarías del Comité |
| Art. 110 | Comité Municipal |
| Art. 117 | Comité Zonal — cargos y composición |
| Art. 151 | Militancia mínima para cargos |
| Art. 154 | Cuota de juventud (mínimo 10%) |
| Art. 155 | Cuota de género (40%–60%) |

---

*Documento generado automáticamente a partir del historial de desarrollo del proyecto.*  
*Sistema Electoral PRM — Provincia Valverde, República Dominicana*
