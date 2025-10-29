// app/page.tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    // push user message
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ FIX: send "message" instead of "content"
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }

      const reply =
        data?.reply ||
        data?.message ||
        "I can only answer questions that are covered in the uploaded documentation.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Hmm, I hit an error. Try again.\n\n" +
            (err?.message || "Unknown error"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-between min-h-screen p-8">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-center">
          First Support Bot
        </h1>

        <div className="border rounded-md p-4 h-[60vh] overflow-y-auto bg-gray-50">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`mb-3 ${
                m.role === "user" ? "text-blue-700" : "text-gray-800"
              }`}
            >
              <strong>{m.role === "user" ? "You" : "Bot"}:</strong>{" "}
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="text-gray-500 italic">Bot is thinking…</div>
          )}
        </div>

        <form
          onSubmit={sendMessage}
          className="flex gap-2 border-t pt-4 mt-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border rounded-md p-2"
            placeholder="Ask a question about your documentation..."
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}

