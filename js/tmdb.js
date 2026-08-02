// Integración con la API de The Movie Database (TMDb)
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const TMDB_IMG_SMALL = "https://image.tmdb.org/t/p/w92";

const LANG_NAMES = {
  en: "Inglés", es: "Español", fr: "Francés", it: "Italiano", de: "Alemán",
  pt: "Portugués", ja: "Japonés", ko: "Coreano", zh: "Chino", ru: "Ruso",
  hi: "Hindi", sv: "Sueco", da: "Danés", no: "Noruego", fi: "Finlandés",
  nl: "Neerlandés", pl: "Polaco", tr: "Turco", ar: "Árabe", th: "Tailandés",
};

let genreMapCache = null;
let tvGenreMapCache = null;

const TMDB = {
  languageName(code) {
    return LANG_NAMES[code] || (code ? code.toUpperCase() : "—");
  },

  posterUrl(path, small) {
    if (!path) return "";
    return (small ? TMDB_IMG_SMALL : TMDB_IMG) + path;
  },

  async genreMap() {
    if (genreMapCache) return genreMapCache;
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const res = await fetch(`${TMDB_BASE}/genre/movie/list?api_key=${key}&language=es-AR`);
    if (!res.ok) throw new Error("Error obteniendo géneros de TMDb");
    const json = await res.json();
    genreMapCache = {};
    (json.genres || []).forEach((g) => (genreMapCache[g.id] = g.name));
    return genreMapCache;
  },

  genreNames(genreIds, map) {
    return (genreIds || []).map((id) => map[id]).filter(Boolean).join(", ");
  },

  async tvGenreMap() {
    if (tvGenreMapCache) return tvGenreMapCache;
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const res = await fetch(`${TMDB_BASE}/genre/tv/list?api_key=${key}&language=es-AR`);
    if (!res.ok) throw new Error("Error obteniendo géneros de TMDb");
    const json = await res.json();
    tvGenreMapCache = {};
    (json.genres || []).forEach((g) => (tvGenreMapCache[g.id] = g.name));
    return tvGenreMapCache;
  },

  async search(query) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const url = `${TMDB_BASE}/search/movie?api_key=${key}&language=es-ES&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error buscando en TMDb");
    const json = await res.json();
    return json.results || [];
  },

  async upcomingAR() {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const today = new Date().toISOString().slice(0, 10);
    const pages = await Promise.all(
      [1, 2].map((page) =>
        fetch(`${TMDB_BASE}/movie/upcoming?api_key=${key}&language=es-AR&region=AR&page=${page}`).then((res) => {
          if (!res.ok) throw new Error("Error obteniendo estrenos de TMDb");
          return res.json();
        })
      )
    );
    const all = pages.flatMap((p) => p.results || []);
    const seen = new Set();
    const filtered = all.filter((m) => {
      if (!m.release_date || m.release_date < today) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    const genres = await this.genreMap();
    filtered.forEach((m) => (m.genre_names = this.genreNames(m.genre_ids, genres)));
    return filtered.sort((a, b) => a.release_date.localeCompare(b.release_date));
  },

  async nowPlayingAR() {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const pages = await Promise.all(
      [1, 2].map((page) =>
        fetch(`${TMDB_BASE}/movie/now_playing?api_key=${key}&language=es-AR&region=AR&page=${page}`).then((res) => {
          if (!res.ok) throw new Error("Error obteniendo cartelera de TMDb");
          return res.json();
        })
      )
    );
    const all = pages.flatMap((p) => p.results || []);
    const seen = new Set();
    const filtered = all.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    const genres = await this.genreMap();
    filtered.forEach((m) => (m.genre_names = this.genreNames(m.genre_ids, genres)));
    return filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  },

  async getDetails(tmdbId) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${key}&language=es-ES&append_to_response=credits,videos`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error obteniendo detalles de TMDb");
    const data = await res.json();

    const director = (data.credits?.crew || []).find((c) => c.job === "Director");
    const castNames = (data.credits?.cast || [])
      .slice(0, 6)
      .map((c) => c.name)
      .join(", ");

    const trailer = (data.videos?.results || []).find(
      (v) => v.site === "YouTube" && v.type === "Trailer"
    ) || (data.videos?.results || []).find((v) => v.site === "YouTube");

    return {
      tmdb_id: data.id,
      title: data.title,
      original_title: data.original_title,
      poster_path: data.poster_path,
      release_date: data.release_date || null,
      director: director ? director.name : "",
      cast_names: castNames,
      duration_minutes: data.runtime || null,
      budget: data.budget || null,
      revenue: data.revenue || null,
      overview: data.overview || "",
      original_language: data.original_language,
      trailer_key: trailer ? trailer.key : null,
      genre_names: (data.genres || []).map((g) => g.name).join(", "),
    };
  },

  async getWatchProvidersAR(movieId) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const res = await fetch(`${TMDB_BASE}/movie/${movieId}/watch/providers?api_key=${key}`);
    if (!res.ok) throw new Error("Error obteniendo plataformas de streaming");
    const json = await res.json();
    const ar = json.results?.AR || {};
    return {
      link: ar.link || null,
      flatrate: (ar.flatrate || []).map((p) => p.provider_name),
      rent: (ar.rent || []).map((p) => p.provider_name),
      buy: (ar.buy || []).map((p) => p.provider_name),
    };
  },

  async getTVWatchProvidersAR(tvId) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const res = await fetch(`${TMDB_BASE}/tv/${tvId}/watch/providers?api_key=${key}`);
    if (!res.ok) throw new Error("Error obteniendo plataformas de streaming");
    const json = await res.json();
    const ar = json.results?.AR || {};
    return {
      link: ar.link || null,
      flatrate: (ar.flatrate || []).map((p) => p.provider_name),
      rent: (ar.rent || []).map((p) => p.provider_name),
      buy: (ar.buy || []).map((p) => p.provider_name),
    };
  },

  async searchTV(query) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const url = `${TMDB_BASE}/search/tv?api_key=${key}&language=es-ES&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error buscando series en TMDb");
    const json = await res.json();
    return json.results || [];
  },

  async getTVDetails(tmdbId) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${key}&language=es-ES&append_to_response=credits,videos`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error obteniendo detalles de la serie");
    const data = await res.json();

    const castNames = (data.credits?.cast || [])
      .slice(0, 6)
      .map((c) => c.name)
      .join(", ");
    const creatorNames = (data.created_by || []).map((c) => c.name).join(", ");

    const trailer = (data.videos?.results || []).find(
      (v) => v.site === "YouTube" && v.type === "Trailer"
    ) || (data.videos?.results || []).find((v) => v.site === "YouTube");

    return {
      tmdb_id: data.id,
      title: data.name,
      original_title: data.original_name,
      poster_path: data.poster_path,
      first_air_date: data.first_air_date || null,
      creator: creatorNames,
      cast_names: castNames,
      number_of_seasons: data.number_of_seasons || null,
      overview: data.overview || "",
      genre_names: (data.genres || []).map((g) => g.name).join(", "),
      original_language: data.original_language,
      trailer_key: trailer ? trailer.key : null,
    };
  },

  async tvRecommendations(tmdbId) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/recommendations?api_key=${key}&language=es-AR&page=1`);
    if (!res.ok) throw new Error("Error obteniendo recomendaciones de TMDb");
    const json = await res.json();
    const genres = await this.tvGenreMap();
    const results = json.results || [];
    results.forEach((s) => (s.genre_names = this.genreNames(s.genre_ids, genres)));
    return results;
  },
};
