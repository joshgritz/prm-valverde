// ============================================================
// SISTEMA ELECTORAL PRM - PROVINCIA VALVERDE
// app.js — Lógica principal
// Conecta con Supabase | Estatutos PRM Arts. 89,96,117,154,155
// ============================================================

// ─────────────────────────────────────────────
// CONFIGURACIÓN SUPABASE
// Reemplaza estos valores con los tuyos de:
// supabase.com → Tu proyecto → Settings → API
// ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_KEY  = 'TU-ANON-PUBLIC-KEY';

// Cliente Supabase (se carga desde CDN en index.html)
let supabase = null;

// ─────────────────────────────────────────────
// ESTADO GLOBAL DE LA APLICACIÓN
// ─────────────────────────────────────────────
const estado = {
    // Sesión del usuario
    usuario: {
        id: null,
        nombre: 'Secretario Zonal',
        cedula: null,
        rol: 'SECRETARIO_ZONA',
        zona_id: null,
        zona_nombre: 'Zona D - Mao',
        municipio_id: 1,
        municipio_nombre: 'Mao',
    },
    // Plancha activa en edición
    planchaActiva: {
        id: null,
        codigo: null,
        zona_id: null,
        zona_nombre: null,
        nombre_plancha: '',
        miembros: {}  // { cargo_id: { cedula, nombre, sexo, edad, validado } }
    },
    // Datos cargados desde DB
    zonas: [],
    municipios: [],
    catalogoCargos: [],
    planchas: [],
    // UI
    modoEdicion: false,
    guardandoPlancha: false,
    // ── PADRÓN ELECTORAL (cargado desde JSON) ──
    padron: {
        cargado: false,
        totalMilitantes: 0,
        colegiosCargados: [],
        porCedula: {}   // índice: cedula → datos del militante con foto
    }
};

// Estructura territorial de Valverde (caché local)
const territorioValverde = {
    MAO: {
        id: 1, tipo: 'MUNICIPIO',
        zonas: [
            { id:1, nombre:'Zona A', codigo:'MAO-ZA' },
            { id:2, nombre:'Zona B', codigo:'MAO-ZB' },
            { id:3, nombre:'Zona C', codigo:'MAO-ZC' },
            { id:4, nombre:'Zona D', codigo:'MAO-ZD' },
            { id:5, nombre:'Zona E', codigo:'MAO-ZE' },
            { id:6, nombre:'Zona F', codigo:'MAO-ZF' },
        ]
    },
    ESPERANZA: {
        id: 2, tipo: 'MUNICIPIO',
        zonas: [
            { id:7, nombre:'Zona 1', codigo:'ESP-Z1' },
            { id:8, nombre:'Zona 2', codigo:'ESP-Z2' },
            { id:9, nombre:'Zona 3', codigo:'ESP-Z3' },
        ]
    },
    LAGUNA_SALADA: {
        id: 3, tipo: 'MUNICIPIO',
        zonas: [{ id:10, nombre:'Zona Única', codigo:'LAG-ZU' }]
    },
    AMINA:       { id:4, tipo:'DISTRITO_MUNICIPAL', zonas:[] },
    GUATAPANAL:  { id:5, tipo:'DISTRITO_MUNICIPAL', zonas:[] },
    JAIBON:      { id:6, tipo:'DISTRITO_MUNICIPAL', zonas:[] },
    POTRERO:     { id:7, tipo:'DISTRITO_MUNICIPAL', zonas:[] },
};

// Cargos del Comité Zonal — espejo del catálogo_cargos (Arts. 96 + 117)
const cargosZonales = [
    // Alta Dirección
    { id:1,  nombre:'Presidente(a) de Zona',           categoria:'ALTA_DIRECCION',   obligatorio:true },
    { id:2,  nombre:'1er Vicepresidente(a)',             categoria:'ALTA_DIRECCION',   obligatorio:true },
    { id:3,  nombre:'2do Vicepresidente(a)',             categoria:'ALTA_DIRECCION',   obligatorio:true },
    { id:4,  nombre:'3er Vicepresidente(a)',             categoria:'ALTA_DIRECCION',   obligatorio:true },
    { id:5,  nombre:'Secretario(a) General',            categoria:'ALTA_DIRECCION',   obligatorio:true },
    { id:6,  nombre:'1er Subsecretario(a) General',     categoria:'ALTA_DIRECCION',   obligatorio:true },
    { id:7,  nombre:'2do Subsecretario(a) General',     categoria:'ALTA_DIRECCION',   obligatorio:true },
    { id:8,  nombre:'3er Subsecretario(a) General',     categoria:'ALTA_DIRECCION',   obligatorio:true },
    // Secretarías
    { id:9,  nombre:'Secretario(a) de Organización',   categoria:'SECRETARIA',       obligatorio:true  },
    { id:10, nombre:'Secretario(a) Electoral',          categoria:'SECRETARIA',       obligatorio:true  },
    { id:11, nombre:'Secretario(a) de Educación',       categoria:'SECRETARIA',       obligatorio:true  },
    { id:12, nombre:'Secretario(a) de Finanzas',        categoria:'SECRETARIA',       obligatorio:true  },
    { id:13, nombre:'Secretario(a) de Comunicación',    categoria:'SECRETARIA',       obligatorio:true  },
    { id:14, nombre:'Secretario(a) de Tecnología',      categoria:'SECRETARIA',       obligatorio:false },
    { id:15, nombre:'Secretario(a) de Asuntos Munic.',  categoria:'SECRETARIA',       obligatorio:true  },
    { id:16, nombre:'Secretario(a) de Actas',           categoria:'SECRETARIA',       obligatorio:true  },
    // Frentes Sectoriales
    { id:17, nombre:'Presidenta — Frente de Mujeres',   categoria:'FRENTE_SECTORIAL', obligatorio:true  },
    { id:18, nombre:'Presidente — Frente de Juventud',  categoria:'FRENTE_SECTORIAL', obligatorio:true  },
    { id:19, nombre:'Pdte. Frente Magisterial',         categoria:'FRENTE_SECTORIAL', obligatorio:false },
    { id:20, nombre:'Pdte. Frente Agropecuario',        categoria:'FRENTE_SECTORIAL', obligatorio:false },
    { id:21, nombre:'Pdte. Frente de Salud',            categoria:'FRENTE_SECTORIAL', obligatorio:false },
];

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    inicializarSupabase();
    inicializarInterfaz();
    mostrarModulo('buscador');
    actualizarStatusPadron();
});

