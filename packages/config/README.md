# @luzz/config

Runtime config loader for apps.

API

```ts
type AppConfig = { API_BASE_URL: string; ENV?: string };
loadClientConfig(): Promise<AppConfig>
loadServerConfigFromEnv(env: NodeJS.ProcessEnv): AppConfig
```
