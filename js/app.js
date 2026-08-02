// Bitácora de Cine de Camaro — lógica principal (sin framework, sin build step)

const USERS = {
  cami: { name: "Cami", emoji: "🧚", cls: "cami" },
  lauti: { name: "Lauti", emoji: "🎬", cls: "lauti" },
};

const EXPECTATIONS = {
  top_asegurado: { label: "Top asegurado", emoji: "🏆" },
  pinta_bien: { label: "Pinta bien", emoji: "👍" },
  indie_linda: { label: "Indie linda de ver", emoji: "🎨" },
  va_patras: { label: "Parece que va p'atrás", emoji: "📉" },
};

const STATE = {
  user: localStorage.getItem("bitacora_cine_user") || null,
  movies: [],
  moviesLoaded: false,
  search: { query: "", results: [], picked: null },
  estrenos: { movies: [], predictions: [], criticScores: {}, viewMode: "us", loaded: false },
  estrenadas: { movies: [], predictions: [], criticScores: {}, viewMode: "us", loaded: false },
  top10Mode: "global",
  shows: [],
  showsLoaded: false,
  showSearch: { query: "", results: [], picked: null },
};

const $app = document.getElementById("app");

// ---------------- helpers ----------------

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function money(n) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function year(dateStr) {
  if (!dateStr) return "s/f";
  return dateStr.slice(0, 4);
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByMonth(movies) {
  const groups = [];
  let currentKey = null;
  let currentGroup = null;
  for (const m of movies) {
    const key = (m.watched_at || "").slice(0, 7);
    if (key !== currentKey) {
      currentGroup = { key, label: monthLabel(m.watched_at), items: [] };
      groups.push(currentGroup);
      currentKey = key;
    }
    currentGroup.items.push(m);
  }
  return groups;
}

function avgScore(movie) {
  const scores = (movie.ratings || []).map((r) => Number(r.score));
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function ratingFor(movie, user) {
  return (movie.ratings || []).find((r) => r.user_name === user) || null;
}

function go(hash) {
  window.location.hash = hash;
}

// ---------------- shell ----------------

function shell(activeTab, contentHtml) {
  const u = USERS[STATE.user];
  return `
    <div class="topbar">
      <div class="brand">
        <span class="clapper">🎞️</span>
        <div class="brand-title">Bitácora de Cine<span>de Camaro</span></div>
      </div>
      <div class="who">
        <div class="avatar ${u.cls}">${u.emoji}</div>
        <span>${u.name}</span>
        <button class="link-btn" onclick="switchUser()">cambiar</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab ${activeTab === "vistas" ? "active" : ""}" onclick="go('#/')">Vistas</button>
      <button class="tab ${activeTab === "casa" ? "active" : ""}" onclick="go('#/casa')">🏠 En casa</button>
      <button class="tab ${activeTab === "estrenadas" ? "active" : ""}" onclick="go('#/estrenadas')">🎬 Estrenadas</button>
      <button class="tab ${activeTab === "estrenos" ? "active" : ""}" onclick="go('#/estrenos')">🇦🇷 Estrenos</button>
      <button class="tab ${activeTab === "series" ? "active" : ""}" onclick="go('#/series')">📺 Series</button>
      <button class="tab ${activeTab === "top10" ? "active" : ""}" onclick="go('#/top10')">Top 10</button>
      <button class="tab ${activeTab === "add" ? "active" : ""}" onclick="startAddFlow()">+ Agregar peli</button>
    </div>
    <div>${contentHtml}</div>
  `;
}

// ---------------- picker ----------------

function renderPicker() {
  $app.innerHTML = `
    <div class="picker-screen">
      <div>
        <div class="display">🍿 ¿Quién sos?</div>
        <p class="sub">Elegí tu perfil para empezar a anotar las pelis que vieron juntos.</p>
      </div>
      <div class="picker-cards">
        <div class="picker-card cami" onclick="pickUser('cami')">
          <div class="emoji">🧚</div>
          <div class="name">Cami</div>
        </div>
        <div class="picker-card lauti" onclick="pickUser('lauti')">
          <div class="emoji">🎬</div>
          <div class="name">Lauti</div>
        </div>
      </div>
    </div>
  `;
}

function pickUser(user) {
  STATE.user = user;
  localStorage.setItem("bitacora_cine_user", user);
  go("#/");
  router();
}

function switchUser() {
  STATE.user = null;
  localStorage.removeItem("bitacora_cine_user");
  router();
}

// ---------------- vistas (peliculas que ya vieron) ----------------

async function renderVistas() {
  $app.innerHTML = shell("vistas", `<p class="hint">Cargando bitácora…</p>`);
  try {
    if (!STATE.moviesLoaded) {
      STATE.movies = await DB.listMovies();
      STATE.moviesLoaded = true;
    }
    renderVistasContent();
  } catch (e) {
    $app.innerHTML = shell("vistas", errorBlock(e));
  }
}

function isCine(m) {
  return (m.watched_where || "cine") === "cine";
}

function isCasa(m) {
  return m.watched_where === "casa";
}

function renderVistasContent() {
  const cineMovies = STATE.movies.filter(isCine);
  const groups = groupByMonth(cineMovies);
  const content = cineMovies.length
    ? groups
        .map(
          (g) => `
        <div class="section-head"><h3>${g.label}</h3></div>
        <div class="grid">${g.items.map(movieCard).join("")}</div>
      `
        )
        .join("")
    : `<div class="empty-state">Todavía no cargaron ninguna película 🎬<br/><br/><button class="btn primary" onclick="startAddFlow()">Agregar la primera</button></div>`;

  $app.innerHTML = shell("vistas", `<div class="section-head"><h2>Lo que vimos en el cine</h2></div>${content}`);
}

// ---------------- en casa (peliculas vistas en streaming/casa) ----------------

async function renderEnCasa() {
  $app.innerHTML = shell("casa", `<p class="hint">Cargando…</p>`);
  try {
    if (!STATE.moviesLoaded) {
      STATE.movies = await DB.listMovies();
      STATE.moviesLoaded = true;
    }
    renderEnCasaContent();
  } catch (e) {
    $app.innerHTML = shell("casa", errorBlock(e));
  }
}

function renderEnCasaContent() {
  const casaMovies = STATE.movies.filter(isCasa);
  const groups = groupByMonth(casaMovies);
  const content = casaMovies.length
    ? groups
        .map(
          (g) => `
        <div class="section-head"><h3>${g.label}</h3></div>
        <div class="grid">${g.items.map(movieCard).join("")}</div>
      `
        )
        .join("")
    : `<div class="empty-state">Todavía no cargaron ninguna película vista en casa 🏠<br/><br/><button class="btn primary" onclick="startAddFlow()">Agregar la primera</button></div>`;

  $app.innerHTML = shell(
    "casa",
    `<div class="section-head"><h2>🏠 Lo que vimos en casa</h2></div>
     <p class="hint">Al agregar una película elegí "Casa" para que te diga en qué plataforma la vieron.</p>
     ${content}`
  );
}

function movieCard(m) {
  const avg = avgScore(m);
  const poster = TMDB.posterUrl(m.poster_path, true) || placeholderPoster();
  return `
    <div class="movie-card" onclick="go('#/movie/${m.id}')">
      <img class="poster" src="${poster}" alt="${escapeHtml(m.title)}" onerror="this.src='${placeholderPoster()}'" />
      <div class="info">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="year">${year(m.release_date)}${m.genre_names ? ` · ${escapeHtml(m.genre_names.split(", ")[0])}` : ""}</div>
        ${avg !== null ? `<div class="score-pill">⭐ ${avg.toFixed(1)}</div>` : `<div class="score-pill" style="opacity:.5">sin calificar</div>`}
      </div>
    </div>
  `;
}

function placeholderPoster() {
  return "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="100%" height="100%" fill="%231f4c4a"/><text x="50%" y="50%" font-size="40" text-anchor="middle" fill="white">🎞️</text></svg>`
  );
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function errorBlock(e) {
  console.error(e);
  return `<div class="empty-state">Uy, hubo un error: ${escapeHtml(e.message || String(e))}<br/><br/>Revisá que <code>js/config.js</code> tenga tus claves correctas.</div>`;
}

// ---------------- add movie ----------------

function startAddFlow() {
  STATE.search = { query: "", results: [], picked: null };
  go("#/add");
}

function renderAdd() {
  $app.innerHTML = shell("add", addContent());
}

function addContent() {
  if (STATE.search.picked) return addForm(STATE.search.picked);

  return `
    <div class="section-head"><h2>Buscar película</h2></div>
    <div class="search-row">
      <input type="search" id="searchInput" placeholder="Ej: Everything Everywhere All at Once" oninput="onSearchInput(this.value)" />
    </div>
    <div class="search-results" id="searchResults">
      ${STATE.search.results.map(searchResultRow).join("")}
    </div>
  `;
}

let searchDebounce;
function onSearchInput(value) {
  STATE.search.query = value;
  clearTimeout(searchDebounce);
  if (!value.trim()) {
    STATE.search.results = [];
    document.getElementById("searchResults").innerHTML = "";
    return;
  }
  searchDebounce = setTimeout(async () => {
    try {
      const results = await TMDB.search(value);
      STATE.search.results = results.slice(0, 8);
      document.getElementById("searchResults").innerHTML = STATE.search.results.map(searchResultRow).join("");
    } catch (e) {
      toast("Error buscando en TMDb — revisá tu API key");
      console.error(e);
    }
  }, 400);
}

function searchResultRow(r) {
  return `
    <div class="result-row" onclick="pickSearchResult(${r.id})">
      <img src="${TMDB.posterUrl(r.poster_path, true) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div>
        <div class="rtitle">${escapeHtml(r.title)}</div>
        <div class="ryear">${year(r.release_date)}</div>
      </div>
    </div>
  `;
}

async function pickSearchResult(tmdbId) {
  try {
    const details = await TMDB.getDetails(tmdbId);
    STATE.search.picked = { ...details, watched_at: new Date().toISOString().slice(0, 10), filming_locations: "", countries_note: "", watched_where: "cine" };
    $app.innerHTML = shell("add", addContent());
  } catch (e) {
    toast("Error trayendo detalles de la película");
    console.error(e);
  }
}

async function addFromCatalog(tmdbId) {
  try {
    const details = await TMDB.getDetails(tmdbId);
    STATE.search.picked = { ...details, watched_at: new Date().toISOString().slice(0, 10), filming_locations: "", countries_note: "", watched_where: "cine" };
    closeModal();
    go("#/add");
  } catch (e) {
    toast("Error trayendo detalles de la película");
    console.error(e);
  }
}

async function setAddWatchedWhere(where) {
  STATE.search.picked.watched_where = where;
  if (where === "casa" && !STATE.search.picked._providersChecked) {
    STATE.search.picked._providersChecked = true;
    try {
      STATE.search.picked._providers = await TMDB.getWatchProvidersAR(STATE.search.picked.tmdb_id);
    } catch (e) {
      STATE.search.picked._providers = null;
    }
  }
  $app.innerHTML = shell("add", addContent());
}

function streamingPickBlock(m) {
  const p = m._providers;
  if (p === undefined) return `<p class="hint">Buscando dónde está disponible…</p>`;
  if (!p) return `<div class="critic-badge pending">🤷 No pudimos consultar las plataformas</div>`;
  const parts = [];
  if (p.flatrate.length) parts.push(`📺 Suscripción: ${p.flatrate.join(", ")}`);
  if (p.rent.length) parts.push(`💵 Alquiler: ${p.rent.join(", ")}`);
  if (p.buy.length) parts.push(`🛒 Compra: ${p.buy.join(", ")}`);
  if (!parts.length) return `<div class="critic-badge pending">🤷 No encontramos dónde está disponible en streaming (AR)</div>`;
  return `<div class="predicted-chips">${parts.map((x) => `<div class="predicted-chip">${escapeHtml(x)}</div>`).join("")}</div>`;
}

function addForm(m) {
  const where = m.watched_where || "cine";
  return `
    <div class="section-head"><h2>Confirmá los datos</h2></div>
    <div class="detail-hero">
      <img class="poster" src="${TMDB.posterUrl(m.poster_path) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div class="meta">
        <h2>${escapeHtml(m.title)}</h2>
        <div class="chips">
          <span class="chip">📅 ${fmtDate(m.release_date)}</span>
          ${m.duration_minutes ? `<span class="chip">⏱️ ${m.duration_minutes} min</span>` : ""}
          ${m.director ? `<span class="chip">🎥 ${escapeHtml(m.director)}</span>` : ""}
          ${m.genre_names ? `<span class="chip">🎭 ${escapeHtml(m.genre_names)}</span>` : ""}
        </div>
        <p style="font-size:13px;color:var(--teal-dark)">${escapeHtml(m.cast_names)}</p>
      </div>
    </div>

    <div class="field">
      <label>¿Dónde la vieron?</label>
      <div class="view-toggle">
        <button class="toggle-btn ${where === "cine" ? "active" : ""}" onclick="setAddWatchedWhere('cine')">🎬 Cine</button>
        <button class="toggle-btn ${where === "casa" ? "active" : ""}" onclick="setAddWatchedWhere('casa')">🏠 Casa</button>
      </div>
    </div>

    ${where === "casa" ? `<div class="predicted-before"><h3>📺 Dónde verla en Argentina</h3>${streamingPickBlock(m)}</div>` : ""}

    <div class="form-grid" style="margin-top:16px;">
      <div class="field">
        <label>¿Cuándo la vieron?</label>
        <input type="date" id="f_watched_at" value="${m.watched_at}" />
      </div>
      <div class="field">
        <label>Presupuesto (TMDb)</label>
        <input type="text" value="${money(m.budget)}" disabled />
      </div>
    </div>

    <div class="field">
      <label>Lugares donde se filmó</label>
      <textarea id="f_locations" placeholder="Ej: Buenos Aires, Los Angeles, Praga...">${m.filming_locations}</textarea>
    </div>

    <div class="field">
      <label>Países donde le fue bien / curiosidades de recaudación</label>
      <textarea id="f_countries" placeholder="Ej: Rompió récord en Corea del Sur, floppeó en EE.UU...">${m.countries_note}</textarea>
    </div>

    <div style="display:flex; gap:10px;">
      <button class="btn ghost" onclick="STATE.search.picked=null; renderAdd();">Volver a buscar</button>
      <button class="btn primary" onclick="submitAddMovie()">Guardar en la bitácora</button>
    </div>
  `;
}

async function submitAddMovie() {
  const m = STATE.search.picked;
  m.watched_at = document.getElementById("f_watched_at").value;
  m.filming_locations = document.getElementById("f_locations").value;
  m.countries_note = document.getElementById("f_countries").value;
  m.added_by = STATE.user;
  m.watched_where = m.watched_where || "cine";

  const payload = { ...m };
  delete payload._providersChecked;
  delete payload._providers;

  try {
    const saved = await DB.addMovie(payload);
    STATE.moviesLoaded = false;
    STATE.estrenadas.loaded = false;
    toast("¡Película agregada! 🎉");
    go(`#/movie/${saved.id}`);
  } catch (e) {
    toast("Error guardando la película");
    console.error(e);
  }
}

// ---------------- movie detail ----------------

async function renderDetail(id) {
  $app.innerHTML = shell("vistas", `<p class="hint">Cargando película…</p>`);
  try {
    const m = await DB.getMovie(id);
    const activeTab = isCasa(m) ? "casa" : "vistas";
    let predictions = [];
    let critic = null;
    let providers = null;
    if (m.tmdb_id) {
      const jobs = [
        DB.getPredictionsFor(m.tmdb_id).catch(() => []),
        OMDB.criticScore(m.original_title || m.title, year(m.release_date)).catch(() => ({ available: false })),
      ];
      if (isCasa(m)) jobs.push(TMDB.getWatchProvidersAR(m.tmdb_id).catch(() => null));
      const results = await Promise.all(jobs);
      predictions = results[0];
      critic = results[1];
      if (isCasa(m)) providers = results[2];
    }
    $app.innerHTML = shell(activeTab, detailContent(m, predictions, critic, providers));
  } catch (e) {
    $app.innerHTML = shell("vistas", errorBlock(e));
  }
}

function predictedBeforeBlock(predictions) {
  if (!predictions || !predictions.length) return "";
  const items = predictions
    .map((p) => `<div class="predicted-chip">${USERS[p.user_name].emoji} ${EXPECTATIONS[p.expectation].emoji} ${EXPECTATIONS[p.expectation].label}</div>`)
    .join("");
  return `
    <div class="predicted-before">
      <h3>🔮 Lo que predijimos antes de verla</h3>
      <div class="predicted-chips">${items}</div>
    </div>
  `;
}

function criticCompareBlock(critic) {
  if (!critic) return "";
  return critic.available
    ? `<div class="critic-badge">${critic.emoji} La crítica: ${critic.score}/100 (${critic.source}) <span class="hint">— no afecta el Top 10, es solo para comparar</span></div>`
    : `<div class="critic-badge pending">🤷 No encontramos críticas para comparar</div>`;
}

function streamingCompareBlock(providers) {
  if (!providers) return "";
  const parts = [];
  if (providers.flatrate.length) parts.push(`📺 Suscripción: ${providers.flatrate.join(", ")}`);
  if (providers.rent.length) parts.push(`💵 Alquiler: ${providers.rent.join(", ")}`);
  if (providers.buy.length) parts.push(`🛒 Compra: ${providers.buy.join(", ")}`);
  return `
    <div class="predicted-before">
      <h3>📺 Dónde verla en Argentina</h3>
      ${parts.length ? `<div class="predicted-chips">${parts.map((x) => `<div class="predicted-chip">${escapeHtml(x)}</div>`).join("")}</div>` : `<p class="pending">No encontramos dónde está disponible en streaming.</p>`}
    </div>
  `;
}

function detailContent(m, predictions, critic, providers) {
  return `
    <button class="link-btn" style="margin-bottom:14px" onclick="go(${isCasa(m) ? "'#/casa'" : "'#/'"})">← volver</button>
    <div class="detail-hero">
      <img class="poster" src="${TMDB.posterUrl(m.poster_path) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div class="meta">
        <h2>${escapeHtml(m.title)}</h2>
        <div class="chips">
          <span class="chip">${isCasa(m) ? "🏠 Casa" : "🎬 Cine"}</span>
          <span class="chip">📅 ${fmtDate(m.release_date)}</span>
          ${m.duration_minutes ? `<span class="chip">⏱️ ${m.duration_minutes} min</span>` : ""}
          ${m.director ? `<span class="chip">🎥 ${escapeHtml(m.director)}</span>` : ""}
          ${m.original_language ? `<span class="chip">🗣️ ${TMDB.languageName(m.original_language)}</span>` : ""}
          ${m.genre_names ? `<span class="chip">🎭 ${escapeHtml(m.genre_names)}</span>` : ""}
        </div>
        <div class="field" style="max-width:220px; margin-top:10px;">
          <label>👀 Vista el</label>
          <input type="date" value="${m.watched_at}" onchange="updateWatchedDate('${m.id}', this.value)" />
        </div>
        <p style="font-size:13px">${escapeHtml(m.overview || "")}</p>

        <div class="fact-grid">
          <div class="fact"><div class="k">Elenco</div><div class="v">${escapeHtml(m.cast_names || "—")}</div></div>
          <div class="fact"><div class="k">Presupuesto</div><div class="v">${money(m.budget)}</div></div>
          <div class="fact"><div class="k">Recaudación</div><div class="v">${money(m.revenue)}</div></div>
          <div class="fact"><div class="k">Locaciones</div><div class="v">${escapeHtml(m.filming_locations || "—")}</div></div>
          <div class="fact"><div class="k">Le fue bien en</div><div class="v">${escapeHtml(m.countries_note || "—")}</div></div>
        </div>

        ${
          m.trailer_key
            ? `<button class="btn ghost small" style="margin-top:10px" onclick="window.open('https://www.youtube.com/watch?v=${m.trailer_key}', '_blank')">▶️ Ver tráiler</button>`
            : ""
        }

        ${predictedBeforeBlock(predictions)}
        ${isCasa(m) ? streamingCompareBlock(providers) : ""}
        <div style="margin-top:10px">${criticCompareBlock(critic)}</div>
      </div>
    </div>

    <div class="ratings-cols">
      ${ratingCard(m, "cami")}
      ${ratingCard(m, "lauti")}
    </div>

    <div style="margin-top:30px;">
      <button class="link-btn" onclick="confirmDeleteMovie('${m.id}')">eliminar esta entrada</button>
    </div>
  `;
}

function ratingCard(movie, user) {
  const u = USERS[user];
  const rating = ratingFor(movie, user);
  const isMe = STATE.user === user;

  if (rating && !isMe) {
    return `
      <div class="rating-card">
        <h3>${u.emoji} ${u.name}</h3>
        <div class="score-display">${Number(rating.score).toFixed(1)}</div>
        <p>${escapeHtml(rating.comment || "")}</p>
      </div>
    `;
  }

  if (rating && isMe) {
    return `
      <div class="rating-card">
        <h3>${u.emoji} ${u.name} (vos)</h3>
        <div class="score-display">${Number(rating.score).toFixed(1)}</div>
        <p>${escapeHtml(rating.comment || "")}</p>
        <button class="btn small ghost" onclick="renderRatingForm('${movie.id}', '${user}', ${rating.score}, \`${(rating.comment || "").replace(/`/g, "'")}\`)">editar</button>
      </div>
      <div id="ratingform-${movie.id}-${user}"></div>
    `;
  }

  if (!rating && isMe) {
    return `
      <div class="rating-card" id="ratingcard-${movie.id}-${user}">
        <h3>${u.emoji} ${u.name} (vos)</h3>
        ${ratingFormInner(movie.id, user, 7, "")}
      </div>
    `;
  }

  return `
    <div class="rating-card">
      <h3>${u.emoji} ${u.name}</h3>
      <p class="pending">Todavía no calificó esta peli.</p>
    </div>
  `;
}