function inicializarSupabase() {
    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase conectado');
        } else {
            console.warn('⚠️ Supabase no cargado aún. Revisá el CDN en index.html.');
        }
    } catch(e) {
        console.error('❌ Error al conectar Supabase:', e);
    }
}

function inicializarInterfaz() {
    const el = document.getElementById('display-demarcacion');
    if (el) el.textContent = `Valverde · ${estado.usuario.zona_nombre}`;
    cargarZonas();
}

// ─────────────────────────────────────────────
// NAVEGACIÓN DE MÓDULOS Y TABS
// ─────────────────────────────────────────────
function mostrarModulo(nombre) {
    document.querySelectorAll('.modulo-vista').forEach(m => m.classList.add('hidden'));
    const mod = document.getElementById(`mod-${nombre}`);
    if (mod) mod.classList.remove('hidden');

    // Acciones al entrar a un módulo
    if (nombre === 'dirigentes') {
        cargarListaPlanchas();
        renderTablaPlanchas();
    }
    if (nombre === 'reportes') {
        renderReportes();
    }
}

// Alias para el HTML existente
const appElectoral = {
    mostrarModulo,
    tabZona,
    formatearCedula,
    cargarZonas,
    buscar: buscarPersona,
    limpiarPlancha,
    guardarPlancha,
    abrirInscripcionPlancha,
    abrirRegistroVotante,
    generarReportePlancha: renderReportes,
};

function tabZona(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`zona-${tabId}`);
    if (target) target.classList.remove('hidden');

    // Actualizar estilos de botones tab
    document.querySelectorAll('.btn-tab-zona').forEach(btn => {
        const activo = btn.dataset.tab === tabId;
        btn.className = activo
            ? 'btn-tab-zona bg-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-sm text-blue-600 border-2 border-blue-400 transition-all'
            : 'btn-tab-zona px-6 py-3 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-white/50 transition-all';
    });

    // Cargar contenido del tab
    if (tabId === 'inscripcion') {
        renderFormularioPlancha();
    }
}

// ─────────────────────────────────────────────
// CÉDULA — FORMATEO Y VALIDACIÓN
// ─────────────────────────────────────────────
function formatearCedula(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    let f = '';
    if (v.length > 0) f += v.slice(0, 3);
    if (v.length > 3) f += '-' + v.slice(3, 10);
    if (v.length > 10) f += '-' + v.slice(10, 11);
    input.value = f;
}

function cedulaLimpia(cedula) {
    return cedula.replace(/\D/g, '');
}

function cedulaValida(cedula) {
    return cedulaLimpia(cedula).length === 11;
}

// ─────────────────────────────────────────────
// SELECTORES TERRITORIALES
// ─────────────────────────────────────────────
function cargarZonas() {
    const municipioKey = (document.getElementById('select-municipio')?.value) || 'MAO';
    const zonaSelect   = document.getElementById('select-zona');
    const sectorSelect = document.getElementById('select-sector');
    if (!zonaSelect) return;

    const muni = territorioValverde[municipioKey];
    zonaSelect.innerHTML = '<option value="TODAS">Todas las Zonas</option>';
    if (sectorSelect) sectorSelect.innerHTML = '<option value="TODOS">Todos los Sectores</option>';

    if (muni && muni.zonas) {
        muni.zonas.forEach(z => {
            zonaSelect.innerHTML += `<option value="${z.id}">${z.nombre}</option>`;
        });
    }

    const nombreMuni = municipioKey.replace('_', ' ');
    const el = document.getElementById('display-demarcacion');
    if (el) el.textContent = `Valverde · ${nombreMuni}`;
}

// ─────────────────────────────────────────────
// BUSCADOR DE PADRÓN
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// MÓDULO: CARGA DE PADRÓN DESDE JSON
// ─────────────────────────────────────────────

function abrirCargadorPadron() {
    document.getElementById('padron-file-input').click();
}

async function cargarPadronJSON(event) {
    const files = event.target.files;
    if (!files.length) return;

    const btnCargar = document.getElementById('btn-cargar-padron');
    const statusEl  = document.getElementById('padron-status');

    if (btnCargar) btnCargar.disabled = true;
    if (statusEl)  statusEl.textContent = 'Cargando...';

    let totalNuevos = 0;

    for (const file of files) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const militantes = data.militantes || [];

            for (const m of militantes) {
                if (m.cedula) {
                    estado.padron.porCedula[m.cedula] = m;
                    totalNuevos++;
                }
            }

            const colegio = data.colegio_info?.colegio || file.name;
            if (!estado.padron.colegiosCargados.includes(colegio)) {
                estado.padron.colegiosCargados.push(colegio);
            }
        } catch(e) {
            console.error('Error leyendo JSON:', file.name, e);
        }
    }

    estado.padron.totalMilitantes = Object.keys(estado.padron.porCedula).length;
    estado.padron.cargado = true;

    // Actualizar UI
    actualizarStatusPadron();
    if (statusEl) statusEl.textContent = `✅ ${estado.padron.totalMilitantes.toLocaleString()} militantes cargados (${estado.padron.colegiosCargados.length} colegios)`;
    if (btnCargar) btnCargar.disabled = false;

    // Actualizar stat card
    const totalEl = document.getElementById('total-inscritos');
    if (totalEl) totalEl.textContent = estado.padron.totalMilitantes.toLocaleString();

    // Reset input for re-use
    event.target.value = '';
}

