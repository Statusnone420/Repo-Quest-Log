import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { isCopilotProviderId } from "./config.js";
import type { CopilotProviderId } from "./types.js";

export interface CopilotAnswer {
  analysis: string;
  fixes: string;
  reasoning: string;
  confidence: number;
}

export interface LLMClient {
  ask(prompt: string, context: object): Promise<CopilotAnswer>;
}

export interface LLMProviderDiscovery {
  name: CopilotProviderId;
  label: string;
  model: string;
  available: boolean;
  tokenFound: boolean;
  tokenSource?: string;
  endpoint?: string;
  notes: string[];
}

export interface LLMDiscoveryOptions {
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  customConfigPath?: string;
}

export interface LLMProvider {
  name: CopilotProviderId;
  canDiscoverAuth(): boolean;
  discoverToken(): string | null;
  createClient(token: string): LLMClient;
  getModel(): string;
  describeAuth(): LLMProviderDiscovery;
}

interface CustomLlmConfig {
  provider?: CopilotProviderId;
  token?: string;
  endpoint?: string;
  model?: string;
  projectId?: string;
  location?: string;
}

interface GoogleCredentialBundle {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  projectId?: string;
  location?: string;
  endpoint?: string;
  apiKey?: string;
}

const DEFAULT_MODELS: Record<CopilotProviderId, string> = {
  anthropic: "claude-opus-4-7",
  openai: "gpt-4-turbo",
  google: "gemini-2.0-pro",
  "local-ollama": "llama3.1",
};

export function createProviderRegistry(options: LLMDiscoveryOptions = {}): LLMProvider[] {
  return [
    createAnthropicProvider(options),
    createOpenAIProvider(options),
    createGoogleProvider(options),
    createOllamaProvider(options),
  ];
}

export function discoverProviders(options: LLMDiscoveryOptions = {}): LLMProviderDiscovery[] {
  return createProviderRegistry(options).map((provider) => provider.describeAuth());
}

export function findProvider(
  provider: CopilotProviderId,
  options: LLMDiscoveryOptions = {},
): LLMProvider | undefined {
  return createProviderRegistry(options).find((entry) => entry.name === provider);
}

function createAnthropicProvider(options: LLMDiscoveryOptions): LLMProvider {
  const env = options.env ?? process.env;
  const homeDir = resolveHomeDir(options.homeDir);
  const custom = readCustomConfig(options);
  const model = custom?.provider === "anthropic" && custom?.model ? custom.model : DEFAULT_MODELS.anthropic;

  return {
    name: "anthropic",
    canDiscoverAuth() {
      return Boolean(resolveAnthropicToken(env, homeDir, custom));
    },
    discoverToken() {
      return resolveAnthropicToken(env, homeDir, custom)?.token ?? null;
    },
    createClient(token: string) {
      return {
        async ask(prompt: string, context: object): Promise<CopilotAnswer> {
          return callAnthropic(token, model, prompt, context);
        },
      };
    },
    getModel() {
      return model;
    },
    describeAuth() {
      const discovery = resolveAnthropicToken(env, homeDir, custom);
      return {
        name: "anthropic",
        label: "Anthropic",
        model,
        available: Boolean(discovery),
        tokenFound: Boolean(discovery?.token),
        tokenSource: discovery?.source,
        notes: discovery?.notes ?? ["no Anthropic token found"],
      };
    },
  };
}

function createOpenAIProvider(options: LLMDiscoveryOptions): LLMProvider {
  const env = options.env ?? process.env;
  const homeDir = resolveHomeDir(options.homeDir);
  const custom = readCustomConfig(options);
  const model = custom?.provider === "openai" && custom?.model ? custom.model : DEFAULT_MODELS.openai;

  return {
    name: "openai",
    canDiscoverAuth() {
      return Boolean(resolveOpenAIToken(env, homeDir, custom));
    },
    discoverToken() {
      return resolveOpenAIToken(env, homeDir, custom)?.token ?? null;
    },
    createClient(token: string) {
      return {
        async ask(prompt: string, context: object): Promise<CopilotAnswer> {
          return callOpenAI(token, model, prompt, context);
        },
      };
    },
    getModel() {
      return model;
    },
    describeAuth() {
      const discovery = resolveOpenAIToken(env, homeDir, custom);
      return {
        name: "openai",
        label: "OpenAI",
        model,
        available: Boolean(discovery),
        tokenFound: Boolean(discovery?.token),
        tokenSource: discovery?.source,
        notes: discovery?.notes ?? ["no OpenAI token found"],
      };
    },
  };
}

