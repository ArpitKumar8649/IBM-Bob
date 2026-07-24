/**
 * Embedding service for the Story Bible RAG.
 *
 * Produces a vector for a piece of text so story facts can be retrieved by
 * semantic similarity. Two backends:
 *
 * 1. IBM watsonx `granite-embedding` (used when WATSONX creds are present) —
 *    real semantic embeddings, the production path.
 * 2. A local deterministic hash-based embedding (fallback) — a genuine
 *    bag-of-words vector via feature hashing. Lets RAG work end-to-end with
 *    zero extra config / offline. Not as semantically rich as a neural model,
 *    but it captures lexical overlap well enough for a per-room knowledge base.
 *
 * Both return fixed-dimension vectors so cosine similarity is consistent.
 */

const EMBED_DIM = 384;

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Local deterministic embedding via feature hashing (the "hashing trick").
 * Tokenizes, hashes each token into one of EMBED_DIM buckets with a sign,
 * then L2-normalizes. Deterministic: same text -> same vector, always.
 */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  for (const token of tokens) {
    // Two independent hashes: one for the bucket, one for the sign.
    const bucket = fnv1a(token) % EMBED_DIM;
    const sign = fnv1a(token + "#sign") % 2 === 0 ? 1 : -1;
    vec[bucket] += sign;
  }

  // L2 normalize.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return vec;
}

/** FNV-1a 32-bit hash — fast, well-distributed, deterministic. */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Embed text using watsonx granite-embedding if configured, else the local
 * fallback. Returns a fixed-dimension vector.
 */
export async function embed(text: string): Promise<number[]> {
  const hasWatsonx =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_EMBED_MODEL_ID;

  if (hasWatsonx) {
    try {
      return await watsonxEmbed(text);
    } catch (err) {
      console.warn("watsonx embedding failed, falling back to local:", err);
      return localEmbed(text);
    }
  }

  return localEmbed(text);
}

/**
 * watsonx embeddings via the REST API (granite-embedding models).
 * Endpoint: POST /ml/v1/text/embeddings
 */
async function watsonxEmbed(text: string): Promise<number[]> {
  const projectId = process.env.WATSONX_PROJECT_ID!;
  const modelId = process.env.WATSONX_EMBED_MODEL_ID || "ibm/granite-embedding-107m-multilingual";
  const baseUrl = process.env.WATSONX_URL || "https://us-south.ml.cloud.ibm.com";
  const apiKey = process.env.WATSONX_API_KEY!;

  // 1. Exchange API key for an IAM bearer token.
  const tokenRes = await fetch(
    "https://iam.cloud.ibm.com/identity/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "urn:ibm:params:oauth:grant-type:apikey",
        apikey: apiKey,
      }),
    }
  );
  if (!tokenRes.ok) throw new Error(`IAM token failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // 2. Request the embedding.
  const embedRes = await fetch(
    `${baseUrl}/ml/v1/text/embeddings?version=2024-01-01`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model_id: modelId,
        project_id: projectId,
        inputs: [text],
      }),
    }
  );
  if (!embedRes.ok) throw new Error(`watsonx embeddings failed: ${embedRes.status}`);

  const data = (await embedRes.json()) as {
    results?: { embedding: number[] }[];
  };
  const embedding = data.results?.[0]?.embedding;
  if (!embedding) throw new Error("watsonx returned no embedding");
  return embedding;
}