function actualizarStatusPadron() {
    const badge = document.getElementById('padron-badge');
    const count  = document.getElementById('padron-count');
    if (!badge) return;

    if (estado.padron.cargado && estado.padron.totalMilitantes > 0) {
        badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700';
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span> PADRÓN ACTIVO`;
        if (count) count.textContent = estado.padron.totalMilitantes.toLocaleString();
    } else {
        badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-600';
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span> SIN PADRÓN`;
        if (count) count.textContent = '0';
    }
}

function buscarEnPadronLocal(cedula) {
    const cedLimpia = cedula.replace(/\D/g, '');
    // Búsqueda con guiones
    const cedFormateada = cedLimpia.length === 11
        ? `${cedLimpia.slice(0,3)}-${cedLimpia.slice(3,10)}-${cedLimpia.slice(10)}`
        : cedula;
    return estado.padron.porCedula[cedFormateada] || estado.padron.porCedula[cedula] || null;
}

// ─────────────────────────────────────────────
// BÚSQUEDA DE PERSONA (con padrón real)
// ─────────────────────────────────────────────

async function buscarPersona() {
    const inputEl = document.getElementById('input-cedula');
    const cedula  = inputEl?.value?.trim() || '';

    if (!cedula || cedula.replace(/\D/g,'').length < 11) {
        mostrarAlerta('Ingresa una cédula válida de 11 dígitos.', 'error');
        return;
    }

    const perfil = document.getElementById('perfil-votante');
    if (perfil) perfil.classList.add('opacity-50');

    try {
        let datos = null;

        // 1. Buscar primero en padrón local (JSON cargado)
        const local = buscarEnPadronLocal(cedula);
        if (local) {
            datos = normalizarDatosPadron(local);
        }

        // 2. Si no está en local, intentar Supabase
        if (!datos && supabase) {
            const { data, error } = await supabase
                .from('padron_maestro')
                .select('*')
                .eq('cedula', cedula.replace(/\D/g,'').replace(/(\d{3})(\d{7})(\d)/,'$1-$2-$3'))
                .single();
            if (!error && data) datos = normalizarDatosSupabase(data);
        }

        if (datos) {
            renderPerfilVotante(datos);
        } else {
            if (perfil) perfil.classList.add('hidden');
            const msg = estado.padron.cargado
                ? 'Cédula no encontrada en el padrón cargado. Verifica el número.'
                : 'Padrón no cargado. Usa el botón "Cargar Padrón" para subir los archivos JSON.';
            mostrarAlerta(msg, 'advertencia');
        }

    } catch(e) {
        console.error(e);
        mostrarAlerta('Error al buscar. Intenta de nuevo.', 'error');
    } finally {
        if (perfil) perfil.classList.remove('opacity-50');
    }
}

function normalizarDatosPadron(m) {
    // Convierte datos del padrón JSON al formato que espera renderPerfilVotante
    const partes = (m.nombre || '').trim().split(' ');
    // Formato: APELLIDO APELLIDO, NOMBRE NOMBRE  (coma separa apellidos de nombres)
    let apellido = '', nombre = '';
    const coma = m.nombre?.indexOf(',');
    if (coma > -1) {
        apellido = m.nombre.substring(0, coma).trim();
        nombre   = m.nombre.substring(coma + 1).trim();
    } else {
        // Sin coma: primeras 2 palabras = apellidos, resto = nombres
        apellido = partes.slice(0, 2).join(' ');
        nombre   = partes.slice(2).join(' ') || partes[0];
    }

    return {
        cedula:             m.cedula,
        nombre:             nombre,
        apellido:           apellido,
        nombre_completo:    m.nombre,
        telefono:           m.telefono || '',
        direccion:          m.direccion || '',
        foto_b64:           m.foto_b64 || null,
        voto:               m.voto || '',
        exterior:           m.exterior || false,
        concurrencia:       m.concurrencia || [],
        colegio_electoral:  m.colegio || '',
        recinto:            (m.recinto || '').replace(/^\d{4}\s+Rec:\s+\d+\s+-\s+/, ''),
        zonas:              { nombre: '—' },
        sectores:           { nombre: m.direccion || '—' },
        fidelidad:          m.concurrencia?.includes('2016') ? 'DURO' : 'BLANDO',
        estatus_militante:  'ACTIVO',
        anios_militancia:   null,
        // raw para info extra
        _raw: m
    };
}

function normalizarDatosSupabase(data) {
    return {
        ...data,
        nombre_completo: `${data.nombre || ''} ${data.apellido || ''}`.trim(),
        foto_b64: null,
    };
}