function createGoogleProvider(options: LLMDiscoveryOptions): LLMProvider {
  const env = options.env ?? process.env;
  const homeDir = resolveHomeDir(options.homeDir);
  const custom = readCustomConfig(options);
  const model = custom?.provider === "google" && custom?.model ? custom.model : DEFAULT_MODELS.google;

  return {
    name: "google",
    canDiscoverAuth() {
      return Boolean(resolveGoogleToken(env, homeDir, custom));
    },
    discoverToken() {
      return resolveGoogleToken(env, homeDir, custom)?.token ?? null;
    },
    createClient(token: string) {
      return {
        async ask(prompt: string, context: object): Promise<CopilotAnswer> {
          return callGoogle(token, model, prompt, context);
        },
      };
    },
    getModel() {
      return model;
    },
    describeAuth() {
      const discovery = resolveGoogleToken(env, homeDir, custom);
      return {
        name: "google",
        label: "Google",
        model,
        available: Boolean(discovery),
        tokenFound: Boolean(discovery?.token),
        tokenSource: discovery?.source,
        notes: discovery?.notes ?? ["no Google credentials found"],
      };
    },
  };
}

function createOllamaProvider(options: LLMDiscoveryOptions): LLMProvider {
  const env = options.env ?? process.env;
  const custom = readCustomConfig(options);
  const model = custom?.provider === "local-ollama" && custom?.model ? custom.model : DEFAULT_MODELS["local-ollama"];

  return {
    name: "local-ollama",
    canDiscoverAuth() {
      return true;
    },
    discoverToken() {
      return "";
    },
    createClient(token: string) {
      return {
        async ask(prompt: string, context: object): Promise<CopilotAnswer> {
          return callOllama(resolveOllamaEndpoint(env, custom), model, prompt, context);
        },
      };
    },
    getModel() {
      return model;
    },
    describeAuth() {
      const endpoint = resolveOllamaEndpoint(env, custom);
      return {
        name: "local-ollama",
        label: "Ollama",
        model,
        available: true,
        tokenFound: true,
        endpoint,
        notes: endpoint ? [`endpoint ${endpoint}`] : ["local endpoint on localhost:11434"],
      };
    },
  };
}

function resolveAnthropicToken(
  env: NodeJS.ProcessEnv,
  homeDir: string,
  custom: CustomLlmConfig | undefined,
): { token: string; source: string; notes: string[] } | undefined {
  const envToken = firstText(env.ANTHROPIC_API_KEY, env.CLAUDE_API_KEY, env.ANTHROPIC_TOKEN);
  if (envToken) {
    return { token: envToken, source: "env", notes: ["found env token"] };
  }

  if (custom?.provider === "anthropic" && custom.token) {
    return { token: custom.token, source: resolveCustomConfigPath(homeDir), notes: ["found custom llm config"] };
  }

  for (const candidate of [join(homeDir, ".claude", "token.json"), join(homeDir, ".config", "anthropic", "token.json")]) {
    const token = readCredentialToken(candidate);
    if (token) {
      return { token, source: candidate, notes: [`found token file ${candidate}`] };
    }
  }

  return undefined;
}

function resolveOpenAIToken(
  env: NodeJS.ProcessEnv,
  homeDir: string,
  custom: CustomLlmConfig | undefined,
): { token: string; source: string; notes: string[] } | undefined {
  const envToken = firstText(env.OPENAI_API_KEY, env.OPENAI_TOKEN);
  if (envToken) {
    return { token: envToken, source: "env", notes: ["found env token"] };
  }

  if (custom?.provider === "openai" && custom.token) {
    return { token: custom.token, source: resolveCustomConfigPath(homeDir), notes: ["found custom llm config"] };
  }

  const candidate = join(homeDir, ".config", "openai", "auth.json");
  const token = readCredentialToken(candidate);
  if (token) {
    return { token, source: candidate, notes: [`found token file ${candidate}`] };
  }

  return undefined;
}

