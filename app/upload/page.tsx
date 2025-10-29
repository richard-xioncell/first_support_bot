"use client";
import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus("⚠️ PLEASE SELECT A FILE FIRST!");
      return;
    }

    setStatus("⏳ UPLOADING...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/ingest-file-upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      setStatus("✅ FILE UPLOADED SUCCESSFULLY!");
      console.log("Server response:", data);
    } else {
      setStatus(`❌ ERROR: ${data.error || "UPLOAD FAILED"}`);
      console.error(data);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#1c1c1c",
        color: "#fff",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "1.3rem",
          marginBottom: "1.5rem",
          letterSpacing: "1px",
          color: "#ccff00",
          textTransform: "uppercase",
          fontWeight: "700",
        }}
      >
        Upload Document
      </h1>

      <form
        onSubmit={handleUpload}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.2rem",
          background: "#2a2a2a",
          padding: "2.2rem",
          borderRadius: "12px",
          boxShadow: "0 0 25px rgba(0,0,0,0.4)",
        }}
      >
        {/* Choose File Button */}
        <label
          htmlFor="fileInput"
          style={{
            background: "#333",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            cursor: "pointer",
            border: "2px solid transparent",
            transition: "all 0.3s ease",
            display: "inline-block",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 0 15px #00ffff";
            e.currentTarget.style.border = "2px solid #00ffff";
            e.currentTarget.style.color = "#00ffff";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.border = "2px solid transparent";
            e.currentTarget.style.color = "#fff";
          }}
        >
          📁 Choose File
        </label>
        <input
          id="fileInput"
          type="file"
          accept=".pdf,.docx,.txt"
          style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {file && <p style={{ color: "#aaa" }}>Selected: {file.name}</p>}

        {/* Upload & Ingest Button */}
        <button
          type="submit"
          style={{
            background: "#333",
            color: "#fff",
            border: "2px solid transparent",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 0 15px #ccff00";
            e.currentTarget.style.border = "2px solid #ccff00";
            e.currentTarget.style.color = "#ccff00";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.border = "2px solid transparent";
            e.currentTarget.style.color = "#fff";
          }}
        >
          🚀 UPLOAD & INGEST
        </button>
      </form>

      <p
        style={{
          marginTop: "1.5rem",
          color: "#ccc",
          fontSize: "1rem",
          textAlign: "center",
        }}
      >
        {status}
      </p>
    </div>
  );
}