function renderPerfilVotante(datos) {
    const perfil = document.getElementById('perfil-votante');
    if (!perfil) return;
    perfil.classList.remove('hidden');

    const edad = datos.fecha_nacimiento
        ? Math.floor((Date.now() - new Date(datos.fecha_nacimiento)) / 31557600000)
        : '—';

    document.getElementById('res-nombre').textContent  = datos.nombre_completo || `${datos.nombre || ''} ${datos.apellido || ''}`.trim();
    document.getElementById('res-cedula-display').textContent = datos.cedula;
    document.getElementById('res-zona').textContent    = datos.zonas?.nombre || '—';
    document.getElementById('res-recinto').textContent = datos.recinto || '—';
    document.getElementById('res-colegio').textContent = datos.colegio_electoral || '—';
    document.getElementById('res-bloque').textContent  = datos.sectores?.nombre || '—';

    // Foto: primero foto real del padrón, luego avatar generado
    const foto = document.getElementById('res-foto');
    if (foto) {
        if (datos.foto_b64) {
            foto.src = `data:image/jpeg;base64,${datos.foto_b64}`;
        } else if (datos.foto_url) {
            foto.src = datos.foto_url;
        } else {
            const nombreAvatar = encodeURIComponent(`${datos.nombre} ${datos.apellido}`);
            foto.src = `https://ui-avatars.com/api/?name=${nombreAvatar}&background=003da5&color=fff&size=200`;
        }
    }

    // Datos extra del padrón
    const telEl = document.getElementById('res-telefono');
    if (telEl) telEl.textContent = datos.telefono || '—';
    const dirEl = document.getElementById('res-direccion');
    if (dirEl) dirEl.textContent = datos.direccion || '—';

    // Badges de concurrencia y voto
    const concEl = document.getElementById('res-concurrencia');
    if (concEl) {
        const conc = datos.concurrencia || [];
        concEl.innerHTML = conc.length
            ? conc.map(y => `<span class="inline-block bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full mr-1">${y}</span>`).join('')
            : '<span class="text-slate-400 text-xs">Sin historial</span>';
    }
    const votoEl = document.getElementById('res-tipo-voto');
    if (votoEl) {
        const v = datos.voto || datos._raw?.voto || '';
        votoEl.textContent = v === 'PA' ? 'Primaria Abierta' : v === 'PC' ? 'Primaria Cerrada' : '—';
    }

    const tag = document.getElementById('tag-fidelidad');
    if (tag) {
        const colores = { DURO:'bg-green-500', BLANDO:'bg-yellow-500', INDECISO:'bg-orange-400', OPOSICION:'bg-red-500' };
        tag.textContent = `VOTO ${datos.fidelidad || 'SIN DATOS'}`;
        tag.className   = `absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-black text-white ${colores[datos.fidelidad] || 'bg-slate-400'}`;
    }
}

// ─────────────────────────────────────────────
// MÓDULO: INSCRIPCIÓN DE PLANCHAS ZONALES
// ─────────────────────────────────────────────

// Renderiza el formulario de plancha completo
function renderFormularioPlancha() {
    const zonaActual = estado.usuario.zona_nombre;

    // Actualizar título con la zona
    const tituloZona = document.getElementById('titulo-zona-plancha');
    if (tituloZona) tituloZona.textContent = zonaActual;

    // Renderizar secciones de cargos
    renderSeccionCargos('alta-direccion-cargos', 'ALTA_DIRECCION');
    renderSeccionCargos('secretarias-cargos',    'SECRETARIA');
    renderSeccionCargos('frentes-cargos',         'FRENTE_SECTORIAL');

    // Actualizar indicadores de cuotas
    actualizarPanelCuotas();
}

