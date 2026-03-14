-- ============================================================
-- SISTEMA ELECTORAL PRM - PROVINCIA VALVERDE
-- Base de Datos Supabase (PostgreSQL)
-- Basado en Estatutos PRM: Arts. 89, 96, 117, 153, 154, 155
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BLOQUE 1: ESTRUCTURA TERRITORIAL (Arts. 89, 108, 117)
-- ============================================================

CREATE TABLE provincias (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL
);

CREATE TABLE municipios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('MUNICIPIO', 'DISTRITO_MUNICIPAL')) NOT NULL,
    provincia_id INTEGER REFERENCES provincias(id),
    es_regionalizado BOOLEAN DEFAULT FALSE
);

-- Zonas políticas - unidad base de militancia (Art. 115-117)
CREATE TABLE zonas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL,       -- Ej: 'MAO-ZA'
    municipio_id INTEGER REFERENCES municipios(id),
    tipo TEXT CHECK (tipo IN ('URBANA', 'RURAL')) DEFAULT 'URBANA',
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sectores, barrios y parajes dentro de cada zona (Art. 118)
CREATE TABLE sectores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    zona_id INTEGER REFERENCES zonas(id),
    tipo TEXT CHECK (tipo IN ('SECTOR', 'BARRIO', 'PARAJE')) DEFAULT 'SECTOR'
);

-- ============================================================
-- BLOQUE 2: PADRÓN MAESTRO
-- ============================================================

