-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Migrate embeddings: JSONB array -> vector(768) (nomic-embed-text dimension)
ALTER TABLE "embeddings"
  ALTER COLUMN "embedding" TYPE vector(768)
  USING embedding::text::vector(768);

-- HNSW cosine index for fast ANN search
CREATE INDEX "embeddings_embedding_hnsw_idx"
  ON "embeddings"
  USING hnsw ("embedding" vector_cosine_ops);