function ratingFormInner(movieId, user, score, comment) {
  return `
    <div class="field">
      <label>Puntaje: <span id="scoreval-${movieId}-${user}">${score}</span>/10</label>
      <div class="score-slider-row">
        <input type="range" min="1" max="10" step="0.5" value="${score}" oninput="document.getElementById('scoreval-${movieId}-${user}').textContent=this.value" id="scoreinput-${movieId}-${user}" />
      </div>
    </div>
    <div class="field">
      <label>Comentario corto</label>
      <textarea id="commentinput-${movieId}-${user}" placeholder="¿Qué te pareció?">${comment}</textarea>
    </div>
    <button class="btn primary small" onclick="submitRating('${movieId}', '${user}')">Guardar valoración</button>
  `;
}

function renderRatingForm(movieId, user, score, comment) {
  const el = document.getElementById(`ratingform-${movieId}-${user}`);
  el.innerHTML = `<div class="rating-card" style="margin-top:10px;">${ratingFormInner(movieId, user, score, comment)}</div>`;
}

async function submitRating(movieId, user) {
  const score = Number(document.getElementById(`scoreinput-${movieId}-${user}`).value);
  const comment = document.getElementById(`commentinput-${movieId}-${user}`).value;
  try {
    await DB.upsertRating({ movie_id: movieId, user_name: user, score, comment });
    STATE.moviesLoaded = false;
    toast("¡Valoración guardada! ⭐");
    renderDetail(movieId);
  } catch (e) {
    toast("Error guardando la valoración");
    console.error(e);
  }
}