CREATE TABLE padron_maestro (
    cedula TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    fecha_nacimiento DATE,
    -- Ubicación electoral (JCE)
    recinto TEXT,
    colegio_electoral TEXT,
    -- Ubicación política (PRM)
    zona_id INTEGER REFERENCES zonas(id),
    sector_id INTEGER REFERENCES sectores(id),
    municipio_id INTEGER REFERENCES municipios(id),
    -- Contacto
    telefono TEXT,
    direccion_exacta TEXT,
    foto_url TEXT,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    -- Militancia
    anios_militancia INTEGER DEFAULT 0,
    fecha_afiliacion DATE,
    estatus_militante TEXT CHECK (estatus_militante IN ('ACTIVO','INACTIVO','SUSPENDIDO','NUEVO')) DEFAULT 'ACTIVO',
    es_militante_prm BOOLEAN DEFAULT FALSE,
    -- Fidelidad (uso interno candidatos)
    fidelidad TEXT CHECK (fidelidad IN ('DURO','BLANDO','INDECISO','OPOSICION')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_padron_zona      ON padron_maestro(zona_id);
CREATE INDEX idx_padron_municipio ON padron_maestro(municipio_id);
CREATE INDEX idx_padron_colegio   ON padron_maestro(colegio_electoral);
CREATE INDEX idx_padron_sexo      ON padron_maestro(sexo);

-- ============================================================
-- BLOQUE 3: USUARIOS Y ROLES (Multi-tenant con control jerárquico)
-- ============================================================

CREATE TABLE roles_sistema (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    nivel_jerarquia INTEGER NOT NULL,      -- 1=máximo, 9=mínimo
    puede_ver_otras_estructuras BOOLEAN DEFAULT FALSE,
    puede_ver_padron_completo BOOLEAN DEFAULT FALSE,
    puede_ver_estadisticas_provincia BOOLEAN DEFAULT FALSE,
    puede_inscribir_planchas BOOLEAN DEFAULT FALSE,
    descripcion TEXT
);

INSERT INTO roles_sistema VALUES
(1,'ADMIN_SISTEMA',       1,TRUE, TRUE, TRUE, TRUE, 'Acceso total'),
(2,'CANDIDATO_SENADOR',   2,FALSE,TRUE, TRUE, FALSE,'Ve provincia entera, sin estructuras de otros'),
(3,'CANDIDATO_DIPUTADO',  3,FALSE,TRUE, FALSE,FALSE,'Ve su circunscripción'),
(4,'CANDIDATO_ALCALDE',   4,FALSE,TRUE, FALSE,TRUE, 'Ve su municipio, inscribe planchas municipales'),
(5,'CANDIDATO_REGIDOR',   5,FALSE,FALSE,FALSE,TRUE, 'Ve su zona, inscribe plancha zonal'),
(6,'SECRETARIO_ZONA',     6,FALSE,FALSE,FALSE,TRUE, 'Gestiona inscripciones de su zona'),
(7,'COORDINADOR_RECINTO', 7,FALSE,FALSE,FALSE,FALSE,'Trabaja a nivel de recinto electoral'),
(8,'DIRIGENTE_BASE',      8,FALSE,FALSE,FALSE,FALSE,'Maneja su comité de base 10x1');

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cedula TEXT UNIQUE NOT NULL REFERENCES padron_maestro(cedula),
    nombre_completo TEXT NOT NULL,
    telefono TEXT,
    email TEXT UNIQUE,
    rol_id INTEGER REFERENCES roles_sistema(id),
    -- Demarcación según rol
    provincia_id INTEGER REFERENCES provincias(id),
    municipio_id INTEGER REFERENCES municipios(id),
    zona_id INTEGER REFERENCES zonas(id),
    -- Seguridad
    clave_hash TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 4: CATÁLOGO DE CARGOS POR NIVEL (Arts. 96, 117)
-- ============================================================

CREATE TABLE catalogo_cargos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    nivel TEXT CHECK (nivel IN ('ZONA','MUNICIPIO','DISTRITO_MUNICIPAL','PROVINCIA')) NOT NULL,
    categoria TEXT CHECK (categoria IN ('ALTA_DIRECCION','SECRETARIA','FRENTE_SECTORIAL','COMISION')) NOT NULL,
    orden_display INTEGER NOT NULL,
    es_obligatorio BOOLEAN DEFAULT TRUE,
    articulo_estatuto TEXT
);

-- Cargos Comité Zonal según Art. 117 + Art. 96
INSERT INTO catalogo_cargos (nombre, nivel, categoria, orden_display, es_obligatorio, articulo_estatuto) VALUES
('Presidente(a) de Zona',              'ZONA','ALTA_DIRECCION', 1, TRUE, 'Art.117'),
('1er Vicepresidente(a)',               'ZONA','ALTA_DIRECCION', 2, TRUE, 'Art.117'),
('2do Vicepresidente(a)',               'ZONA','ALTA_DIRECCION', 3, TRUE, 'Art.117'),
('3er Vicepresidente(a)',               'ZONA','ALTA_DIRECCION', 4, TRUE, 'Art.117'),
('Secretario(a) General',              'ZONA','ALTA_DIRECCION', 5, TRUE, 'Art.117'),
('1er Subsecretario(a) General',       'ZONA','ALTA_DIRECCION', 6, TRUE, 'Art.117'),
('2do Subsecretario(a) General',       'ZONA','ALTA_DIRECCION', 7, TRUE, 'Art.117'),
('3er Subsecretario(a) General',       'ZONA','ALTA_DIRECCION', 8, TRUE, 'Art.117'),
('Secretario(a) de Organización',      'ZONA','SECRETARIA',     9, TRUE, 'Art.96'),
('Secretario(a) Electoral',            'ZONA','SECRETARIA',    10, TRUE, 'Art.96'),
('Secretario(a) de Educación',         'ZONA','SECRETARIA',    11, TRUE, 'Art.96'),
('Secretario(a) de Finanzas',          'ZONA','SECRETARIA',    12, TRUE, 'Art.96'),
('Secretario(a) de Comunicación',      'ZONA','SECRETARIA',    13, TRUE, 'Art.96'),
('Secretario(a) de Tecnología',        'ZONA','SECRETARIA',    14, FALSE,'Art.96'),
('Secretario(a) de Asuntos Municipales','ZONA','SECRETARIA',   15, TRUE, 'Art.96'),
('Secretario(a) de Actas',             'ZONA','SECRETARIA',    16, TRUE, 'Art.96'),
('Presidenta - Frente de Mujeres',     'ZONA','FRENTE_SECTORIAL',17,TRUE,'Art.77'),
('Presidente - Frente de Juventud',    'ZONA','FRENTE_SECTORIAL',18,TRUE,'Art.77'),
('Pdte. Frente Magisterial',           'ZONA','FRENTE_SECTORIAL',19,FALSE,'Art.77'),
('Pdte. Frente Agropecuario',          'ZONA','FRENTE_SECTORIAL',20,FALSE,'Art.77'),
('Pdte. Frente de Salud',              'ZONA','FRENTE_SECTORIAL',21,FALSE,'Art.77');

-- ============================================================
-- BLOQUE 5: PLANCHAS Y MIEMBROS
-- ============================================================

CREATE TABLE planchas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    nombre_plancha TEXT,
    nivel TEXT CHECK (nivel IN ('ZONA','MUNICIPIO','DISTRITO_MUNICIPAL','PROVINCIA','EXTERIOR')) NOT NULL,
    -- Demarcación
    zona_id INTEGER REFERENCES zonas(id),
    municipio_id INTEGER REFERENCES municipios(id),
    provincia_id INTEGER REFERENCES provincias(id),
    -- Estado
    estatus TEXT CHECK (estatus IN ('BORRADOR','PENDIENTE','VALIDADA','RECHAZADA','PROCLAMADA')) DEFAULT 'BORRADOR',
    -- Validaciones estatutarias (calculadas por trigger)
    cuota_genero_ok   BOOLEAN DEFAULT FALSE,   -- Art.155: 40-60%
    cuota_juventud_ok BOOLEAN DEFAULT FALSE,   -- Art.154: mín 10%
    militancia_ok     BOOLEAN DEFAULT FALSE,   -- Art.151: mín 3 años zona
    -- Totales calculados
    total_miembros    INTEGER DEFAULT 0,
    total_mujeres     INTEGER DEFAULT 0,
    total_hombres     INTEGER DEFAULT 0,
    total_jovenes     INTEGER DEFAULT 0,
    porcentaje_mujeres DECIMAL(5,2) DEFAULT 0,
    porcentaje_jovenes DECIMAL(5,2) DEFAULT 0,
    -- Documentos y notas
    observaciones TEXT,
    observaciones_rechazo TEXT,
    acta_url TEXT,
    -- Auditoría
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE plancha_miembros (
    id SERIAL PRIMARY KEY,
    plancha_id UUID REFERENCES planchas(id) ON DELETE CASCADE,
    cargo_id INTEGER REFERENCES catalogo_cargos(id),
    cedula_titular TEXT REFERENCES padron_maestro(cedula),
    -- Datos cacheados para velocidad
    nombre_titular TEXT,
    sexo_titular CHAR(1),
    edad_titular INTEGER,
    -- Validación
    validado BOOLEAN DEFAULT FALSE,
    error_validacion TEXT,
    posicion INTEGER,
    UNIQUE(plancha_id, cargo_id)
);

-- ============================================================
-- BLOQUE 6: RECINTOS Y COLEGIOS ELECTORALES
-- ============================================================

CREATE TABLE recintos_electorales (
    id SERIAL PRIMARY KEY,
    codigo_jce TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    direccion TEXT,
    zona_id INTEGER REFERENCES zonas(id),
    municipio_id INTEGER REFERENCES municipios(id),
    total_colegios INTEGER DEFAULT 0,
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8)
);

