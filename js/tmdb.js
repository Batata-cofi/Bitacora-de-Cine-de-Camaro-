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

const TMDB = {
  languageName(code) {
    return LANG_NAMES[code] || (code ? code.toUpperCase() : "—");
  },

  posterUrl(path, small) {
    if (!path) return "";
    return (small ? TMDB_IMG_SMALL : TMDB_IMG) + path;
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
    return all
      .filter((m) => {
        if (!m.release_date || m.release_date < today) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .sort((a, b) => a.release_date.localeCompare(b.release_date));
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
    return all
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
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
    };
  },
};