function renderSeccionCargos(contenedorId, categoria) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const cargos = cargosZonales.filter(c => c.categoria === categoria);
    contenedor.innerHTML = '';

    cargos.forEach(cargo => {
        const miembro = estado.planchaActiva.miembros[cargo.id];
        const validado = miembro?.validado;
        const nombre   = miembro?.nombre || '';

        contenedor.innerHTML += `
        <div class="cargo-item group relative bg-white rounded-2xl border-2 ${validado ? 'border-green-400 bg-green-50/30' : 'border-slate-200'} p-4 transition-all hover:border-blue-300"
             data-cargo-id="${cargo.id}">
            
            <!-- Obligatorio badge -->
            ${cargo.obligatorio ? '' : '<span class="absolute top-3 right-3 text-[8px] font-black text-slate-300 uppercase">Opcional</span>'}
            
            <!-- Label del cargo -->
            <label class="block text-[9px] font-black uppercase tracking-wider mb-2 ${validado ? 'text-green-700' : 'text-blue-700'}">
                ${cargo.nombre}
            </label>
            
            <!-- Input de cédula + botón validar -->
            <div class="flex gap-2 items-center">
                <div class="relative flex-1">
                    <input 
                        type="text" 
                        id="cedula-cargo-${cargo.id}"
                        placeholder="000-0000000-0"
                        value="${miembro?.cedula || ''}"
                        oninput="formatearCedula(this); autoValidarCargo(${cargo.id})"
                        class="w-full pl-3 pr-8 py-2.5 rounded-xl border-2 font-mono text-sm outline-none transition-all
                               ${validado 
                                 ? 'border-green-400 bg-green-50 text-green-800' 
                                 : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}"
                    >
                    ${validado 
                        ? '<i class="fa-solid fa-circle-check absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500 text-sm"></i>'
                        : ''}
                </div>
                <button 
                    onclick="validarCargo(${cargo.id})"
                    class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl text-white text-sm transition-all
                           ${validado ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}">
                    <i class="fa-solid ${validado ? 'fa-check' : 'fa-search'}"></i>
                </button>
            </div>
            
            <!-- Resultado de la validación -->
            <div id="resultado-cargo-${cargo.id}" class="${nombre ? '' : 'hidden'} mt-3 flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100">
                <img 
                    src="${miembro?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=003da5&color=fff&size=64`}"
                    class="w-10 h-10 rounded-full object-cover border-2 border-slate-200 flex-shrink-0"
                >
                <div class="min-w-0">
                    <p class="text-xs font-black text-slate-800 truncate">${nombre}</p>
                    <p class="text-[9px] text-slate-400 font-bold">
                        ${miembro?.sexo === 'F' ? '♀ Mujer' : miembro?.sexo === 'M' ? '♂ Hombre' : ''}
                        ${miembro?.edad ? `· ${miembro.edad} años` : ''}
                        ${miembro?.militancia ? `· ${miembro.militancia} años PRM` : ''}
                    </p>
                </div>
            </div>

            <!-- Error de validación -->
            <div id="error-cargo-${cargo.id}" class="hidden mt-2 text-[9px] font-bold text-red-600 flex items-center gap-1">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span></span>
            </div>
        </div>`;
    });
}

// Validación en tiempo real al escribir (auto-valida cuando la cédula está completa)
function autoValidarCargo(cargoId) {
    const input  = document.getElementById(`cedula-cargo-${cargoId}`);
    if (cedulaValida(input.value)) {
        validarCargo(cargoId);
    } else {
        // Limpiar resultado si borraron la cédula
        const resultado = document.getElementById(`resultado-cargo-${cargoId}`);
        const error     = document.getElementById(`error-cargo-${cargoId}`);
        if (resultado) resultado.classList.add('hidden');
        if (error)     error.classList.add('hidden');
    }
}

async function validarCargo(cargoId) {
    const input  = document.getElementById(`cedula-cargo-${cargoId}`);
    const cedula = input?.value || '';

    if (!cedulaValida(cedula)) {
        mostrarErrorCargo(cargoId, 'Cédula incompleta (11 dígitos requeridos)');
        return;
    }

    // Verificar duplicado en la misma plancha
    const cedulaLimpiada = cedulaLimpia(cedula);
    for (const [id, miembro] of Object.entries(estado.planchaActiva.miembros)) {
        if (parseInt(id) !== cargoId && miembro.cedula_limpia === cedulaLimpiada && miembro.validado) {
            mostrarErrorCargo(cargoId, `Esta cédula ya está inscrita como "${cargosZonales.find(c=>c.id===parseInt(id))?.nombre}"`);
            return;
        }
    }

    // Mostrar spinner
    input.classList.add('opacity-50');

    try {
        let persona = null;

        if (supabase) {
            const { data } = await supabase
                .from('padron_maestro')
                .select('cedula, nombre, apellido, sexo, fecha_nacimiento, anios_militancia, estatus_militante, foto_url')
                .eq('cedula', cedulaLimpiada)
                .single();
            if (data) persona = data;
        }

        // Simulación si no hay DB
        if (!persona) {
            persona = generarPersonaSimulada(cedula, cargoId);
        }

        // Validar militancia mínima (Art. 151: 3 años en niveles locales)
        const militanciaReq = 3;
        if (persona.anios_militancia < militanciaReq && persona.estatus_militante !== 'ACTIVO_SIMULADO') {
            mostrarErrorCargo(cargoId, `Militancia insuficiente: ${persona.anios_militancia} año(s). Se requieren ${militanciaReq} (Art. 151)`);
            input.classList.remove('opacity-50');
            return;
        }

        const edad = calcularEdad(persona.fecha_nacimiento);

        // Guardar en estado
        estado.planchaActiva.miembros[cargoId] = {
            cedula:       cedulaLimpiada,
            cedula_limpia: cedulaLimpiada,
            nombre:       `${persona.nombre} ${persona.apellido}`,
            sexo:         persona.sexo,
            edad:         edad,
            militancia:   persona.anios_militancia || '3+',
            foto:         persona.foto_url || null,
            validado:     true,
        };

        // Actualizar UI del cargo
        actualizarUICargo(cargoId, estado.planchaActiva.miembros[cargoId]);

        // Recalcular cuotas en tiempo real
        actualizarPanelCuotas();

    } catch(e) {
        console.error(e);
        mostrarErrorCargo(cargoId, 'Error al consultar el padrón. Reintenta.');
    } finally {
        input.classList.remove('opacity-50');
    }
}

function generarPersonaSimulada(cedula, cargoId) {
    // Simulación realista para desarrollo sin DB conectada
    const nombres = ['ROSA','JUAN','MARIA','PEDRO','ANA','LUIS','CARMEN','JOSE','FRANCISCA','RAFAEL'];
    const apellidos = ['PEREZ','GARCIA','SANTOS','MARTINEZ','RODRIGUEZ','JIMENEZ','MARTE','FELIZ'];
    const hash = cedulaLimpia(cedula).split('').reduce((a,b) => a + parseInt(b), 0);
    const sexo = cargoId === 17 ? 'F' : (hash % 2 === 0 ? 'M' : 'F'); // Frente Mujeres = F
    const nombre = nombres[hash % nombres.length];
    const apellido = `${apellidos[hash % apellidos.length]} ${apellidos[(hash+3) % apellidos.length]}`;
    const anioNac = 1970 + (hash % 30);
    return {
        cedula: cedulaLimpia(cedula),
        nombre, apellido, sexo,
        fecha_nacimiento: `${anioNac}-03-15`,
        anios_militancia: 3 + (hash % 8),
        estatus_militante: 'ACTIVO_SIMULADO',
        foto_url: null
    };
}

function calcularEdad(fechaNac) {
    if (!fechaNac) return 35;
    const hoy = new Date();
    const nac = new Date(fechaNac);
    return Math.floor((hoy - nac) / 31557600000);
}

function actualizarUICargo(cargoId, miembro) {
    const item      = document.querySelector(`[data-cargo-id="${cargoId}"]`);
    const resultado = document.getElementById(`resultado-cargo-${cargoId}`);
    const error     = document.getElementById(`error-cargo-${cargoId}`);
    const input     = document.getElementById(`cedula-cargo-${cargoId}`);

    if (error) error.classList.add('hidden');

    if (resultado) {
        resultado.classList.remove('hidden');
        const img  = resultado.querySelector('img');
        const p1   = resultado.querySelectorAll('p')[0];
        const p2   = resultado.querySelectorAll('p')[1];
        if (img) img.src = miembro.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(miembro.nombre)}&background=003da5&color=fff&size=64`;
        if (p1)  p1.textContent = miembro.nombre;
        if (p2)  p2.textContent = `${miembro.sexo === 'F' ? '♀ Mujer' : '♂ Hombre'} · ${miembro.edad} años · ${miembro.militancia} años PRM`;
    }

    if (item) {
        item.classList.remove('border-slate-200', 'border-red-300');
        item.classList.add('border-green-400', 'bg-green-50/30');
    }

    if (input) {
        input.classList.remove('border-slate-200', 'border-red-300', 'focus:border-blue-500');
        input.classList.add('border-green-400', 'bg-green-50', 'text-green-800');
        // Agregar ícono de check
        const checkExistente = input.parentElement.querySelector('.fa-circle-check');
        if (!checkExistente) {
            const check = document.createElement('i');
            check.className = 'fa-solid fa-circle-check absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500 text-sm';
            input.parentElement.appendChild(check);
        }
    }
}