function resolveGoogleToken(
  env: NodeJS.ProcessEnv,
  homeDir: string,
  custom: CustomLlmConfig | undefined,
): { token: string; source: string; notes: string[] } | undefined {
  const customBundle = custom?.provider === "google" && custom.token ? custom.token : undefined;
  if (customBundle) {
    return { token: customBundle, source: resolveCustomConfigPath(homeDir), notes: ["found custom llm config"] };
  }

  const credentialCandidates = [
    firstText(env.GOOGLE_APPLICATION_CREDENTIALS),
    join(homeDir, ".config", "gcloud", "application_default_credentials.json"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of credentialCandidates) {
    const bundle = readGoogleCredentialBundle(candidate);
    if (bundle) {
      return {
        token: JSON.stringify(bundle),
        source: candidate,
        notes: [`found gcloud credential file ${candidate}`],
      };
    }
  }

  const apiKey = firstText(env.GOOGLE_API_KEY, env.GEMINI_API_KEY);
  if (apiKey) {
    return { token: JSON.stringify({ apiKey }), source: "env", notes: ["found API key env var"] };
  }

  if (custom?.provider === "google" && custom.endpoint) {
    return {
      token: JSON.stringify({
        endpoint: custom.endpoint,
        projectId: custom.projectId,
        location: custom.location,
        model: custom.model,
      }),
      source: resolveCustomConfigPath(homeDir),
      notes: ["found custom llm config"],
    };
  }

  return undefined;
}

function resolveOllamaEndpoint(env: NodeJS.ProcessEnv, custom: CustomLlmConfig | undefined): string {
  if (custom?.provider === "local-ollama" && custom.endpoint) {
    return custom.endpoint;
  }

  return firstText(env.OLLAMA_ENDPOINT) ?? "http://localhost:11434";
}

function readCustomConfig(options: LLMDiscoveryOptions): CustomLlmConfig | undefined {
  const homeDir = resolveHomeDir(options.homeDir);
  const customPath = options.customConfigPath ?? resolve(homeDir, ".repolog", "llm-config.json");
  const parsed = readJsonFile(customPath);
  if (!parsed) {
    return undefined;
  }

  const providerValue = parsed["provider"];
  const provider = typeof providerValue === "string" && isCopilotProviderId(providerValue)
    ? providerValue
    : undefined;

  return {
    provider,
    token: stringField(parsed["token"]),
    endpoint: stringField(parsed["endpoint"]),
    model: stringField(parsed["model"]),
    projectId: stringField(parsed["projectId"]),
    location: stringField(parsed["location"]),
  };
}

function readJsonFile(path: string): Record<string, unknown> | undefined {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readGoogleCredentialBundle(path: string): GoogleCredentialBundle | undefined {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const bundle = parsed as Record<string, unknown>;
    const token = stringField(bundle["access_token"]) ?? stringField(bundle["accessToken"]);
    const refreshToken = stringField(bundle["refresh_token"]) ?? stringField(bundle["refreshToken"]);
    const clientId = stringField(bundle["client_id"]) ?? stringField(bundle["clientId"]);
    const clientSecret = stringField(bundle["client_secret"]) ?? stringField(bundle["clientSecret"]);
    const projectId = stringField(bundle["project_id"]) ?? stringField(bundle["projectId"]);
    const location = stringField(bundle["location"]);

    if (!token && !refreshToken) {
      return undefined;
    }

    return {
      accessToken: token,
      refreshToken,
      clientId,
      clientSecret,
      projectId,
      location,
      endpoint: stringField(bundle["endpoint"]),
    };
  } catch {
    return undefined;
  }
}

function readCredentialToken(path: string): string | undefined {
  try {
    const raw = readFileSync(path, "utf8");
    if (!raw.trim()) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") {
        return parsed.trim() || undefined;
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const data = parsed as Record<string, unknown>;
        for (const key of ["token", "api_key", "apiKey", "access_token", "accessToken", "secret"]) {
          const candidate = data[key];
          if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
          }
        }
      }
    } catch {
      return raw.trim();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function firstText(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveHomeDir(homeDir: string | undefined): string {
  return homeDir?.trim() || homedir();
}

function resolveCustomConfigPath(homeDir: string): string {
  return resolve(homeDir, ".repolog", "llm-config.json");
}

async function callAnthropic(
  token: string,
  model: string,
  prompt: string,
  context: object,
): Promise<CopilotAnswer> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": token,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: prompt,
      messages: [{ role: "user", content: JSON.stringify(context, null, 2) }],
    }),
  });

  return readAnswerFromResponse(response, (body) => {
    const content = Array.isArray(body["content"]) ? (body["content"] as unknown[]) : [];
    const text = content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : ""))
      .join("\n")
      .trim();
    return parseAnswerPayload(text);
  });
}

async function callOpenAI(
  token: string,
  model: string,
  prompt: string,
  context: object,
): Promise<CopilotAnswer> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(context, null, 2) },
      ],
    }),
  });

  return readAnswerFromResponse(response, (body) => {
    const choices = Array.isArray(body["choices"]) ? (body["choices"] as Array<Record<string, unknown>>) : [];
    const choice = choices[0];
    const messageValue = choice ? choice["message"] : undefined;
    const message = messageValue && typeof messageValue === "object" && !Array.isArray(messageValue)
      ? (messageValue as Record<string, unknown>)
      : undefined;
    const text = message?.["content"] ?? (choice ? choice["text"] : undefined) ?? "";
    return parseAnswerPayload(String(text));
  });
}

