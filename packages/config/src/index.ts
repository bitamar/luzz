export type AppConfig = {
  API_BASE_URL: string;
  ENV?: string;
  // Allow additional fields for future flags/keys
  [key: string]: unknown;
};

// Client: load from served /config.json
export async function loadClientConfig(): Promise<AppConfig> {
  const response = await fetch("/config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load /config.json: ${response.status}`);
  }
  return (await response.json()) as AppConfig;
}

// Server: derive from env at runtime (SvelteKit/server adapters)
export function loadServerConfigFromEnv(env: NodeJS.ProcessEnv): AppConfig {
  const config: AppConfig = { API_BASE_URL: env.API_BASE_URL ?? "" };
  if (env.NODE_ENV) {
    config.ENV = env.NODE_ENV;
  }
  return config;
}

