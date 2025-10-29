// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ---- chunker with overlap ----
function chunkWithOverlap(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  if (!text) return chunks;

  const len = text.length;
  let start = 0;

  while (start < len) {
    const end = Math.min(start + chunkSize, len);
    const slice = text.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end === len) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title: string = body?.title ?? "Untitled";
    const content: string = body?.content ?? "";

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing 'content' (string) in request body." },
        { status: 400 }
      );
    }

    // 1️⃣ Insert into documents table first
    const { data: docRows, error: docErr } = await supabase
      .from("documents")
      .insert([{ title, content }])
      .select("id")
      .limit(1);

    if (docErr || !docRows?.length) {
      console.error("❌ Document insert error:", docErr);
      return NextResponse.json(
        { error: "Failed to insert document metadata." },
        { status: 500 }
      );
    }

    const documentId = docRows[0].id;

    // 2️⃣ Split text with overlap
    const chunks = chunkWithOverlap(content, 1000, 200);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No chunkable content after preprocessing." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let inserted = 0;
    const BATCH = 16;

    // 3️⃣ Create embeddings and insert each batch into embeddings table
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const resp = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch,
      });

      const rows = resp.data.map((row, k) => ({
        document_id: documentId,
        chunk_index: i + k,
        content_chunk: batch[k],
        embedding: row.embedding,
      }));

      const { error } = await supabase.from("embeddings").insert(rows);
      if (error) {
        console.error("❌ Embeddings insert error:", error);
        return NextResponse.json(
          { error: "Failed to insert embeddings.", details: error.message },
          { status: 500 }
        );
      }

      inserted += rows.length;
    }

    console.log(`✅ Stored document '${title}' with ${inserted} chunks (id: ${documentId})`);

    return NextResponse.json({
      success: true,
      message: `Stored document '${title}' with ${inserted} chunks.`,
      documentId,
    });
  } catch (err: any) {
    console.error("❌ /api/upload error:", err);
    return NextResponse.json(
      { error: err?.message || "Upload/embedding failed." },
      { status: 500 }
    );
  }
}


