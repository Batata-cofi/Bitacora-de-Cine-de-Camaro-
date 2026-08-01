// Bitácora de Cine de Camaro — lógica principal (sin framework, sin build step)

const USERS = {
  cami: { name: "Cami", emoji: "🎀", cls: "cami" },
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
      <button class="tab ${activeTab === "home" ? "active" : ""}" onclick="go('#/')">Inicio</button>
      <button class="tab ${activeTab === "add" ? "active" : ""}" onclick="go('#/add')">+ Agregar peli</button>
      <button class="tab ${activeTab === "top10" ? "active" : ""}" onclick="go('#/top10')">Top 10</button>
      <button class="tab ${activeTab === "estrenos" ? "active" : ""}" onclick="go('#/estrenos')">🇦🇷 Estrenos</button>
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
          <div class="emoji">🎀</div>
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

// ---------------- home / feed ----------------

async function renderHome() {
  $app.innerHTML = shell("home", `<p class="hint">Cargando bitácora…</p>`);
  try {
    if (!STATE.moviesLoaded) {
      STATE.movies = await DB.listMovies();
      STATE.moviesLoaded = true;
    }
    renderHomeContent();
  } catch (e) {
    $app.innerHTML = shell("home", errorBlock(e));
  }
}

function renderHomeContent() {
  const content = STATE.movies.length
    ? `<div class="grid">${STATE.movies.map(movieCard).join("")}</div>`
    : `<div class="empty-state">Todavía no cargaron ninguna película 🎬<br/><br/><button class="btn primary" onclick="go('#/add')">Agregar la primera</button></div>`;

  $app.innerHTML = shell(
    "home",
    `<div class="section-head"><h2>Lo que vimos</h2></div>${content}`
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
        <div class="year">${year(m.release_date)}</div>
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
  return `<div class="empty-state">Uy, hubo un error: ${escapeHtml(e.message || String(e))}<br/><br/>Revisá que <code>js/config.js</code> tenga tus claves de Supabase correctas.</div>`;
}

// ---------------- add movie ----------------

function renderAdd() {
  STATE.search = { query: "", results: [], picked: null };
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
    STATE.search.picked = { ...details, watched_at: new Date().toISOString().slice(0, 10), filming_locations: "", countries_note: "" };
    $app.innerHTML = shell("add", addContent());
  } catch (e) {
    toast("Error trayendo detalles de la película");
    console.error(e);
  }
}

function addForm(m) {
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
        </div>
        <p style="font-size:13px;color:var(--teal-dark)">${escapeHtml(m.cast_names)}</p>
      </div>
    </div>

    <div class="form-grid">
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

  try {
    const saved = await DB.addMovie(m);
    STATE.moviesLoaded = false;
    toast("¡Película agregada! 🎉");
    go(`#/movie/${saved.id}`);
  } catch (e) {
    toast("Error guardando la película");
    console.error(e);
  }
}

// ---------------- movie detail ----------------

async function renderDetail(id) {
  $app.innerHTML = shell("home", `<p class="hint">Cargando película…</p>`);
  try {
    const m = await DB.getMovie(id);
    $app.innerHTML = shell("home", detailContent(m));
  } catch (e) {
    $app.innerHTML = shell("home", errorBlock(e));
  }
}

function detailContent(m) {
  return `
    <button class="link-btn" style="margin-bottom:14px" onclick="go('#/')">← volver</button>
    <div class="detail-hero">
      <img class="poster" src="${TMDB.posterUrl(m.poster_path) || placeholderPoster()}" onerror="this.src='${placeholderPoster()}'" />
      <div class="meta">
        <h2>${escapeHtml(m.title)}</h2>
        <div class="chips">
          <span class="chip">📅 ${fmtDate(m.release_date)}</span>
          ${m.duration_minutes ? `<span class="chip">⏱️ ${m.duration_minutes} min</span>` : ""}
          ${m.director ? `<span class="chip">🎥 ${escapeHtml(m.director)}</span>` : ""}
          <span class="chip">👀 vista el ${fmtDate(m.watched_at)}</span>
        </div>
        <p style="font-size:13px">${escapeHtml(m.overview || "")}</p>

        <div class="fact-grid">
          <div class="fact"><div class="k">Elenco</div><div class="v">${escapeHtml(m.cast_names || "—")}</div></div>
          <div class="fact"><div class="k">Presupuesto</div><div class="v">${money(m.budget)}</div></div>
          <div class="fact"><div class="k">Recaudación</div><div class="v">${money(m.revenue)}</div></div>
          <div class="fact"><div class="k">Locaciones</div><div class="v">${escapeHtml(m.filming_locations || "—")}</div></div>
          <div class="fact"><div class="k">Le fue bien en</div><div class="v">${escapeHtml(m.countries_note || "—")}</div></div>
        </div>
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

async function confirmDeleteMovie(id) {
  if (!confirm("¿Seguro que querés borrar esta entrada de la bitácora?")) return;
  try {
    await DB.deleteMovie(id);
    STATE.moviesLoaded = false;
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
    const ranked = STATE.movies
      .map((m) => ({ m, avg: avgScore(m) }))
      .filter((x) => x.avg !== null)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);

    const content = ranked.length
      ? `
        <p class="hint">Ordenado automáticamente por el promedio de las valoraciones de ambos. A medida que califiquen más pelis, esto se va a ir acomodando solo.</p>
        <div class="top10-list">${ranked.map((x, i) => top10Row(x.m, x.avg, i + 1)).join("")}</div>
      `
      : `<div class="empty-state">Todavía no hay suficientes valoraciones para armar el top 10. ¡Califiquen alguna peli!</div>`;

    $app.innerHTML = shell("top10", `<div class="section-head"><h2>🏆 Top 10 de Cami &amp; Lauti</h2></div>${content}`);
  } catch (e) {
    $app.innerHTML = shell("top10", errorBlock(e));
  }
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

// ---------------- estrenos AR ----------------

async function renderEstrenos() {
  $app.innerHTML = shell("estrenos", `<p class="hint">Buscando próximos estrenos en Argentina…</p>`);
  try {
    if (!STATE.estrenos.loaded) {
      const [movies, predictions] = await Promise.all([TMDB.upcomingAR(), DB.listPredictions()]);
      STATE.estrenos.movies = movies;
      STATE.estrenos.predictions = predictions;

      $app.innerHTML = shell("estrenos", `<p class="hint">Consultando qué dice la crítica…</p>`);
      const scoreEntries = await Promise.all(
        movies.map(async (m) => {
          try {
            const score = await OMDB.criticScore(m.original_title || m.title, year(m.release_date));
            return [m.id, score];
          } catch (e) {
            return [m.id, { available: false, reason: "error" }];
          }
        })
      );
      STATE.estrenos.criticScores = Object.fromEntries(scoreEntries);
      STATE.estrenos.loaded = true;
    }
    renderEstrenosContent();
  } catch (e) {
    $app.innerHTML = shell("estrenos", errorBlock(e));
  }
}

function predictionsByMovie() {
  const map = {};
  for (const p of STATE.estrenos.predictions) {
    if (!map[p.tmdb_id]) map[p.tmdb_id] = {};
    map[p.tmdb_id][p.user_name] = p.expectation;
  }
  return map;
}

function setEstrenosView(mode) {
  STATE.estrenos.viewMode = mode;
  renderEstrenosContent();
}

function renderEstrenosContent() {
  const preds = predictionsByMovie();
  const scores = STATE.estrenos.criticScores || {};
  const list = [...STATE.estrenos.movies];

  if (STATE.estrenos.viewMode === "critics") {
    list.sort((a, b) => {
      const sa = scores[a.id]?.available ? scores[a.id].score : -1;
      const sb = scores[b.id]?.available ? scores[b.id].score : -1;
      return sb - sa;
    });
  }

  const content = list.length
    ? `<div class="grid">${list.map((m) => estrenoCard(m, preds, scores[m.id])).join("")}</div>`
    : `<div class="empty-state">No encontramos próximos estrenos para Argentina en este momento.</div>`;

  $app.innerHTML = shell(
    "estrenos",
    `<div class="section-head"><h2>🇦🇷 Próximos estrenos</h2></div>
     <p class="hint">Click en una peli para ver la ficha completa y el tráiler. Cuando la vean, agréguenla a la bitácora para ver si acertaron con la previa.</p>
     <div class="view-toggle">
       <button class="toggle-btn ${STATE.estrenos.viewMode === "us" ? "active" : ""}" onclick="setEstrenosView('us')">🎀🎬 Lo que opinamos nosotros</button>
       <button class="toggle-btn ${STATE.estrenos.viewMode === "critics" ? "active" : ""}" onclick="setEstrenosView('critics')">📰 Lo que opina la crítica</button>
     </div>
     ${content}`
  );
}

function estrenoCard(m, preds, critic) {
  const poster = TMDB.posterUrl(m.poster_path, true) || placeholderPoster();
  const mine = preds[m.id]?.[STATE.user];
  const partnerUser = STATE.user === "cami" ? "lauti" : "cami";
  const partnerPick = preds[m.id]?.[partnerUser];

  const usBlock = `
    <div class="expectation-picker" onclick="event.stopPropagation()">
      ${Object.entries(EXPECTATIONS)
        .map(
          ([key, val]) => `
        <button class="exp-chip ${mine === key ? "selected" : ""}" title="${val.label}" onclick="setPrediction(${m.id}, '${key}')">${val.emoji}</button>
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

  const primary = STATE.estrenos.viewMode === "critics" ? criticBlock : usBlock;
  const secondary = STATE.estrenos.viewMode === "critics" ? usBlock : criticBlock;

  return `
    <div class="movie-card estreno-card" onclick="openEstrenoModal(${m.id})">
      <img class="poster" src="${poster}" alt="${escapeHtml(m.title)}" onerror="this.src='${placeholderPoster()}'" />
      <div class="info">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="year">📅 ${fmtDate(m.release_date)}</div>
        <div class="primary-block">${primary}</div>
        <div class="secondary-block">${secondary}</div>
      </div>
    </div>
  `;
}

async function setPrediction(tmdbId, expectationKey) {
  const movie = STATE.estrenos.movies.find((m) => m.id === tmdbId);
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
    const updated = await DB.listPredictions();
    STATE.estrenos.predictions = updated;
    renderEstrenosContent();
  } catch (e) {
    toast("Error guardando la predicción");
    console.error(e);
  }
}

// ---------------- estreno detail modal ----------------

async function openEstrenoModal(tmdbId) {
  const movie = STATE.estrenos.movies.find((m) => m.id === tmdbId);
  if (!movie) return;
  renderModal(`<p class="hint">Cargando ficha…</p>`);
  try {
    const d = await TMDB.getDetails(tmdbId);
    const critic = STATE.estrenos.criticScores?.[tmdbId];
    renderModal(estrenoModalContent(d, critic));
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

function estrenoModalContent(m, critic) {
  const criticHtml =
    critic && critic.available
      ? `<div class="critic-badge">${critic.emoji} ${critic.score}/100 según ${critic.source}</div>`
      : `<div class="critic-badge pending">🤷 Todavía no hay críticas publicadas (suele destaparse días antes del estreno)</div>`;

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
        </div>
        ${criticHtml}
        <p style="font-size:13px; margin-top:10px;">${escapeHtml(m.overview || "Todavía no hay sinopsis disponible.")}</p>
        <div class="fact-grid">
          <div class="fact"><div class="k">Elenco</div><div class="v">${escapeHtml(m.cast_names || "—")}</div></div>
          <div class="fact"><div class="k">Presupuesto</div><div class="v">${money(m.budget)}</div></div>
        </div>
        ${
          m.trailer_key
            ? `<button class="btn primary" style="margin-top:16px" onclick="window.open('https://www.youtube.com/watch?v=${m.trailer_key}', '_blank')">▶️ Ver tráiler</button>`
            : `<p class="hint" style="margin-top:16px">Todavía no hay tráiler cargado en TMDb.</p>`
        }
      </div>
    </div>
  `;
}

// ---------------- router ----------------

function router() {
  if (!STATE.user) {
    renderPicker();
    return;
  }

  const hash = window.location.hash || "#/";
  const movieMatch = hash.match(/^#\/movie\/(.+)$/);

  if (hash === "#/" || hash === "") renderHome();
  else if (hash === "#/add") renderAdd();
  else if (hash === "#/top10") renderTop10();
  else if (hash === "#/estrenos") renderEstrenos();
  else if (movieMatch) renderDetail(movieMatch[1]);
  else renderHome();
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
