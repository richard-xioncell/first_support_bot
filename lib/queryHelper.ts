// lib/queryHelper.ts
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function queryRelevantChunks(query: string, topK = 8) {
  // 1. Generate alternative phrasings
  const rephrase = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You generate short alternative phrasings of a question that mean the same thing. Return them comma-separated.",
      },
      { role: "user", content: query },
    ],
  });

  const altText = rephrase.choices?.[0]?.message?.content || "";
  const variants = [query, ...altText.split(",").map((v) => v.trim())].filter(
    (v) => v.length > 0
  );

  const allResults: any[] = [];

  for (const variant of variants) {
    console.log("🔎 variant:", variant);

    const embed = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: variant,
    });
    const vector = embed.data[0].embedding;

    const { data, error } = await supabase.rpc("match_embeddings", {
      query_embedding: vector,
      match_threshold: 0.35, // ✅ loosened threshold
      match_count: topK,
    });

    if (error) {
      console.error("match_embeddings error:", error);
      continue;
    }

    allResults.push(...(data || []));
  }

  // Deduplicate + sort
  const unique = new Map();
  for (const r of allResults) {
    if (!unique.has(r.id) || r.similarity > unique.get(r.id).similarity) {
      unique.set(r.id, r);
    }
  }

  const final = Array.from(unique.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  console.log(
    "🔍 Combined RAG similarities:",
    final.map((f) => f.similarity)
  );

  return final.map((d: any) => ({
    content: d.content_chunk,
    similarity: d.similarity,
    source: d.document_id,
    document_id: d.document_id,
  }));
}

