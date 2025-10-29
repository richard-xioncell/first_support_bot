import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query)
      return NextResponse.json({ error: "Missing query" }, { status: 400 });

    // 1️⃣ create embedding for the user’s question
    const embedRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embedRes.data[0].embedding;

    // 2️⃣ call Supabase function to find similar document chunks
    const { data: matches, error } = await supabase.rpc("match_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7, // similarity cutoff (1 = identical)
      match_count: 3,       // how many chunks to return
    });
    if (error) throw error;

    // 3️⃣ return the best matches
    return NextResponse.json({ matches });
  } catch (err) {
    console.error("Error in /api/search:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
