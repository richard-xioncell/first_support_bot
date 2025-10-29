import { NextResponse } from "next/server";
import * as mammoth from "mammoth";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs"; // ensure Node runtime (important for file parsing)

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // --- Validate supported file types ---
    const supportedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "text/plain",
    ];

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // --- Extract text depending on file type ---
    let extractedText = "";

    // PDF
    if (file.type === "application/pdf") {
      // Dynamically import pdf-parse (handles both ESM and CJS)
      const pdfModule: any = await import("pdf-parse");
      const pdfParse =
        typeof pdfModule === "function"
        ? pdfModule
        : pdfModule.default || pdfModule.pdf || pdfModule;

      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdfParse(buffer);
      extractedText = data.text || "";
    }


    // DOCX
    else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }
    // TXT
    else if (file.type === "text/plain") {
      extractedText = await file.text();
    }

    extractedText = extractedText.trim();

    if (!extractedText) {
      return NextResponse.json(
        { error: "No readable text could be extracted from the file." },
        { status: 400 }
      );
    }

    // --- Send text to /api/upload for embedding ---
    const uploadRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name.replace(/\.[^/.]+$/, ""), // strip file extension
          content: extractedText,
        }),
      }
    );

    const result = await uploadRes.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in /api/ingest-file-upload:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