function mostrarErrorCargo(cargoId, mensaje) {
    const errorEl = document.getElementById(`error-cargo-${cargoId}`);
    const item    = document.querySelector(`[data-cargo-id="${cargoId}"]`);
    const input   = document.getElementById(`cedula-cargo-${cargoId}`);

    if (errorEl) {
        errorEl.classList.remove('hidden');
        errorEl.querySelector('span').textContent = mensaje;
    }
    if (item) {
        item.classList.remove('border-green-400');
        item.classList.add('border-red-300');
    }
    if (input) {
        input.classList.add('border-red-400');
    }

    // Eliminar del estado si estaba antes
    delete estado.planchaActiva.miembros[cargoId];
    actualizarPanelCuotas();
}

// ─────────────────────────────────────────────
// PANEL DE CUOTAS — Validación estatutaria en vivo
// ─────────────────────────────────────────────
function actualizarPanelCuotas() {
    const miembros = Object.values(estado.planchaActiva.miembros).filter(m => m.validado);
    const total    = miembros.length;
    const mujeres  = miembros.filter(m => m.sexo === 'F').length;
    const hombres  = total - mujeres;
    const jovenes  = miembros.filter(m => m.edad >= 18 && m.edad <= 35).length;

    const pctMujeres = total > 0 ? Math.round((mujeres / total) * 100) : 0;
    const pctJovenes = total > 0 ? Math.round((jovenes / total) * 100) : 0;

    // Art. 155: ningún género < 40% ni > 60%
    const generoOK = pctMujeres >= 40 && pctMujeres <= 60;
    // Art. 154: mínimo 10% jóvenes (18-35)
    const juventudOK = pctJovenes >= 10;

    // Actualizar contadores
    setTexto('cuota-total-count',   total);
    setTexto('cuota-mujeres-count', mujeres);
    setTexto('cuota-hombres-count', hombres);
    setTexto('cuota-jovenes-count', jovenes);
    setTexto('cuota-pct-mujeres',   `${pctMujeres}%`);
    setTexto('cuota-pct-jovenes',   `${pctJovenes}%`);

    // Barras de progreso
    setBarra('barra-mujeres', pctMujeres, generoOK);
    setBarra('barra-jovenes', pctJovenes >= 10 ? pctJovenes : pctJovenes, juventudOK);

    // Indicadores de estado
    setIndicador('indicador-genero',   generoOK,  'Art. 155: 40–60% género');
    setIndicador('indicador-juventud', juventudOK,'Art. 154: mín. 10% jóvenes');

    // Botón guardar habilitado solo si cuotas OK
    const btnGuardar = document.getElementById('btn-guardar-plancha');
    if (btnGuardar) {
        const cargosObligatoriosOK = verificarCargosObligatorios();
        const listo = generoOK && juventudOK && cargosObligatoriosOK;
        btnGuardar.disabled = !listo;
        btnGuardar.classList.toggle('opacity-50', !listo);
        btnGuardar.classList.toggle('cursor-not-allowed', !listo);
    }

    // Panel de alerta de cuota
    const alertaGenero = document.getElementById('alerta-cuota-genero');
    if (alertaGenero) {
        alertaGenero.classList.toggle('hidden', generoOK || total === 0);
        const msgEl = alertaGenero.querySelector('.mensaje-cuota');
        if (msgEl && !generoOK && total > 0) {
            if (pctMujeres < 40) {
                msgEl.textContent = `Faltan mujeres: tienes ${pctMujeres}%, necesitas mínimo 40% (Art. 155)`;
            } else {
                msgEl.textContent = `Demasiadas mujeres: tienes ${pctMujeres}%, máximo 60% (Art. 155)`;
            }
        }
    }
}

function verificarCargosObligatorios() {
    const obligatorios = cargosZonales.filter(c => c.obligatorio);
    return obligatorios.every(c => estado.planchaActiva.miembros[c.id]?.validado);
}

function setTexto(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
}

function setBarra(id, pct, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = `${Math.min(pct, 100)}%`;
    el.className = `h-full rounded-full transition-all duration-500 ${ok ? 'bg-green-500' : pct > 0 ? 'bg-yellow-400' : 'bg-slate-200'}`;
}

