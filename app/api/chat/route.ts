// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { queryRelevantChunks } from "@/lib/queryHelper";

export const runtime = "nodejs"; // or "edge" if you’re using edge functions

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const HARD_TOP_K = Number(process.env.RAG_TOP_K || 8);

const SYSTEM_PROMPT = `You are First Support Bot.

Your purpose is to assist users by answering **only using information contained in the uploaded business documentation**.
You may reason and paraphrase intelligently within that scope — for example, if the documentation explains a process or feature, you can summarize or restate it naturally in response to user questions.

Guidelines:
- All answers must be clearly grounded in the uploaded content.
- You may interpret meaning and infer logically, but never invent facts.
- If the question is unrelated to the uploaded material, respond exactly with:
  "I can only answer questions that are covered in the uploaded documentation."
- Be clear, professional, and concise.`;

type RagChunk = {
  id?: string;
  content: string;
  source?: string;     // filename or doc title
  document_id?: string;
  chunk_index?: number;
  similarity?: number; // returned by vector search
};

function buildContextBlock(chunks: RagChunk[]) {
  const lines = chunks.map((c, i) => {
    const src = c.source ?? c.document_id ?? "unknown_source";
    return `--- CHUNK ${i + 1} (source: ${src}) ---\n${c.content}`;
  });
  return lines.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage: string = body?.message ?? "";

    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json(
        { error: "Missing 'message' string in body." },
        { status: 400 }
      );
    }

    // 1) Retrieve top-K relevant chunks from Supabase (vector search)
    const chunks: RagChunk[] = await queryRelevantChunks(userMessage, HARD_TOP_K);

    const hasContext =
      Array.isArray(chunks) &&
      chunks.length > 0 &&
      chunks.some((c) => (c?.content ?? "").trim().length > 0);

    // 2) If no relevant context found → refuse
    if (!hasContext) {
      const refusal =
        "I can only answer questions that are covered in the uploaded documentation.";
      return NextResponse.json({
        reply: refusal,
        sources: [],
        outOfScope: true,
      });
    }

    // 3) Build the CONTEXT text block for the model
    const CONTEXT = buildContextBlock(chunks);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 4) Create the completion with strict instructions
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2, // keeps it grounded but allows natural language
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `CONTEXT:\n${CONTEXT}\n\n` +
            `---\nUSER QUESTION:\n${userMessage}\n\n` +
            `INSTRUCTIONS:\n` +
            `Answer only using information contained or implied in the CONTEXT. ` +
            `If the answer cannot be clearly derived from the CONTEXT, reply with the exact refusal line.`,
        },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I can only answer questions that are covered in the uploaded documentation.";

    // 5) Build sources array (optional for UI)
    const sources = (chunks || []).map((c) => ({
      source: c.source ?? c.document_id ?? "unknown_source",
      chunkIndex: c.chunk_index ?? null,
      similarity: c.similarity ?? null,
    }));

    // 6) Enforce fallback guard (just in case)
    const enforced =
      reply.includes("I can only answer questions that are covered in the uploaded documentation.")
        ? { reply, outOfScope: true }
        : { reply, outOfScope: false };

    return NextResponse.json({ ...enforced, sources });
  } catch (err: any) {
    console.error("[/api/chat] error:", err);
    return NextResponse.json(
      { error: "Chat endpoint failed.", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

