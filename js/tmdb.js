// Integración con la API de The Movie Database (TMDb)
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const TMDB_IMG_SMALL = "https://image.tmdb.org/t/p/w92";

const TMDB = {
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
    const url = `${TMDB_BASE}/movie/upcoming?api_key=${key}&language=es-AR&region=AR&page=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error obteniendo estrenos de TMDb");
    const json = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    return (json.results || [])
      .filter((m) => m.release_date && m.release_date >= today)
      .sort((a, b) => a.release_date.localeCompare(b.release_date));
  },

  async getDetails(tmdbId) {
    const key = window.APP_CONFIG.TMDB_API_KEY;
    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${key}&language=es-ES&append_to_response=credits`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error obteniendo detalles de TMDb");
    const data = await res.json();

    const director = (data.credits?.crew || []).find((c) => c.job === "Director");
    const castNames = (data.credits?.cast || [])
      .slice(0, 6)
      .map((c) => c.name)
      .join(", ");

    return {
      tmdb_id: data.id,
      title: data.title,
      poster_path: data.poster_path,
      release_date: data.release_date || null,
      director: director ? director.name : "",
      cast_names: castNames,
      duration_minutes: data.runtime || null,
      budget: data.budget || null,
      revenue: data.revenue || null,
      overview: data.overview || "",
    };
  },
};
