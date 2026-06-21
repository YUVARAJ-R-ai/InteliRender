export interface McpServiceConfig {
  command: string;
  args: string[];
  envKey: string;
  envTransform?: (token: string) => string;
  /** DB config keys → env var names (e.g. OAuth client credentials) */
  appConfigEnv?: Record<string, string>;
  /** mcpConnections.metadata keys → env var names (e.g. Slack team ID) */
  metadataEnv?: Record<string, string>;
}
