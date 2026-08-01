// Cliente de Supabase, inicializado con las claves de config.js
const sb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

const DB = {
  async listMovies() {
    const { data, error } = await sb
      .from("movies")
      .select("*, ratings(*)")
      .order("watched_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getMovie(id) {
    const { data, error } = await sb
      .from("movies")
      .select("*, ratings(*)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async addMovie(movie) {
    const { data, error } = await sb.from("movies").insert(movie).select().single();
    if (error) throw error;
    return data;
  },

  async upsertRating(rating) {
    const { data, error } = await sb
      .from("ratings")
      .upsert(rating, { onConflict: "movie_id,user_name" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteMovie(id) {
    const { error } = await sb.from("movies").delete().eq("id", id);
    if (error) throw error;
  },

  async listPredictions() {
    const { data, error } = await sb.from("predictions").select("*");
    if (error) throw error;
    return data;
  },

  async upsertPrediction(prediction) {
    const { data, error } = await sb
      .from("predictions")
      .upsert(prediction, { onConflict: "tmdb_id,user_name" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPredictionsFor(tmdbId) {
    const { data, error } = await sb.from("predictions").select("*").eq("tmdb_id", tmdbId);
    if (error) throw error;
    return data;
  },
};