async function updateWatchedDate(movieId, newDate) {
  if (!newDate) return;
  try {
    await DB.updateMovie(movieId, { watched_at: newDate });
    STATE.moviesLoaded = false;
    toast("Fecha actualizada");
    renderDetail(movieId);
  } catch (e) {
    toast("Error actualizando la fecha");
    console.error(e);
  }
}

async function confirmDeleteMovie(id) {
  if (!confirm("¿Seguro que querés borrar esta entrada de la bitácora?")) return;
  try {
    await DB.deleteMovie(id);
    STATE.moviesLoaded = false;
    STATE.estrenadas.loaded = false;
    toast("Entrada eliminada");
    go("#/");
  } catch (e) {
    toast("Error eliminando");
    console.error(e);
  }
}

// ---------------- top 10 ----------------

async function renderTop10() {
  $app.innerHTML = shell("top10", `<p class="hint">Calculando ranking…</p>`);
  try {
    if (!STATE.moviesLoaded) {
      STATE.movies = await DB.listMovies();
      STATE.moviesLoaded = true;
    }
    renderTop10Content();
  } catch (e) {
    $app.innerHTML = shell("top10", errorBlock(e));
  }
}

function setTop10Mode(mode) {
  STATE.top10Mode = mode;
  renderTop10Content();
}

