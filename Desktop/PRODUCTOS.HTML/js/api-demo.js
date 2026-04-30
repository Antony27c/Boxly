// Referenciás los elementos del DOM
const container = document.getElementById("contenedor-pokemon");
const estado    = document.getElementById("estado");
const buscador  = document.getElementById("buscador");

let datosCache = [];

// ── Helpers de estado (usan las clases de app.css) ────────

const mostrarLoading = (msg = "Cargando...") => {
    container.innerHTML = "";
    estado.innerHTML = `
        <div class="estado-loading">
            <div class="spinner"></div>
            ${msg.toUpperCase()}
        </div>
    `;
};

const mostrarError = (msg) => {
    container.innerHTML = "";
    estado.innerHTML = `<div class="error">${msg}</div>`;
};

const mostrarVacio = () => {
    container.innerHTML = "";
    estado.innerHTML = `
        <div class="estado-vacio">
            <span class="vacio-icon">🔍</span>
            <p>No se encontraron<br>resultados</p>
        </div>
    `;
};

const mostrarInfo = (msg) => {
    estado.innerHTML = `<span class="estado-info">${msg}</span>`;
};

const limpiarEstado = () => {
    estado.innerHTML = "";
};

// ── Carga inicial ──────────────────────────────────────────
const cargarPokemon = async () => {
    mostrarLoading("Cargando pokémon...");

    try {
        const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=24");
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();

        const detalles = await Promise.all(
            data.results.map(async (p) => {
                const res = await fetch(p.url);
                if (!res.ok) throw new Error(`Error al cargar ${p.name}: ${res.status}`);
                return res.json();
            })
        );

        datosCache = detalles;
        renderPokemon(datosCache);

    } catch (error) {
        mostrarError(`No se pudieron cargar los pokémon: ${error.message}`);
    }
};

// ── Render ─────────────────────────────────────────────────
const renderPokemon = (lista) => {
    if (lista.length === 0) { mostrarVacio(); return; }
    limpiarEstado();

    container.innerHTML = lista.map(p => {
        const tipos = p.types.map(t => t.type.name);
        const tipoClase = tipos[0] || "normal";
        const sprite = p.sprites.other?.['official-artwork']?.front_default
                    || p.sprites.front_default
                    || '';

        return `
            <article class="api-card-result pokemon-card pokemon-${tipoClase}">
                <div class="pokemon-id">#${String(p.id).padStart(3, '0')}</div>
                <img src="${sprite}" alt="${p.name}" class="pokemon-img" loading="lazy">
                <div class="api-card-body">
                    <h3>${p.name.charAt(0).toUpperCase() + p.name.slice(1)}</h3>
                    <div class="pokemon-tipos">
                        ${tipos.map(t => `<span class="pokemon-tipo tipo-${t}">${t}</span>`).join("")}
                    </div>
                    <div class="pokemon-stats">
                        <span>❤️ HP: ${p.stats[0].base_stat}</span>
                        <span>⚔️ ATK: ${p.stats[1].base_stat}</span>
                        <span>🛡️ DEF: ${p.stats[2].base_stat}</span>
                    </div>
                </div>
            </article>
        `;
    }).join("");
};

// ── Búsqueda dinámica ──────────────────────────────────────
const buscarPokemon = (texto) => {
    if (texto.length === 0) {
        limpiarEstado();
        renderPokemon(datosCache);
        return;
    }

    if (texto.length < 3) {
        mostrarInfo(`Escribí al menos 3 caracteres para buscar (faltan ${3 - texto.length})`);
        renderPokemon(datosCache);
        return;
    }

    mostrarInfo(`Buscando "<strong>${texto}</strong>"...`);

    const filtrados = datosCache.filter(p =>
        p.name.toLowerCase().includes(texto) ||
        p.types.some(t => t.type.name.toLowerCase().includes(texto))
    );

    renderPokemon(filtrados);
};

// ── addEventListener ───────────────────────────────────────
buscador.addEventListener("input", (e) => {
    buscarPokemon(e.target.value.toLowerCase().trim());
});
document.getElementById("btn-buscar").addEventListener("click", () => {
    buscarPokemon(buscador.value.toLowerCase().trim());
});


buscador.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscarPokemon(buscador.value.toLowerCase().trim());
});

cargarPokemon();