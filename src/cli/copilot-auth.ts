import { resolve } from "node:path";

import { isCopilotProviderId, setRepoLlmSelection } from "../engine/config.js";
import { discoverProviders, findProvider, type LLMDiscoveryOptions, type LLMProviderDiscovery } from "../engine/llm-providers.js";

export interface AuthDiscoveryReport {
  rootDir: string;
  selectedProvider?: string;
  providers: LLMProviderDiscovery[];
}

export async function buildAuthDiscoveryReport(
  rootDir: string,
  options: LLMDiscoveryOptions = {},
): Promise<AuthDiscoveryReport> {
  const providers = discoverProviders(options);
  const selection = await readSelectedProvider(rootDir);
  return {
    rootDir: resolve(rootDir),
    selectedProvider: selection,
    providers: providers.map((provider) => ({
      ...provider,
      notes: provider.notes.slice(),
    })),
  };
}

export function formatAuthDiscoveryReport(report: AuthDiscoveryReport): string {
  const lines: string[] = [];
  lines.push(`repolog auth · ${report.rootDir}`);
  lines.push(report.selectedProvider ? `selected: ${report.selectedProvider}` : "selected: (none)");
  lines.push("");

  for (const provider of report.providers) {
    const status = provider.available ? "found" : "missing";
    const selected = report.selectedProvider === provider.name ? " [selected]" : "";
    const source = provider.tokenSource ? ` · ${provider.tokenSource}` : provider.endpoint ? ` · ${provider.endpoint}` : "";
    const notes = provider.notes.length ? ` · ${provider.notes.join("; ")}` : "";
    lines.push(`${provider.name.padEnd(14)} ${status.padEnd(7)} ${provider.model}${selected}${source}${notes}`);
  }

  return lines.join("\n");
}

export async function saveSelectedProvider(rootDir: string, provider: string): Promise<void> {
  if (!isCopilotProviderId(provider)) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  await setRepoLlmSelection(resolve(rootDir), provider);
}

export async function buildAuthStatusReport(
  rootDir: string,
  options: LLMDiscoveryOptions = {},
): Promise<AuthDiscoveryReport> {
  return buildAuthDiscoveryReport(rootDir, options);
}

export function formatAuthStatusReport(report: AuthDiscoveryReport): string {
  return formatAuthDiscoveryReport(report);
}

export function getProviderFromReport(report: AuthDiscoveryReport, provider: string) {
  return report.providers.find((entry) => entry.name === provider);
}

async function readSelectedProvider(rootDir: string): Promise<string | undefined> {
  const selectedConfig = await importConfig(rootDir);
  const provider = selectedConfig?.llm?.provider;
  return provider && isCopilotProviderId(provider) ? provider : undefined;
}

async function importConfig(rootDir: string): Promise<{ llm?: { provider?: string } } | undefined> {
  try {
    const { readRepoConfig } = await import("../engine/config.js");
    const config = await readRepoConfig(rootDir);
    return { llm: config.llm };
  } catch {
    return undefined;
  }
}

export function providerDiscoverySummary(report: AuthDiscoveryReport): string {
  return report.providers
    .map((provider) => `${provider.name}:${provider.available ? "found" : "missing"}`)
    .join(", ");
}

export function getSelectedProvider(report: AuthDiscoveryReport): LLMProviderDiscovery | undefined {
  return report.providers.find((provider) => provider.name === report.selectedProvider);
}

export async function resolveProvider(rootDir: string, provider: string) {
  if (!isCopilotProviderId(provider)) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const discovered = await buildAuthDiscoveryReport(rootDir);
  const match = findProvider(provider);
  return {
    match,
    discovered,
    provider,
  };
}