function renderTop10Content() {
  const mode = STATE.top10Mode;
  const pool = mode === "global" ? STATE.movies : STATE.movies.filter((m) => (m.watched_where || "cine") === mode);

  const ranked = pool
    .map((m) => ({ m, avg: avgScore(m) }))
    .filter((x) => x.avg !== null)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  const titles = { global: "🏆 Top 10 Global", cine: "🏆 Top 10 en el Cine", casa: "🏆 Top 10 en Casa" };
  const emptyMsgs = {
    global: "Todavía no hay suficientes valoraciones para armar el top 10. ¡Califiquen alguna peli!",
    cine: "Todavía no calificaron pelis vistas en el cine.",
    casa: "Todavía no calificaron pelis vistas en casa.",
  };

  const content = ranked.length
    ? `
      <p class="hint">Ordenado automáticamente por el promedio de las valoraciones de ambos (la crítica no influye acá). A medida que califiquen más pelis, esto se va a ir acomodando solo.</p>
      <div class="top10-list">${ranked.map((x, i) => top10Row(x.m, x.avg, i + 1)).join("")}</div>
    `
    : `<div class="empty-state">${emptyMsgs[mode]}</div>`;

  $app.innerHTML = shell(
    "top10",
    `<div class="section-head"><h2>${titles[mode]}</h2></div>
     <div class="view-toggle">
       <button class="toggle-btn ${mode === "global" ? "active" : ""}" onclick="setTop10Mode('global')">🌎 Global</button>
       <button class="toggle-btn ${mode === "cine" ? "active" : ""}" onclick="setTop10Mode('cine')">🎬 Cine</button>
       <button class="toggle-btn ${mode === "casa" ? "active" : ""}" onclick="setTop10Mode('casa')">🏠 Casa</button>
     </div>
     ${content}`
  );
}

