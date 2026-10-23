import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const providers = [
  {
    id: "groq", label: "Groq",
    enabled: () => Boolean(process.env.GROQ_API_KEY),
    call: (messages) => openAICompatible({
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages
    })
  },
  {
    id: "mistral", label: "Mistral",
    enabled: () => Boolean(process.env.MISTRAL_API_KEY),
    call: (messages) => openAICompatible({
      url: "https://api.mistral.ai/v1/chat/completions",
      key: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL || "mistral-small-latest",
      messages
    })
  },
  {
    id: "openrouter", label: "OpenRouter",
    enabled: () => Boolean(process.env.OPENROUTER_API_KEY),
    call: (messages) => openAICompatible({
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      messages,
      extraHeaders: { "HTTP-Referer": "https://dark-ai.local", "X-Title": "DARK AI" }
    })
  },
  {
    id: "gemini", label: "Gemini",
    enabled: () => Boolean(process.env.GEMINI_API_KEY),
    call: (messages) => callGemini(messages)
  },
  {
    id: "cloudflare", label: "Cloudflare",
    enabled: () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    call: (messages) => callCloudflare(messages)
  }
];

async function openAICompatible({ url, key, model, messages, extraHeaders = {} }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 900 })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Provider returned ${response.status}`);
  return data?.choices?.[0]?.message?.content?.trim() || "No text returned.";
}

async function callGemini(messages) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const system = messages.find(m => m.role === "system")?.content || "";
  const contents = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content) }]
  }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 900 }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini returned ${response.status}`);
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim() || "No text returned.";
}

async function callCloudflare(messages) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${encodeURIComponent(model)}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: 900 })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data?.errors?.[0]?.message || `Cloudflare returned ${response.status}`);
  return data?.result?.response || data?.result?.output_text || JSON.stringify(data.result || {});
}

const baseSystem = `You are DARK AI, a helpful, accurate assistant. Reply in the user's language. Be clear and useful. Do not claim certainty when unsure.`;

function buildMessages(history, rolePrompt) {
  const safeHistory = Array.isArray(history) ? history.slice(-12).filter(m =>
    m && ["user", "assistant"].includes(m.role) && typeof m.content === "string"
  ).map(m => ({ role: m.role, content: m.content.slice(0, 8000) })) : [];
  return [
    { role: "system", content: `${baseSystem}\n${rolePrompt}` },
    ...safeHistory
  ];
}

app.get("/api/status", (_req, res) => {
  res.json({
    name: "DARK AI",
    providers: providers.map(p => ({ id: p.id, label: p.label, configured: p.enabled() }))
  });
});

app.post("/api/chat", async (req, res) => {
  const history = req.body?.messages;
  if (!Array.isArray(history) || !history.length) {
    return res.status(400).json({ error: "Trimite un mesaj ca să începem." });
  }
  const enabled = providers.filter(p => p.enabled());
  if (!enabled.length) {
    return res.status(503).json({
      error: "Nu este configurat niciun furnizor AI. Copiază .env.example în .env și adaugă cel puțin o cheie API."
    });
  }

  const lastUserMessage = [...history].reverse().find(m => m?.role === "user")?.content;
  if (typeof lastUserMessage !== "string" || !lastUserMessage.trim()) {
    return res.status(400).json({ error: "Mesajul este gol." });
  }

  // Distinct roles encourage genuinely different independent drafts.
  const roles = [
    "Approach the question directly. Prioritize speed, clarity, and a practical answer.",
    "Think carefully about logic, assumptions, and edge cases. Give a different perspective.",
    "Focus on technical accuracy, concrete steps, and examples where useful.",
    "Act as a critical reviewer. Identify mistakes, missing context, or risks before proposing an answer.",
    "Look for a simple, creative solution. Avoid repeating other generic answers."
  ];

  const results = await Promise.all(enabled.map(async (provider, index) => {
    try {
      const answer = await provider.call(buildMessages(history, roles[index % roles.length]));
      return { id: provider.id, label: provider.label, ok: true, answer };
    } catch (error) {
      return { id: provider.id, label: provider.label, ok: false, error: String(error.message || "Request failed").slice(0, 240) };
    }
  }));

  const successful = results.filter(r => r.ok);
  if (!successful.length) {
    return res.status(502).json({
      error: "Niciun AI nu a răspuns. Verifică cheile API și limitele furnizorilor.",
      providers: results
    });
  }

  // Ask the first successful provider to synthesize the independent drafts.
  // If synthesis fails, return the best available independent draft instead.
  const coordinator = enabled.find(p => successful.some(r => r.id === p.id));
  const drafts = successful.map(r => `### ${r.label}\n${r.answer}`).join("\n\n");
  let finalAnswer = successful[0].answer;
  let synthesisUsed = false;
  try {
    const synthesisMessages = [
      { role: "system", content: `${baseSystem}
You are the coordinator for a panel of AI assistants. Compare the drafts, resolve contradictions, discard unsupported claims, and combine the strongest ideas into ONE clear, useful answer. Do not simply concatenate the drafts or mention internal panel mechanics. If uncertainty remains, say so. Reply in the user's language.` },
      { role: "user", content: `Original question:\n${lastUserMessage}\n\nIndependent drafts:\n${drafts}\n\nProduce the best final answer.` }
    ];
    finalAnswer = await coordinator.call(synthesisMessages);
    synthesisUsed = Boolean(finalAnswer);
  } catch {
    // Preserve a usable response if the extra coordinator request hits a rate limit.
  }

  res.json({
    answer: finalAnswer,
    synthesisUsed,
    providers: results.map(r => ({
      id: r.id, label: r.label, ok: r.ok,
      ...(r.ok ? {} : { error: r.error })
    })),
    successfulCount: successful.length
  });
});

app.get("*", (_req, res) => res.sendFile(process.cwd() + "/public/index.html"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DARK AI running on http://localhost:${PORT}`);
});
