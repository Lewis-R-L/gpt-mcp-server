## Nx monorepo with MCP server

This workspace is initialized with Nx and contains a Node-based MCP server app `mcp-server`.

### Prerequisites

- Node.js 18+

```
npm install
```

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