function top10Row(m, avg, rank) {
  return `
    <div class="top10-row" onclick="go('#/movie/${m.id}')">
      <div class="rank">${rank}</div>
      <img src="${TMDB.posterUrl(m.poster_path, true) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div class="rtitle">${escapeHtml(m.title)} <span style="font-weight:400;color:var(--teal-dark)">(${year(m.release_date)})</span></div>
      <div class="score-pill">⭐ ${avg.toFixed(1)}</div>
    </div>
  `;
}

// ---------------- catalogo compartido: estrenos y estrenadas ----------------

function catalogState(kind) {
  return kind === "estrenadas" ? STATE.estrenadas : STATE.estrenos;
}

async function fetchCriticScores(movies) {
  const entries = await Promise.all(
    movies.map(async (m) => {
      try {
        return [m.id, await OMDB.criticScore(m.original_title || m.title, year(m.release_date))];
      } catch (e) {
        return [m.id, { available: false, reason: "error" }];
      }
    })
  );
  return Object.fromEntries(entries);
}

function predictionsByMovie(predictions) {
  const map = {};
  for (const p of predictions) {
    if (!map[p.tmdb_id]) map[p.tmdb_id] = {};
    map[p.tmdb_id][p.user_name] = p.expectation;
  }
  return map;
}

async function loadCatalog(kind) {
  const state = catalogState(kind);
  if (state.loaded) return;

  const loadingMsg = kind === "estrenadas" ? "Buscando qué está en cartelera en Argentina…" : "Buscando próximos estrenos en Argentina…";
  $app.innerHTML = shell(kind, `<p class="hint">${loadingMsg}</p>`);

  let movies;
  if (kind === "estrenadas") {
    if (!STATE.moviesLoaded) {
      STATE.movies = await DB.listMovies();
      STATE.moviesLoaded = true;
    }
    const loggedIds = new Set(STATE.movies.map((m) => m.tmdb_id).filter(Boolean));
    const all = await TMDB.nowPlayingAR();
    movies = all.filter((m) => !loggedIds.has(m.id));
  } else {
    movies = await TMDB.upcomingAR();
  }

  const predictions = await DB.listPredictions();

  $app.innerHTML = shell(kind, `<p class="hint">Consultando qué dice la crítica…</p>`);
  const criticScores = await fetchCriticScores(movies);

  state.movies = movies;
  state.predictions = predictions;
  state.criticScores = criticScores;
  state.loaded = true;
}

async function renderCatalog(kind) {
  try {
    await loadCatalog(kind);
    renderCatalogContent(kind);
  } catch (e) {
    $app.innerHTML = shell(kind, errorBlock(e));
  }
}

function renderEstrenos() {
  renderCatalog("estrenos");
}

function renderEstrenadas() {
  renderCatalog("estrenadas");
}

function setCatalogView(kind, mode) {
  catalogState(kind).viewMode = mode;
  renderCatalogContent(kind);
}

function refreshCatalog(kind) {
  catalogState(kind).loaded = false;
  if (kind === "estrenadas") STATE.moviesLoaded = false;
  renderCatalog(kind);
}

function renderCatalogContent(kind) {
  const state = catalogState(kind);
  const preds = predictionsByMovie(state.predictions);
  const scores = state.criticScores || {};
  const list = [...state.movies];

  if (state.viewMode === "critics") {
    list.sort((a, b) => {
      const sa = scores[a.id]?.available ? scores[a.id].score : -1;
      const sb = scores[b.id]?.available ? scores[b.id].score : -1;
      return sb - sa;
    });
  }

  const title = kind === "estrenadas" ? "🎬 En cartelera hoy" : "🇦🇷 Próximos estrenos";
  const hint =
    kind === "estrenadas"
      ? "Pelis que están en el cine ahora mismo en Argentina. Click para ver la ficha, o marcá cuando ya la hayan visto."
      : "Click en una peli para ver la ficha completa y el tráiler. Cuando la vean, agréguenla a la bitácora para ver si acertaron con la previa.";
  const emptyMsg =
    kind === "estrenadas"
      ? "No hay pelis nuevas en cartelera para agregar (o ya las tenés todas en tu bitácora)."
      : "No encontramos próximos estrenos para Argentina en este momento.";

  const content = list.length
    ? `<div class="grid">${list.map((m) => catalogCard(kind, m, preds, scores[m.id])).join("")}</div>`
    : `<div class="empty-state">${emptyMsg}</div>`;

  $app.innerHTML = shell(
    kind,
    `<div class="section-head"><h2>${title}</h2><button class="btn ghost small" onclick="refreshCatalog('${kind}')">🔄 Actualizar</button></div>
     <p class="hint">${hint}</p>
     <div class="view-toggle">
       <button class="toggle-btn ${state.viewMode === "us" ? "active" : ""}" onclick="setCatalogView('${kind}', 'us')">🧚🎬 Lo que opinamos nosotros</button>
       <button class="toggle-btn ${state.viewMode === "critics" ? "active" : ""}" onclick="setCatalogView('${kind}', 'critics')">📰 Lo que opina la crítica</button>
     </div>
     ${content}`
  );
}

function catalogCard(kind, m, preds, critic) {
  const poster = TMDB.posterUrl(m.poster_path, true) || placeholderPoster();
  const mine = preds[m.id]?.[STATE.user];
  const partnerUser = STATE.user === "cami" ? "lauti" : "cami";
  const partnerPick = preds[m.id]?.[partnerUser];
  const viewMode = catalogState(kind).viewMode;

  const usBlock = `
    <div class="expectation-picker" onclick="event.stopPropagation()">
      ${Object.entries(EXPECTATIONS)
        .map(
          ([key, val]) => `
        <button class="exp-chip ${mine === key ? "selected" : ""}" title="${val.label}" onclick="setCatalogPrediction('${kind}', ${m.id}, '${key}')">${val.emoji}</button>
      `
        )
        .join("")}
    </div>
    ${
      partnerPick
        ? `<div class="partner-pick">${USERS[partnerUser].emoji} ${EXPECTATIONS[partnerPick].emoji} ${EXPECTATIONS[partnerPick].label}</div>`
        : `<div class="partner-pick pending">${USERS[partnerUser].emoji} todavía no opinó</div>`
    }
  `;

  const criticBlock =
    critic && critic.available
      ? `<div class="critic-badge">${critic.emoji} ${critic.score}/100 <span class="critic-source">(${critic.source})</span></div>`
      : `<div class="critic-badge pending">🤷 todavía no hay críticas</div>`;

  const primary = viewMode === "critics" ? criticBlock : usBlock;
  const secondary = viewMode === "critics" ? usBlock : criticBlock;

  const watchedBtn =
    kind === "estrenadas"
      ? `<button class="btn small primary block" style="margin-top:8px" onclick="event.stopPropagation(); addFromCatalog(${m.id})">✅ Ya la vimos</button>`
      : "";

  return `
    <div class="movie-card estreno-card" onclick="openCatalogModal('${kind}', ${m.id})">
      <img class="poster" src="${poster}" alt="${escapeHtml(m.title)}" onerror="this.src='${placeholderPoster()}'" />
      <div class="info">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="year">📅 ${fmtDate(m.release_date)}</div>
        ${m.genre_names ? `<div class="genre-tag">🎭 ${escapeHtml(m.genre_names)}</div>` : ""}
        <div class="primary-block">${primary}</div>
        <div class="secondary-block">${secondary}</div>
        ${watchedBtn}
      </div>
    </div>
  `;
}

