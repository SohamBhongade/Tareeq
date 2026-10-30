import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { ISSUE_CATEGORIES, OTHER_CATEGORY } from "./categories";
import type { AnalysisResult } from "./types";

/**
 * Photo triage with automatic fallback between AI providers.
 *
 * Order (each step has a hard time limit, so the page never hangs):
 *   1. Gemini Flash-Lite — fast, cheap, good enough for "what is in this photo"
 *   2. Groq (Qwen 3.8 vision) — very low latency backup, if GROQ_API_KEY is set
 *   3. Gemini Flash      — bigger Gemini model as a last resort
 *
 * Set AI_PROVIDER=groq to try Groq first instead.
 */

export class AIError extends Error {
  constructor(public userMessage: string, public status = 502) {
    super(userMessage);
    this.name = "AIError";
  }
}

const env = (k: string) => process.env[k]?.trim() || "";
const GEMINI_MODEL = () => env("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const GEMINI_FALLBACK_MODEL = () => env("GEMINI_FALLBACK_MODEL") || "gemini-3.6-flash";
const GROQ_MODEL = () => env("GROQ_MODEL") || "qwen/qwen3.8-27b";
const STEP_TIMEOUT_MS = () => Number(env("AI_TIMEOUT_MS")) || 12000;

export function aiConfigured(): boolean {
  return !!(env("GEMINI_API_KEY") || env("GROQ_API_KEY"));
}

const SYSTEM_PROMPT = [
  "You are a senior municipal-maintenance inspector for Ras Al Khaimah, UAE.",
  "You are shown one photograph of a street or public-infrastructure issue taken by a resident.",
  "",
  "Return ONLY a JSON object with exactly four keys:",
  `  "category"    — MUST be one of EXACTLY these values (case-sensitive): ${[...ISSUE_CATEGORIES, OTHER_CATEGORY].join(" | ")}`,
  '  "severity"    — integer 1–10 (1 = cosmetic, 10 = immediate danger to life)',
  '  "description" — 1–2 factual sentences in English, max 280 characters, describing what is visible',
  '  "description_ar" — the same description in clear Modern Standard Arabic',
  "",
  "STRICT RULES:",
  "  • Pick the single best match from the list. Do not invent, abbreviate, pluralize, or rephrase categories.",
  `  • If the photo does not clearly show any listed issue, return "${OTHER_CATEGORY}".`,
  '  • Synonyms map to canonical: "trash"/"rubbish"/"plastic waste" → "Litter Accumulation"; "weeds"/"bushes" → "Overgrown Vegetation"; ' +
    '"streetlight"/"lamppost" → "Broken Street Lights"; "pipe burst"/"sewage" → "Broken Pipelines"; ' +
    '"tagging"/"spray paint" → "Graffiti".',
  "  • Describe only what is visible. Do not guess at causes.",
  "  • No markdown, no explanation — the JSON object only.",
].join("\n");

const USER_INSTRUCTION = "Analyze this street-issue photograph and return the JSON object.";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, enum: [...ISSUE_CATEGORIES, OTHER_CATEGORY] },
    severity: { type: Type.INTEGER },
    description: { type: Type.STRING },
    description_ar: { type: Type.STRING },
  },
  required: ["category", "severity", "description", "description_ar"],
  propertyOrdering: ["category", "severity", "description", "description_ar"],
};

// ── providers ──────────────────────────────────────────────────────────

let geminiClient: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  geminiClient ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  return geminiClient;
}

