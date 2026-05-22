import { writeLastDigest } from "./digest-cache.js";
import type { DigestResult } from "./types.js";

export interface RunOpenRouterDigestOptions {
  apiKey: string;
  model: string;
  prompt: string;
  cacheRoot: string;
  repoRoot: string;
  fetchImpl?: typeof fetch;
}

export interface RunOpenRouterDigestResult {
  result?: DigestResult;
  cacheFile?: string;
  error?: string;
}

export async function runOpenRouterDigest(options: RunOpenRouterDigestOptions): Promise<RunOpenRouterDigestResult> {
  const fetcher = options.fetchImpl ?? fetch;
  const model = options.model || "nvidia/nemotron-3-super-120b-a12b:free";

  try {
    const resp = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/statusnone420/repo-quest-log",
        "X-Title": "RepoLog",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: options.prompt }],
        response_format: { type: "json_object" },
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      return { error: await friendlyOpenRouterError(resp, model) };
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const rawContent = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawContent) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const result: DigestResult = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "No summary returned.",
      stuck: typeof parsed.stuck === "string" ? parsed.stuck : "Unknown.",
      next: typeof parsed.next === "string" ? parsed.next : "Unknown.",
      generatedAt: new Date().toISOString(),
      model,
    };
    const cacheFile = await writeLastDigest(options.cacheRoot, options.repoRoot, result);
    return { result, cacheFile };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Digest failed: ${message}` };
  }
}

async function friendlyOpenRouterError(resp: Response, model: string): Promise<string> {
  let friendly = `OpenRouter error ${resp.status}`;
  try {
    const errData = await resp.json() as { error?: { message?: string } };
    const msg = errData?.error?.message ?? "";
    if (resp.status === 429) {
      friendly = msg.includes("free-models-per-day")
        ? "Daily free-model limit reached. Add credits at openrouter.ai to raise your daily free-model cap."
        : "Rate limited. Wait a minute and try again.";
    } else if (resp.status === 404) {
      friendly = `Model not found on OpenRouter - pick a different one in Settings. (${model})`;
    } else if (resp.status === 401 || resp.status === 403) {
      friendly = "Invalid or expired API key - check your OpenRouter key in Settings.";
    } else if (msg) {
      friendly = `OpenRouter: ${msg.slice(0, 120)}`;
    }
  } catch {
    // keep generic message
  }
  return friendly;
}