async function setCatalogPrediction(kind, tmdbId, expectationKey) {
  const state = catalogState(kind);
  const movie = state.movies.find((m) => m.id === tmdbId);
  if (!movie) return;
  try {
    await DB.upsertPrediction({
      tmdb_id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date || null,
      user_name: STATE.user,
      expectation: expectationKey,
    });
    toast("¡Predicción guardada!");
    state.predictions = await DB.listPredictions();
    renderCatalogContent(kind);
  } catch (e) {
    toast("Error guardando la predicción");
    console.error(e);
  }
}

// ---------------- modal de ficha (estrenos / estrenadas) ----------------

async function openCatalogModal(kind, tmdbId) {
  const state = catalogState(kind);
  const movie = state.movies.find((m) => m.id === tmdbId);
  if (!movie) return;
  renderModal(`<p class="hint">Cargando ficha…</p>`);
  try {
    const d = await TMDB.getDetails(tmdbId);
    const critic = state.criticScores?.[tmdbId];
    renderModal(catalogModalContent(kind, d, critic));
  } catch (e) {
    renderModal(errorBlock(e));
  }
}

function renderModal(innerHtml) {
  let backdrop = document.getElementById("modalBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "modalBackdrop";
    backdrop.className = "modal-backdrop";
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };
    document.body.appendChild(backdrop);
  }
  backdrop.innerHTML = `<div class="modal"><button class="modal-close" onclick="closeModal()">✕</button>${innerHtml}</div>`;
}

function closeModal() {
  const backdrop = document.getElementById("modalBackdrop");
  if (backdrop) backdrop.remove();
}

const FAVORITE_CINEMAS = [
  { name: "Cinépolis Recoleta", url: "https://www.cinepolis.com.ar/cines/cinepolis-recoleta" },
  { name: "Cinépolis Avellaneda", url: "https://cinepolis.com/ar?cinema=cinepolis-avellaneda-buenos-aires" },
  { name: "MovieClub", url: "https://landing.movieclub.com.ar/project_category/en-cartel/" },
];

function ticketsBlock(kind, m) {
  if (kind !== "estrenadas") return "";
  return `
    <div class="tickets-block">
      <div class="tickets-label">🎟️ Sacar entradas en:</div>
      <div class="tickets-row">
        ${FAVORITE_CINEMAS.map(
          (c) => `<button class="btn small ghost" onclick="window.open('${c.url}', '_blank')">${c.name}</button>`
        ).join("")}
      </div>
    </div>
  `;
}

function catalogModalContent(kind, m, critic) {
  const criticHtml =
    critic && critic.available
      ? `<div class="critic-badge">${critic.emoji} ${critic.score}/100 según ${critic.source}</div>`
      : `<div class="critic-badge pending">🤷 Todavía no hay críticas publicadas${kind === "estrenos" ? " (suele destaparse días antes del estreno)" : ""}</div>`;

  const trailerBtn = m.trailer_key
    ? `<button class="btn primary" style="margin-top:16px" onclick="window.open('https://www.youtube.com/watch?v=${m.trailer_key}', '_blank')">▶️ Ver tráiler</button>`
    : `<button class="btn ghost" style="margin-top:16px" onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + " tráiler oficial")}', '_blank')">🔍 Buscar tráiler en YouTube</button>`;

  const watchedBtn =
    kind === "estrenadas"
      ? `<button class="btn primary" style="margin-top:10px" onclick="addFromCatalog(${m.tmdb_id})">✅ Ya la vimos, agregar a la bitácora</button>`
      : "";

  return `
    <div class="detail-hero">
      <img class="poster" src="${TMDB.posterUrl(m.poster_path) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div class="meta">
        <h2>${escapeHtml(m.title)}</h2>
        <div class="chips">
          <span class="chip">📅 ${fmtDate(m.release_date)}</span>
          ${m.duration_minutes ? `<span class="chip">⏱️ ${m.duration_minutes} min</span>` : ""}
          ${m.director ? `<span class="chip">🎥 ${escapeHtml(m.director)}</span>` : ""}
          <span class="chip">🗣️ ${TMDB.languageName(m.original_language)}</span>
          ${m.genre_names ? `<span class="chip">🎭 ${escapeHtml(m.genre_names)}</span>` : ""}
        </div>
        ${criticHtml}
        <p style="font-size:13px; margin-top:10px;">${escapeHtml(m.overview || "Todavía no hay sinopsis disponible.")}</p>
        <div class="fact-grid">
          <div class="fact"><div class="k">Elenco</div><div class="v">${escapeHtml(m.cast_names || "—")}</div></div>
          <div class="fact"><div class="k">Presupuesto</div><div class="v">${money(m.budget)}</div></div>
        </div>
        ${trailerBtn}
        ${ticketsBlock(kind, m)}
        ${watchedBtn}
      </div>
    </div>
  `;
}

// ---------------- series ----------------

