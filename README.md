## Nx monorepo with MCP server

This workspace is initialized with Nx and contains a Node-based MCP server app `mcp-server`.

### Prerequisites

- Node.js 18+

```
npm install
```

### Environment Configuration

The project uses `dotenv` to load environment variables from a `.env` file for local development.

1. **Create `.env` file from example:**
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` file** with your configuration:
   ```bash
   # Icons CDN Configuration
   ICONS_CDN_BASE_URL=https://gpt-mcp-server-2.vercel.app
   # or for local development with ngrok:
   # ICONS_CDN_BASE_URL=https://your-ngrok-domain.ngrok-free.dev
   
   # Widget Domain
   WIDGET_DOMAIN=https://italki.com
   
   # Server Configuration
   PORT=3030
   ```

3. **Environment variables are automatically loaded** when you run the server locally.

   **Note:** For Vercel deployment, set environment variables in Vercel project settings instead of using `.env` file.

### Environment Configuration

Create a `.env` file in the project root based on `env.example`:

```bash
cp env.example .env
```

Then edit `.env` to configure your settings. Key environment variables:

- `ICONS_CDN_BASE_URL`: CDN base URL for serving static icons (e.g., `https://gpt-mcp-server-2.vercel.app` or your ngrok domain)
- `WIDGET_DOMAIN`: Domain for OpenAI widget subdomain generation (default: `https://italki.com`)
- `PORT`: Server port (default: `3030`)
- See `env.example` for all available configuration options.

### Useful commands

- Build:

```
npx nx build mcp-server
```

- Run (HTTP/SSE transport):

```
node dist/mcp-server/main.js
```


### Testing the server

1. **Start the server (HTTP only):**
   ```bash
   node dist/mcp-server/main.js
   ```

2. **Start the server with HTTPS:**
   ```bash
   # 生成 SSL 证书（仅开发环境）
   ./scripts/generate-ssl-cert.sh
   
   # 启动 HTTPS 服务器
   USE_HTTPS=true node dist/mcp-server/main.js
   ```

3. **Health check:**
   ```bash
   # HTTP
   curl http://localhost:3030/health
   
   # HTTPS
   curl -k https://localhost:3443/health
   ```

3. **Access Log Configuration:**
   ```bash
   # Common Log Format (default) with request/response content and MCP headers
   LOG_FORMAT=common LOG_REQUEST_RESPONSE=true node dist/mcp-server/main.js
   
   # JSON format with request/response content and MCP headers
   LOG_FORMAT=json LOG_REQUEST_RESPONSE=true node dist/mcp-server/main.js
   
   # Disable request/response content and MCP headers logging
   LOG_REQUEST_RESPONSE=false node dist/mcp-server/main.js
   
   # Disable access logs completely
   ENABLE_ACCESS_LOG=false node dist/mcp-server/main.js
   ```
   
   **Session Features:**
   - Each session has a unique ID returned in the `Mcp-Session-Id` header
   - Sessions automatically expire after 30 minutes of inactivity
   - Multiple clients can connect simultaneously with different sessions
   - If a session ID is not found, the server returns a 400 error
