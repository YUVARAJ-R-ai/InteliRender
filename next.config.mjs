import './lib/dns-patch.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // The agent route spawns services/mcp-stdio/google-forms.mjs at runtime via the
  // MCP stdio transport. It's not statically imported, so force it (and the MCP SDK
  // server files + zod it needs) into the standalone output for the Docker image.
  outputFileTracingIncludes: {
    '/api/chat/agent': [
      './services/mcp-stdio/**',
      './node_modules/@modelcontextprotocol/sdk/dist/**',
      './node_modules/zod/**',
    ],
  },
};

export default nextConfig;