function showAvgScore(s) {
  const scores = (s.show_ratings || []).map((r) => Number(r.score));
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function showRatingFor(show, user) {
  return (show.show_ratings || []).find((r) => r.user_name === user) || null;
}

async function renderSeries() {
  $app.innerHTML = shell("series", `<p class="hint">Cargando series…</p>`);
  try {
    if (!STATE.showsLoaded) {
      STATE.shows = await DB.listShows();
      STATE.showsLoaded = true;
    }
    renderSeriesContent();
  } catch (e) {
    $app.innerHTML = shell("series", errorBlock(e));
  }
}

function renderSeriesContent() {
  const list = STATE.shows;
  const grid = list.length
    ? `<div class="grid">${list.map(showCard).join("")}</div>`
    : `<div class="empty-state">Todavía no cargaron ninguna serie 📺</div>`;

  $app.innerHTML = shell(
    "series",
    `<div class="section-head"><h2>📺 Series</h2><button class="btn primary small" onclick="startAddShowFlow()">+ Agregar serie</button></div>
     ${grid}
     <div id="showRecsContainer" style="margin-top:30px;"></div>`
  );
  loadShowRecommendations();
}

function showCard(s) {
  const avg = showAvgScore(s);
  const poster = TMDB.posterUrl(s.poster_path, true) || placeholderPoster();
  return `
    <div class="movie-card" onclick="go('#/show/${s.id}')">
      <img class="poster" src="${poster}" alt="${escapeHtml(s.title)}" onerror="this.src='${placeholderPoster()}'" />
      <div class="info">
        <div class="title">${escapeHtml(s.title)}</div>
        <div class="year">${year(s.first_air_date)}${s.genre_names ? ` · ${escapeHtml(s.genre_names.split(", ")[0])}` : ""}</div>
        ${avg !== null ? `<div class="score-pill">⭐ ${avg.toFixed(1)}</div>` : `<div class="score-pill" style="opacity:.5">sin calificar</div>`}
      </div>
    </div>
  `;
}

async function loadShowRecommendations() {
  const container = document.getElementById("showRecsContainer");
  if (!container) return;

  const rated = STATE.shows
    .map((s) => ({ s, avg: showAvgScore(s) }))
    .filter((x) => x.avg !== null && x.avg >= 7)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  if (!rated.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `<div class="section-head"><h3>Recomendadas para ustedes</h3></div><p class="hint">Cargando recomendaciones…</p>`;

  try {
    const loggedIds = new Set(STATE.shows.map((s) => s.tmdb_id).filter(Boolean));
    const lists = await Promise.all(rated.map((x) => TMDB.tvRecommendations(x.s.tmdb_id).catch(() => [])));
    const seen = new Set();
    const merged = [];
    lists.flat().forEach((item) => {
      if (loggedIds.has(item.id) || seen.has(item.id)) return;
      seen.add(item.id);
      merged.push(item);
    });
    const top = merged.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 8);

    container.innerHTML = top.length
      ? `<div class="section-head"><h3>Recomendadas para ustedes</h3></div>
         <p class="hint">Basado en las series que más les gustaron.</p>
         <div class="grid">${top.map(recommendedShowCard).join("")}</div>`
      : "";
  } catch (e) {
    container.innerHTML = "";
    console.error(e);
  }
}

function recommendedShowCard(r) {
  const poster = TMDB.posterUrl(r.poster_path, true) || placeholderPoster();
  return `
    <div class="movie-card" onclick="addRecommendedShow(${r.id})">
      <img class="poster" src="${poster}" alt="${escapeHtml(r.name)}" onerror="this.src='${placeholderPoster()}'" />
      <div class="info">
        <div class="title">${escapeHtml(r.name)}</div>
        <div class="year">${year(r.first_air_date)}${r.genre_names ? ` · ${escapeHtml(r.genre_names.split(", ")[0])}` : ""}</div>
        <div class="score-pill">+ agregar</div>
      </div>
    </div>
  `;
}

async function addRecommendedShow(tmdbId) {
  try {
    const details = await TMDB.getTVDetails(tmdbId);
    STATE.showSearch.picked = { ...details, watched_at: new Date().toISOString().slice(0, 10) };
    go("#/add-series");
  } catch (e) {
    toast("Error trayendo detalles de la serie");
    console.error(e);
  }
}

function startAddShowFlow() {
  STATE.showSearch = { query: "", results: [], picked: null };
  go("#/add-series");
}

function renderAddShow() {
  $app.innerHTML = shell("series", addShowContent());
}

function addShowContent() {
  if (STATE.showSearch.picked) return addShowForm(STATE.showSearch.picked);

  return `
    <div class="section-head"><h2>Buscar serie</h2></div>
    <div class="search-row">
      <input type="search" placeholder="Ej: Severance" oninput="onShowSearchInput(this.value)" />
    </div>
    <div class="search-results" id="showSearchResults">
      ${STATE.showSearch.results.map(showSearchResultRow).join("")}
    </div>
  `;
}

let showSearchDebounce;
function onShowSearchInput(value) {
  STATE.showSearch.query = value;
  clearTimeout(showSearchDebounce);
  if (!value.trim()) {
    STATE.showSearch.results = [];
    document.getElementById("showSearchResults").innerHTML = "";
    return;
  }
  showSearchDebounce = setTimeout(async () => {
    try {
      const results = await TMDB.searchTV(value);
      STATE.showSearch.results = results.slice(0, 8);
      document.getElementById("showSearchResults").innerHTML = STATE.showSearch.results.map(showSearchResultRow).join("");
    } catch (e) {
      toast("Error buscando series en TMDb");
      console.error(e);
    }
  }, 400);
}

function showSearchResultRow(r) {
  return `
    <div class="result-row" onclick="pickShowSearchResult(${r.id})">
      <img src="${TMDB.posterUrl(r.poster_path, true) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div>
        <div class="rtitle">${escapeHtml(r.name)}</div>
        <div class="ryear">${year(r.first_air_date)}</div>
      </div>
    </div>
  `;
}

async function pickShowSearchResult(tmdbId) {
  try {
    const details = await TMDB.getTVDetails(tmdbId);
    STATE.showSearch.picked = { ...details, watched_at: new Date().toISOString().slice(0, 10) };
    $app.innerHTML = shell("series", addShowContent());
  } catch (e) {
    toast("Error trayendo detalles de la serie");
    console.error(e);
  }
}

function addShowForm(s) {
  return `
    <div class="section-head"><h2>Confirmá los datos</h2></div>
    <div class="detail-hero">
      <img class="poster" src="${TMDB.posterUrl(s.poster_path) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div class="meta">
        <h2>${escapeHtml(s.title)}</h2>
        <div class="chips">
          <span class="chip">📅 ${fmtDate(s.first_air_date)}</span>
          ${s.number_of_seasons ? `<span class="chip">📀 ${s.number_of_seasons} temporada${s.number_of_seasons > 1 ? "s" : ""}</span>` : ""}
          ${s.creator ? `<span class="chip">🎬 ${escapeHtml(s.creator)}</span>` : ""}
          ${s.genre_names ? `<span class="chip">🎭 ${escapeHtml(s.genre_names)}</span>` : ""}
        </div>
        <p style="font-size:13px;color:var(--teal-dark)">${escapeHtml(s.cast_names)}</p>
      </div>
    </div>

    <div class="field">
      <label>¿Cuándo la agregan?</label>
      <input type="date" id="fs_watched_at" value="${s.watched_at}" />
    </div>

    <div style="display:flex; gap:10px;">
      <button class="btn ghost" onclick="STATE.showSearch.picked=null; renderAddShow();">Volver a buscar</button>
      <button class="btn primary" onclick="submitAddShow()">Guardar</button>
    </div>
  `;
}

async function submitAddShow() {
  const s = STATE.showSearch.picked;
  s.watched_at = document.getElementById("fs_watched_at").value;
  s.added_by = STATE.user;

  try {
    const saved = await DB.addShow(s);
    STATE.showsLoaded = false;
    toast("¡Serie agregada! 🎉");
    go(`#/show/${saved.id}`);
  } catch (e) {
    toast("Error guardando la serie");
    console.error(e);
  }
}

async function renderShowDetail(id) {
  $app.innerHTML = shell("series", `<p class="hint">Cargando serie…</p>`);
  try {
    const s = await DB.getShow(id);
    $app.innerHTML = shell("series", showDetailContent(s));
  } catch (e) {
    $app.innerHTML = shell("series", errorBlock(e));
  }
}

function showDetailContent(s) {
  return `
    <button class="link-btn" style="margin-bottom:14px" onclick="go('#/series')">← volver</button>
    <div class="detail-hero">
      <img class="poster" src="${TMDB.posterUrl(s.poster_path) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div class="meta">
        <h2>${escapeHtml(s.title)}</h2>
        <div class="chips">
          <span class="chip">📅 ${fmtDate(s.first_air_date)}</span>
          ${s.number_of_seasons ? `<span class="chip">📀 ${s.number_of_seasons} temporada${s.number_of_seasons > 1 ? "s" : ""}</span>` : ""}
          ${s.creator ? `<span class="chip">🎬 ${escapeHtml(s.creator)}</span>` : ""}
          ${s.original_language ? `<span class="chip">🗣️ ${TMDB.languageName(s.original_language)}</span>` : ""}
          ${s.genre_names ? `<span class="chip">🎭 ${escapeHtml(s.genre_names)}</span>` : ""}
        </div>
        <p style="font-size:13px">${escapeHtml(s.overview || "")}</p>
        <div class="fact-grid">
          <div class="fact"><div class="k">Elenco</div><div class="v">${escapeHtml(s.cast_names || "—")}</div></div>
        </div>
        ${
          s.trailer_key
            ? `<button class="btn ghost small" style="margin-top:10px" onclick="window.open('https://www.youtube.com/watch?v=${s.trailer_key}', '_blank')">▶️ Ver tráiler</button>`
            : ""
        }
      </div>
    </div>

    <div class="ratings-cols">
      ${showRatingCard(s, "cami")}
      ${showRatingCard(s, "lauti")}
    </div>

    <div style="margin-top:30px;">
      <button class="link-btn" onclick="confirmDeleteShow('${s.id}')">eliminar esta serie</button>
    </div>
  `;
}

function showRatingCard(show, user) {
  const u = USERS[user];
  const rating = showRatingFor(show, user);
  const isMe = STATE.user === user;

  if (rating && !isMe) {
    return `
      <div class="rating-card">
        <h3>${u.emoji} ${u.name}</h3>
        <div class="score-display">${Number(rating.score).toFixed(1)}</div>
        <p>${escapeHtml(rating.comment || "")}</p>
      </div>
    `;
  }

  if (rating && isMe) {
    return `
      <div class="rating-card">
        <h3>${u.emoji} ${u.name} (vos)</h3>
        <div class="score-display">${Number(rating.score).toFixed(1)}</div>
        <p>${escapeHtml(rating.comment || "")}</p>
        <button class="btn small ghost" onclick="renderShowRatingForm('${show.id}', '${user}', ${rating.score}, \`${(rating.comment || "").replace(/`/g, "'")}\`)">editar</button>
      </div>
      <div id="showratingform-${show.id}-${user}"></div>
    `;
  }

  if (!rating && isMe) {
    return `
      <div class="rating-card" id="showratingcard-${show.id}-${user}">
        <h3>${u.emoji} ${u.name} (vos)</h3>
        ${showRatingFormInner(show.id, user, 7, "")}
      </div>
    `;
  }

  return `
    <div class="rating-card">
      <h3>${u.emoji} ${u.name}</h3>
      <p class="pending">Todavía no calificó esta serie.</p>
    </div>
  `;
}

