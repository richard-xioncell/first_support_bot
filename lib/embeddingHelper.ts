// lib/embeddingHelper.ts
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function embedAndStoreDocument(
  text: string,
  documentId: string,
  source: string
) {
  // ✅ Split with overlap so related concepts appear together
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitText(text);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });
    const [{ embedding }] = embeddingResponse.data;

    const { error } = await supabase.from("embeddings").insert({
      document_id: documentId,
      source,
      content_chunk: chunk,
      embedding,
      chunk_index: i,
    });

    if (error) console.error("❌ Insert error:", error);
  }

  console.log(`✅ Embedded ${chunks.length} chunks for ${source}`);
}