CREATE TABLE colegios_electorales (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    recinto_id INTEGER REFERENCES recintos_electorales(id),
    total_electores INTEGER DEFAULT 0,
    votos_prm_internas INTEGER DEFAULT 0,
    votos_prm_generales INTEGER DEFAULT 0,
    porcentaje_participacion DECIMAL(5,2) DEFAULT 0
);

-- ============================================================
-- BLOQUE 7: COMITÉS DE BASE (10x1)
-- ============================================================

CREATE TABLE comites_base (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT,
    zona_id INTEGER REFERENCES zonas(id),
    sector_id INTEGER REFERENCES sectores(id),
    dirigente_id UUID REFERENCES usuarios(id),
    total_miembros INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE comite_base_miembros (
    id SERIAL PRIMARY KEY,
    comite_id INTEGER REFERENCES comites_base(id),
    cedula TEXT REFERENCES padron_maestro(cedula),
    relacion TEXT CHECK (relacion IN ('FAMILIAR','AMIGO','VECINO','COMPAÑERO','OTRO')),
    confirmado BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comite_id, cedula)
);

-- ============================================================
-- BLOQUE 8: TRIGGER - RECALCULAR CUOTAS AUTOMÁTICAMENTE
-- ============================================================

CREATE OR REPLACE FUNCTION recalcular_cuotas_plancha()
RETURNS TRIGGER AS $$
DECLARE
    v_total   INTEGER;
    v_mujeres INTEGER;
    v_jovenes INTEGER;
    v_pct_m   DECIMAL(5,2);
    v_pct_j   DECIMAL(5,2);
    v_pid     UUID;