function setIndicador(id, ok, texto) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `flex items-center gap-2 p-3 rounded-xl transition-all ${ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`;
    el.innerHTML = `
        <div class="w-3 h-3 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500 animate-pulse'}"></div>
        <span class="text-[10px] font-black uppercase ${ok ? 'text-green-700' : 'text-red-700'}">${texto}: ${ok ? 'CUMPLIDO ✓' : 'INCUMPLIDO ✗'}</span>`;
}

// ─────────────────────────────────────────────
// GUARDAR / LIMPIAR PLANCHA
// ─────────────────────────────────────────────
async function guardarPlancha() {
    if (estado.guardandoPlancha) return;

    const miembros = Object.values(estado.planchaActiva.miembros).filter(m => m.validado);

    if (miembros.length === 0) {
        mostrarAlerta('Debes registrar al menos un miembro para guardar.', 'error');
        return;
    }

    if (!verificarCargosObligatorios()) {
        mostrarAlerta('Faltan cargos obligatorios. Revisa la plancha.', 'error');
        return;
    }

    estado.guardandoPlancha = true;
    const btnGuardar = document.getElementById('btn-guardar-plancha');
    if (btnGuardar) btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Guardando...';

    try {
        const zonaId      = estado.usuario.zona_id || 4;
        const municipioId = estado.usuario.municipio_id || 1;
        const timestamp   = Date.now();
        const codigo      = `VAL-MAO-Z${zonaId}-${new Date().getFullYear()}-${String(timestamp).slice(-3)}`;

        let planchaId = estado.planchaActiva.id;

        if (supabase) {
            // Crear o actualizar plancha en Supabase
            const planchaData = {
                codigo,
                nombre_plancha: estado.planchaActiva.nombre_plancha || `Plancha ${estado.usuario.zona_nombre}`,
                nivel:         'ZONA',
                zona_id:        zonaId,
                municipio_id:   municipioId,
                provincia_id:   1,
                estatus:       'BORRADOR',
            };

            if (!planchaId) {
                const { data, error } = await supabase.from('planchas').insert(planchaData).select().single();
                if (error) throw error;
                planchaId = data.id;
            } else {
                await supabase.from('planchas').update({ ...planchaData, actualizado_en: new Date() }).eq('id', planchaId);
            }

            // Insertar miembros
            for (const [cargoId, miembro] of Object.entries(estado.planchaActiva.miembros)) {
                if (!miembro.validado) continue;
                await supabase.from('plancha_miembros').upsert({
                    plancha_id:     planchaId,
                    cargo_id:       parseInt(cargoId),
                    cedula_titular: miembro.cedula,
                    nombre_titular: miembro.nombre,
                    sexo_titular:   miembro.sexo,
                    edad_titular:   miembro.edad,
                    validado:       true,
                    posicion:       parseInt(cargoId),
                }, { onConflict: 'plancha_id,cargo_id' });
            }
        } else {
            // Guardar en localStorage como fallback
            planchaId = `LOCAL-${timestamp}`;
            const planchasLocales = JSON.parse(localStorage.getItem('prm_planchas') || '[]');
            const nuevaPlancha = {
                id: planchaId, codigo,
                nombre_plancha: `Plancha ${estado.usuario.zona_nombre}`,
                zona_nombre: estado.usuario.zona_nombre,
                estatus: 'BORRADOR',
                miembros: estado.planchaActiva.miembros,
                creado_en: new Date().toISOString(),
            };
            planchasLocales.push(nuevaPlancha);
            localStorage.setItem('prm_planchas', JSON.stringify(planchasLocales));
        }

        estado.planchaActiva.id     = planchaId;
        estado.planchaActiva.codigo = codigo;

        mostrarAlerta(`✅ Plancha guardada con código: ${codigo}`, 'exito');
        renderTablaPlanchas();

    } catch(e) {
        console.error('Error guardando plancha:', e);
        mostrarAlerta('Error al guardar. Revisa la conexión con Supabase.', 'error');
    } finally {
        estado.guardandoPlancha = false;
        if (btnGuardar) btnGuardar.innerHTML = '<i class="fa-solid fa-save mr-2"></i> Registrar Plancha';
    }
}

function limpiarPlancha() {
    if (!confirm('¿Seguro que quieres limpiar todos los campos?')) return;
    estado.planchaActiva = { id: null, codigo: null, zona_id: null, zona_nombre: null, nombre_plancha: '', miembros: {} };
    renderFormularioPlancha();
    actualizarPanelCuotas();
}

// ─────────────────────────────────────────────
// TABLA DE PLANCHAS REGISTRADAS
// ─────────────────────────────────────────────
async function cargarListaPlanchas() {
    try {
        if (supabase) {
            const { data } = await supabase
                .from('v_planchas_resumen')
                .select('*')
                .order('creado_en', { ascending: false });
            if (data) estado.planchas = data;
        } else {
            estado.planchas = JSON.parse(localStorage.getItem('prm_planchas') || '[]');
        }
    } catch(e) {
        estado.planchas = [];
    }
    renderTablaPlanchas();
}