async function askGemini(model: string, base64: string, mimeType: string): Promise<string | undefined> {
  const res = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: USER_INSTRUCTION }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      abortSignal: AbortSignal.timeout(STEP_TIMEOUT_MS()),
    },
  });
  return res.text;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function askGroq(base64: string, mimeType: string): Promise<string | undefined> {
  const body = (extra: Record<string, unknown>) =>
    JSON.stringify({
      model: GROQ_MODEL(),
      temperature: 0.1,
      max_completion_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_INSTRUCTION },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      ...extra,
    });

  const send = async (extra: Record<string, unknown>) => {
    const base = env("GROQ_BASE_URL") || "https://api.groq.com/openai/v1";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("GROQ_API_KEY")}` },
      body: body(extra),
      signal: AbortSignal.timeout(STEP_TIMEOUT_MS()),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text.slice(0, 400));
    const j = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? undefined;
  };

  // Ask the model to skip its "thinking" step for speed. If this model
  // doesn't accept that option, retry without it.
  try {
    return await send({ reasoning_effort: "none" });
  } catch (e) {
    if (e instanceof HttpError && e.status === 400 && /reasoning/i.test(e.message)) return send({});
    throw e;
  }
}

// ── orchestration ──────────────────────────────────────────────────────

interface Step {
  label: string;
  run: (b64: string, mime: string) => Promise<string | undefined>;
}

function plan(): Step[] {
  const g = env("GEMINI_API_KEY");
  const q = env("GROQ_API_KEY");
  const geminiMain: Step[] = g ? [{ label: `Gemini · ${GEMINI_MODEL()}`, run: (b, m) => askGemini(GEMINI_MODEL(), b, m) }] : [];
  const geminiBackup: Step[] =
    g && GEMINI_FALLBACK_MODEL() !== GEMINI_MODEL()
      ? [{ label: `Gemini · ${GEMINI_FALLBACK_MODEL()}`, run: (b, m) => askGemini(GEMINI_FALLBACK_MODEL(), b, m) }]
      : [];
  const groq: Step[] = q ? [{ label: `Groq · ${GROQ_MODEL()}`, run: askGroq }] : [];
  return env("AI_PROVIDER").toLowerCase() === "groq"
    ? [...groq, ...geminiMain, ...geminiBackup]
    : [...geminiMain, ...groq, ...geminiBackup];
}

export async function analyzeImage(base64: string, mimeType: string): Promise<AnalysisResult> {
  const steps = plan();
  if (steps.length === 0) {
    // Demo mode: no AI key configured. Clearly marked in the UI.
    return {
      category: OTHER_CATEGORY,
      severity: 3,
      description: "Photo submitted by a resident. Category chosen manually.",
      descriptionAr: "صورة أرسلها أحد المقيمين. تم اختيار النوع يدوياً.",
      demo: true,
    };
  }

  let lastError: unknown = null;
  for (const step of steps) {
    const started = Date.now();
    try {
      const text = await step.run(base64, mimeType);
      const result = parseResult(text);
      console.log(`[ai] ${step.label} answered in ${Date.now() - started} ms → ${result.category} ${result.severity}/10`);
      return { ...result, provider: step.label };
    } catch (e: unknown) {
      lastError = e;
      const status = (e as { status?: number })?.status;
      const name = (e as Error)?.name;
      const msg = name === "TimeoutError" || name === "AbortError" ? `timed out after ${STEP_TIMEOUT_MS() / 1000}s` : String((e as Error)?.message ?? e);
      // The real reason, printed in the terminal running the site.
      console.error(`[ai] ${step.label} failed after ${Date.now() - started} ms — ${status ? `status ${status}: ` : ""}${msg.slice(0, 400)}`);
    }
  }
  throw toAIError(lastError);
}

function toAIError(e: unknown): AIError {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number })?.status;
  const name = (e as Error)?.name;
  if (name === "TimeoutError" || name === "AbortError") return new AIError("The AI took too long to respond. Please try again.", 504);
  if (/API_KEY_INVALID|API key not valid|invalid_api_key/i.test(msg)) return new AIError("The AI key is invalid. Check the keys in .env.local.", 500);
  if (status === 401 || status === 403 || /PERMISSION_DENIED/i.test(msg)) return new AIError("The AI key isn't allowed to use this model. Check the keys in .env.local.", 500);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) return new AIError("AI rate limit reached. Wait a moment and try again.", 429);
  if (status === 404 || /not found|does not exist|decommissioned/i.test(msg)) return new AIError("The AI model wasn't found. Check the model names in .env.local.", 500);
  if (status === 503 || status === 500 || /UNAVAILABLE|overloaded/i.test(msg)) return new AIError("The AI is temporarily busy. Please retry in a few seconds.", 503);
  if (status === 400) return new AIError("The AI could not process this image. Try a clearer photo or a different angle.", 400);
  return new AIError("The AI service could not be reached. Please try again.", 502);
}

function parseResult(raw: string | undefined): AnalysisResult {
  const fallback: AnalysisResult = {
    category: OTHER_CATEGORY,
    severity: 1,
    description: "AI analysis could not be completed. Please pick a category manually.",
  };
  if (!raw) return fallback;
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (text.startsWith("```")) text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  try {
    const j = JSON.parse(text);
    const allowed = new Set<string>([...ISSUE_CATEGORIES, OTHER_CATEGORY]);
    const cat = typeof j.category === "string" ? j.category.trim() : "";
    const category = allowed.has(cat) ? cat : OTHER_CATEGORY;
    const sev = Math.min(10, Math.max(1, Math.round(Number(j.severity) || 1)));
    const description =
      typeof j.description === "string" && j.description.trim() ? j.description.trim().slice(0, 400) : fallback.description;
    const descriptionAr =
      typeof j.description_ar === "string" && /[\u0600-\u06FF]/.test(j.description_ar) ? j.description_ar.trim().slice(0, 400) : null;
    return { category, severity: sev, description, descriptionAr };
  } catch {
    return fallback;
  }
}