BEGIN
    v_pid := COALESCE(NEW.plancha_id, OLD.plancha_id);

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE sexo_titular = 'F'),
        COUNT(*) FILTER (WHERE edad_titular BETWEEN 18 AND 35)
    INTO v_total, v_mujeres, v_jovenes
    FROM plancha_miembros
    WHERE plancha_id = v_pid AND validado = TRUE;

    v_pct_m := CASE WHEN v_total > 0 THEN (v_mujeres::DECIMAL / v_total)*100 ELSE 0 END;
    v_pct_j := CASE WHEN v_total > 0 THEN (v_jovenes::DECIMAL / v_total)*100 ELSE 0 END;

    UPDATE planchas SET
        total_miembros     = v_total,
        total_mujeres      = v_mujeres,
        total_hombres      = v_total - v_mujeres,
        total_jovenes      = v_jovenes,
        porcentaje_mujeres = v_pct_m,
        porcentaje_jovenes = v_pct_j,
        cuota_genero_ok    = (v_pct_m >= 40 AND v_pct_m <= 60),
        cuota_juventud_ok  = (v_pct_j >= 10),
        actualizado_en     = NOW()
    WHERE id = v_pid;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cuotas
AFTER INSERT OR UPDATE OR DELETE ON plancha_miembros
FOR EACH ROW EXECUTE FUNCTION recalcular_cuotas_plancha();

-- ============================================================
-- BLOQUE 9: VISTAS
-- ============================================================

CREATE VIEW v_planchas_resumen AS
SELECT
    p.id, p.codigo, p.nombre_plancha, p.nivel,
    z.nombre AS zona, m.nombre AS municipio,
    p.estatus, p.total_miembros,
    p.total_mujeres, p.total_hombres, p.total_jovenes,
    p.porcentaje_mujeres, p.porcentaje_jovenes,
    p.cuota_genero_ok, p.cuota_juventud_ok, p.militancia_ok,
    (p.cuota_genero_ok AND p.cuota_juventud_ok AND p.militancia_ok) AS estatutos_ok,
    p.creado_en
FROM planchas p
LEFT JOIN zonas z     ON p.zona_id    = z.id
LEFT JOIN municipios m ON p.municipio_id = m.id;

CREATE VIEW v_plancha_detalle AS
SELECT
    pm.plancha_id,
    cc.nombre AS cargo, cc.categoria, cc.orden_display,
    pm.cedula_titular, pm.nombre_titular,
    pm.sexo_titular, pm.edad_titular,
    pm.validado, pm.error_validacion,
    pad.estatus_militante, pad.anios_militancia
FROM plancha_miembros pm
JOIN catalogo_cargos cc   ON pm.cargo_id     = cc.id
LEFT JOIN padron_maestro pad ON pm.cedula_titular = pad.cedula
ORDER BY cc.orden_display;

-- ============================================================
-- BLOQUE 10: DATOS SEMILLA - VALVERDE
-- ============================================================

INSERT INTO provincias (nombre, codigo) VALUES ('Valverde','VAL');

INSERT INTO municipios (nombre, tipo, provincia_id, es_regionalizado) VALUES
('Mao',           'MUNICIPIO',         1, TRUE),
('Esperanza',     'MUNICIPIO',         1, TRUE),
('Laguna Salada', 'MUNICIPIO',         1, FALSE),
('Amina',         'DISTRITO_MUNICIPAL',1, FALSE),
('Guatapanal',    'DISTRITO_MUNICIPAL',1, FALSE),
('Jaibón',        'DISTRITO_MUNICIPAL',1, FALSE),
('Potrero',       'DISTRITO_MUNICIPAL',1, FALSE);

INSERT INTO zonas (nombre, codigo, municipio_id, tipo) VALUES
('Zona A','MAO-ZA',1,'URBANA'),('Zona B','MAO-ZB',1,'URBANA'),
('Zona C','MAO-ZC',1,'URBANA'),('Zona D','MAO-ZD',1,'URBANA'),
('Zona E','MAO-ZE',1,'URBANA'),('Zona F','MAO-ZF',1,'URBANA'),
('Zona 1','ESP-Z1',2,'URBANA'),('Zona 2','ESP-Z2',2,'URBANA'),
('Zona 3','ESP-Z3',2,'URBANA'),('Zona Única','LAG-ZU',3,'URBANA');

INSERT INTO sectores (nombre, zona_id, tipo) VALUES
('Los Multis',    4,'BARRIO'),('Hatico',        4,'SECTOR'),
('El Enriquillo', 4,'BARRIO'),('San Antonio',   4,'SECTOR'),
('Sibila',        1,'SECTOR'),('Centro',        2,'SECTOR'),
('Batey Central', 7,'SECTOR'),('La Cuarenta',   7,'BARRIO');