function renderTablaPlanchas() {
    const tbody = document.getElementById('tabla-planchas-body');
    if (!tbody) return;

    const planchas = estado.planchas;

    if (planchas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 text-sm">No hay planchas registradas aún.</td></tr>`;
        return;
    }

    tbody.innerHTML = planchas.map(p => {
        const estatutosOK = p.cuota_genero_ok && p.cuota_juventud_ok;
        const estatusBadge = {
            BORRADOR:    'bg-slate-100 text-slate-600',
            PENDIENTE:   'bg-yellow-100 text-yellow-700',
            VALIDADA:    'bg-green-100 text-green-700',
            RECHAZADA:   'bg-red-100 text-red-700',
            PROCLAMADA:  'bg-blue-100 text-blue-700',
        }[p.estatus] || 'bg-slate-100 text-slate-600';

        return `<tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
            <td class="p-4">
                <div class="font-black text-slate-800 text-sm uppercase">${p.nombre_plancha || 'Sin nombre'}</div>
                <div class="text-[9px] text-blue-600 font-bold font-mono">${p.codigo || p.id}</div>
                <div class="text-[9px] text-slate-400">${p.zona || p.zona_nombre || '—'}</div>
            </td>
            <td class="p-4">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${estatusBadge}">${p.estatus}</span>
            </td>
            <td class="p-4">
                <div class="text-sm font-black text-slate-800">${p.total_miembros || Object.keys(p.miembros||{}).length}</div>
                <div class="text-[9px] text-slate-400">${p.total_mujeres || 0}M / ${p.total_hombres || 0}H · ${p.total_jovenes || 0} jóvenes</div>
            </td>
            <td class="p-4">
                ${estatutosOK
                    ? '<span class="text-green-600 font-black text-[10px]"><i class="fa-solid fa-check mr-1"></i>CUMPLE</span>'
                    : '<span class="text-red-500 font-black text-[10px]"><i class="fa-solid fa-xmark mr-1"></i>INCUMPLE</span>'}
            </td>
            <td class="p-4">
                <div class="flex gap-1 justify-center">
                    <button onclick="editarPlancha('${p.id}')" class="w-9 h-9 flex items-center justify-center text-blue-600 hover:bg-blue-100 rounded-xl transition-all" title="Editar">
                        <i class="fa-solid fa-pen-to-square text-sm"></i>
                    </button>
                    <button onclick="eliminarPlancha('${p.id}')" class="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-100 rounded-xl transition-all" title="Eliminar">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function editarPlancha(id) {
    const plancha = estado.planchas.find(p => p.id === id);
    if (plancha) {
        estado.planchaActiva = {
            id: plancha.id,
            codigo: plancha.codigo,
            nombre_plancha: plancha.nombre_plancha,
            miembros: plancha.miembros || {},
        };
        tabZona('inscripcion');
        renderFormularioPlancha();
        mostrarAlerta('Plancha cargada para edición.', 'info');
    }
}

async function eliminarPlancha(id) {
    if (!confirm('¿Eliminar esta plancha? Esta acción no se puede deshacer.')) return;
    if (supabase) {
        await supabase.from('planchas').delete().eq('id', id);
    } else {
        const planchas = JSON.parse(localStorage.getItem('prm_planchas') || '[]').filter(p => p.id !== id);
        localStorage.setItem('prm_planchas', JSON.stringify(planchas));
    }
    await cargarListaPlanchas();
}

function abrirInscripcionPlancha() {
    // Limpiar plancha activa y abrir en el tab de inscripcion
    estado.planchaActiva = { id: null, codigo: null, nombre_plancha: '', miembros: {} };
    tabZona('inscripcion');
    renderFormularioPlancha();
}

function abrirRegistroVotante() {
    mostrarAlerta('Módulo de Registro de Votante — próximo paso del sistema.', 'info');
}

// ─────────────────────────────────────────────
// REPORTES
// ─────────────────────────────────────────────
function renderReportes() {
    // Placeholder funcional
    const grid = document.getElementById('reporte-grid-plancha');
    if (!grid) return;
    grid.innerHTML = '';
    const miembros = Object.entries(estado.planchaActiva.miembros).filter(([,m]) => m.validado);
    if (miembros.length === 0) {
        grid.innerHTML = '<p class="col-span-3 text-center text-slate-400 text-sm py-8">No hay plancha activa para reportar.</p>';
        return;
    }
    miembros.forEach(([cargoId, m]) => {
        const cargo = cargosZonales.find(c => c.id === parseInt(cargoId));
        grid.innerHTML += `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <img src="${m.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nombre)}&background=003da5&color=fff&size=80`}"
                 class="w-14 h-14 rounded-lg object-cover border-2 border-blue-200 flex-shrink-0">
            <div>
                <p class="text-[9px] font-black text-blue-600 uppercase">${cargo?.nombre || 'Cargo'}</p>
                <p class="text-sm font-black text-slate-800">${m.nombre}</p>
                <p class="text-[9px] text-slate-400 font-mono">${m.cedula}</p>
            </div>
        </div>`;
    });
}

// ─────────────────────────────────────────────
// ALERTAS GLOBALES
// ─────────────────────────────────────────────
function mostrarAlerta(mensaje, tipo = 'info') {
    const colores = {
        exito:       'bg-green-600 text-white',
        error:       'bg-red-600 text-white',
        advertencia: 'bg-yellow-500 text-white',
        info:        'bg-blue-600 text-white',
    };

    // Remover alertas previas
    document.querySelectorAll('.alerta-sistema').forEach(el => el.remove());

    const alerta = document.createElement('div');
    alerta.className = `alerta-sistema fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm max-w-sm
                        ${colores[tipo]} flex items-center gap-3 animate-bounce`;
    alerta.innerHTML = `<i class="fa-solid fa-${tipo === 'exito' ? 'check' : tipo === 'error' ? 'xmark' : 'info'}-circle text-xl"></i><span>${mensaje}</span>`;
    document.body.appendChild(alerta);
    setTimeout(() => alerta.remove(), 4000);
}

// ─────────────────────────────────────────────
// INICIALIZACIÓN AL CARGAR
// ─────────────────────────────────────────────
document.getElementById('input-cedula')?.addEventListener('input', function() {
    formatearCedula(this);
});

window.onload = () => {
    inicializarInterfaz();
    mostrarModulo('buscador');
};