function showRatingFormInner(showId, user, score, comment) {
  return `
    <div class="field">
      <label>Puntaje: <span id="showscoreval-${showId}-${user}">${score}</span>/10</label>
      <div class="score-slider-row">
        <input type="range" min="1" max="10" step="0.5" value="${score}" oninput="document.getElementById('showscoreval-${showId}-${user}').textContent=this.value" id="showscoreinput-${showId}-${user}" />
      </div>
    </div>
    <div class="field">
      <label>Comentario corto</label>
      <textarea id="showcommentinput-${showId}-${user}" placeholder="¿Qué te pareció?">${comment}</textarea>
    </div>
    <button class="btn primary small" onclick="submitShowRating('${showId}', '${user}')">Guardar valoración</button>
  `;
}

function renderShowRatingForm(showId, user, score, comment) {
  const el = document.getElementById(`showratingform-${showId}-${user}`);
  el.innerHTML = `<div class="rating-card" style="margin-top:10px;">${showRatingFormInner(showId, user, score, comment)}</div>`;
}

async function submitShowRating(showId, user) {
  const score = Number(document.getElementById(`showscoreinput-${showId}-${user}`).value);
  const comment = document.getElementById(`showcommentinput-${showId}-${user}`).value;
  try {
    await DB.upsertShowRating({ show_id: showId, user_name: user, score, comment });
    STATE.showsLoaded = false;
    toast("¡Valoración guardada! ⭐");
    renderShowDetail(showId);
  } catch (e) {
    toast("Error guardando la valoración");
    console.error(e);
  }
}

async function confirmDeleteShow(id) {
  if (!confirm("¿Seguro que querés borrar esta serie?")) return;
  try {
    await DB.deleteShow(id);
    STATE.showsLoaded = false;
    toast("Serie eliminada");
    go("#/series");
  } catch (e) {
    toast("Error eliminando");
    console.error(e);
  }
}

// ---------------- router ----------------

function router() {
  if (!STATE.user) {
    renderPicker();
    return;
  }

  const hash = window.location.hash || "#/";
  const movieMatch = hash.match(/^#\/movie\/(.+)$/);
  const showMatch = hash.match(/^#\/show\/(.+)$/);

  if (hash === "#/" || hash === "") renderVistas();
  else if (hash === "#/casa") renderEnCasa();
  else if (hash === "#/add") renderAdd();
  else if (hash === "#/add-series") renderAddShow();
  else if (hash === "#/series") renderSeries();
  else if (hash === "#/top10") renderTop10();
  else if (hash === "#/estrenos") renderEstrenos();
  else if (hash === "#/estrenadas") renderEstrenadas();
  else if (movieMatch) renderDetail(movieMatch[1]);
  else if (showMatch) renderShowDetail(showMatch[1]);
  else renderVistas();
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
