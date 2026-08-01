// Integración con OMDb (Rotten Tomatoes / Metacritic / IMDb) para la "opinión de la crítica"
const OMDB_BASE = "https://www.omdbapi.com/";

const OMDB = {
  // Convierte los ratings crudos de OMDb en un score 0-100 y una etiqueta legible
  async criticScore(title, year) {
    const key = window.APP_CONFIG.OMDB_API_KEY;
    if (!key || key === "TU-OMDB-API-KEY") return { available: false, reason: "no-key" };

    const url = `${OMDB_BASE}?apikey=${key}&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}&type=movie`;
    const res = await fetch(url);
    if (!res.ok) return { available: false, reason: "http-error" };
    const data = await res.json();

    if (data.Response !== "True") return { available: false, reason: "not-found" };

    const ratings = data.Ratings || [];
    const rt = ratings.find((r) => r.Source === "Rotten Tomatoes");
    const mc = ratings.find((r) => r.Source === "Metacritic");
    const imdb = data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null;

    let score = null;
    let source = null;

    if (rt) {
      score = parseInt(rt.Value, 10);
      source = "Rotten Tomatoes";
    } else if (mc) {
      score = parseInt(mc.Value, 10);
      source = "Metacritic";
    } else if (imdb) {
      score = Math.round(parseFloat(imdb) * 10);
      source = "IMDb";
    }

    if (score === null || Number.isNaN(score)) return { available: false, reason: "no-ratings-yet" };

    let label, emoji;
    if (score >= 75) {
      label = "La crítica la banca";
      emoji = "🏆";
    } else if (score >= 50) {
      label = "Críticas parejas";
      emoji = "👍";
    } else {
      label = "Críticas flojas";
      emoji = "📉";
    }

    return { available: true, score, source, label, emoji };
  },
};
