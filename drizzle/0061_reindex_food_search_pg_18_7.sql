-- PostgreSQL 18.7 (2026-11-12) fixed GIN bugs that could leave index entries pointing at the wrong rows, and
-- recommends REINDEX where that may have happened. obur's only GIN index is the food search trigram index; it is
-- small, so it is rebuilt once on every installation (2026-11-20 audit, R04).
REINDEX INDEX "foods_search_key_trgm_idx";