async function callGoogle(
  token: string,
  model: string,
  prompt: string,
  context: object,
): Promise<CopilotAnswer> {
  const bundle = parseGoogleCredentialBundle(token);
  const resolved = await resolveGoogleAccess(bundle);
  const usingApiKey = Boolean(bundle.apiKey);
  const endpoint = bundle.endpoint
    ? bundle.endpoint
    : usingApiKey
    ? "https://generativelanguage.googleapis.com"
    : `https://${bundle.location ?? "us-central1"}-aiplatform.googleapis.com`;
  const requestUrl = usingApiKey
    ? `${endpoint}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolved)}`
    : `${endpoint}/v1/projects/${encodeURIComponent(bundle.projectId ?? "")}/locations/${encodeURIComponent(bundle.location ?? "us-central1")}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

  if (!usingApiKey && !bundle.projectId) {
    throw new Error("Google credentials are missing a projectId.");
  }

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: usingApiKey
      ? { "content-type": "application/json" }
      : {
          "content-type": "application/json",
          authorization: `Bearer ${resolved}`,
        },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt}\n\n${JSON.stringify(context, null, 2)}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200,
      },
    }),
  });

  return readAnswerFromResponse(response, (body) => {
    const candidates = Array.isArray(body["candidates"]) ? (body["candidates"] as Array<Record<string, unknown>>) : [];
    const text = candidates
      .flatMap((candidate) => {
        const content = candidate["content"];
        const parts = content && typeof content === "object" ? (content as Record<string, unknown>)["parts"] : undefined;
        return Array.isArray(parts) ? parts : [];
      })
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : ""))
      .join("\n")
      .trim();
    return parseAnswerPayload(text);
  });
}

async function callOllama(
  endpoint: string,
  model: string,
  prompt: string,
  context: object,
): Promise<CopilotAnswer> {
  const response = await fetch(`${endpoint.replace(/\/+$/, "")}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(context, null, 2) },
      ],
    }),
  });

  return readAnswerFromResponse(response, (body) => {
    const message = body["message"];
    const responseText = body["response"];
    const text =
      message && typeof message === "object" && !Array.isArray(message)
        ? (message as Record<string, unknown>)["content"] ?? responseText ?? ""
        : responseText ?? "";
    return parseAnswerPayload(String(text));
  });
}

async function readAnswerFromResponse<T>(
  response: Response,
  transform: (body: Record<string, unknown>) => T,
): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM request failed with ${response.status}: ${body || response.statusText}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  return transform(body);
}

function parseAnswerPayload(text: string): CopilotAnswer {
  const payload = extractJsonPayload(text);
  const parsed = payload ? safeParseJson(payload) : undefined;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LLM response did not contain valid JSON.");
  }

  const data = parsed as Record<string, unknown>;
  const analysis = stringField(data["analysis"]) ?? "";
  const fixes = stringField(data["fixes"]) ?? "";
  const reasoning = stringField(data["reasoning"]) ?? "";
  const confidence = clampConfidence(data["confidence"]);

  return { analysis, fixes, reasoning, confidence };
}

function parseGoogleCredentialBundle(token: string): GoogleCredentialBundle {
  const parsed = safeParseJson(token);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { apiKey: token };
  }

  const data = parsed as Record<string, unknown>;

  return {
    accessToken: stringField(data["accessToken"]),
    refreshToken: stringField(data["refreshToken"]),
    clientId: stringField(data["clientId"]),
    clientSecret: stringField(data["clientSecret"]),
    projectId: stringField(data["projectId"]),
    location: stringField(data["location"]),
    endpoint: stringField(data["endpoint"]),
    apiKey: stringField(data["apiKey"]),
  };
}

async function resolveGoogleAccess(bundle: GoogleCredentialBundle): Promise<string> {
  if (bundle.accessToken) {
    return bundle.accessToken;
  }

  if (bundle.apiKey) {
    return bundle.apiKey;
  }

  if (!bundle.refreshToken || !bundle.clientId || !bundle.clientSecret) {
    throw new Error("Google credentials do not contain an access token or refresh token.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: bundle.clientId,
      client_secret: bundle.clientSecret,
      refresh_token: bundle.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google token refresh failed with ${response.status}: ${body || response.statusText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google token refresh response did not contain access_token.");
  }

  return data.access_token;
}

function extractJsonPayload(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return fence[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return undefined;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function clampConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(1, Math.max(0, parsed));
}
