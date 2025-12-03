# 访问日志说明

## 功能特性

- ✅ 自动记录所有 HTTP/HTTPS 请求
- ✅ 支持 Common Log Format 和 JSON 格式
- ✅ 记录请求时间、响应时间、状态码等详细信息
- ✅ 记录请求和响应内容（可配置）
- ✅ 记录 MCP 相关请求头
- ✅ 自动截断过长的内容
- ✅ 可配置启用/禁用
- ✅ 输出到控制台

## 日志格式

### Common Log Format (默认)

```
127.0.0.1 - - [2024-01-15T10:30:45.123Z] "GET /health" 200 2 "curl/7.68.0" 5ms
127.0.0.1 - - [2024-01-15T10:30:46.456Z] "POST /mcp" 200 156 "Mozilla/5.0..." 23ms
  Request: {"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}
  Response: {"jsonrpc":"2.0","id":"1","result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"italki-mcp","version":"0.1.0"}}}
  MCP Headers: Session: 123e4567-e89b-12d3-a456-426614174000, Version: 2024-11-05, Client: test-client/1.0.0
```

格式说明：
- `IP地址` - `用户标识` - `用户ID` `[时间戳]` `"请求方法 路径"` `状态码` `响应大小` `"User-Agent"` `处理时间`
- 当启用 `LOG_REQUEST_RESPONSE=true` 时，会额外显示请求和响应内容以及 MCP 相关请求头

### JSON Format

```json
{"level":"info","type":"access","timestamp":"2024-01-15T10:30:45.123Z","method":"GET","url":"/health","statusCode":200,"duration":"5ms","userAgent":"curl/7.68.0","ip":"127.0.0.1","contentLength":"2","referer":"-","protocol":"http","host":"localhost:3030"}
{"level":"info","type":"access","timestamp":"2024-01-15T10:30:50.456Z","method":"POST","url":"/mcp","statusCode":200,"duration":"12ms","userAgent":"PostmanRuntime/7.28.4","ip":"127.0.0.1","contentLength":"156","referer":"-","protocol":"http","host":"localhost:3030","requestBody":"{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{}}}","responseBody":"{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"italki-mcp\",\"version\":\"0.1.0\"}}}","mcpHeaders":{"mcpSessionId":"123e4567-e89b-12d3-a456-426614174000","mcpVersion":"2024-11-05","mcpClientInfo":"test-client/1.0.0","contentType":"application/json","accept":"application/json, text/event-stream"}}
```

## 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_ACCESS_LOG` | `true` | 是否启用访问日志 |
| `LOG_FORMAT` | `common` | 日志格式：`common` 或 `json` |
| `LOG_REQUEST_RESPONSE` | `true` | 是否记录请求和响应内容以及 MCP 相关请求头 |

## 使用示例

### 1. 默认配置（Common Log Format + 请求响应内容 + MCP 头信息）

```bash
node dist/mcp-server/main.js
```

输出示例：
```
127.0.0.1 - - [2024-01-15T10:30:45.123Z] "GET /health" 200 2 "curl/7.68.0" 5ms
127.0.0.1 - - [2024-01-15T10:30:46.456Z] "POST /mcp" 200 156 "Mozilla/5.0..." 23ms
  Request: {"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}
  Response: {"jsonrpc":"2.0","id":"1","result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"italki-mcp","version":"0.1.0"}}}
  MCP Headers: Session: 123e4567-e89b-12d3-a456-426614174000, Version: 2024-11-05, Client: test-client/1.0.0
```

### 2. JSON 格式

```bash
LOG_FORMAT=json node dist/mcp-server/main.js
```

输出示例：
```json
{"level":"info","type":"access","timestamp":"2024-01-15T10:30:45.123Z","method":"GET","url":"/health","statusCode":200,"duration":"5ms","userAgent":"curl/7.68.0","ip":"127.0.0.1","contentLength":"2","referer":"-","protocol":"http","host":"localhost:3030"}
{"level":"info","type":"access","timestamp":"2024-01-15T10:30:50.456Z","method":"POST","url":"/mcp","statusCode":200,"duration":"12ms","userAgent":"PostmanRuntime/7.28.4","ip":"127.0.0.1","contentLength":"156","referer":"-","protocol":"http","host":"localhost:3030","requestBody":"{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{}}}","responseBody":"{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"italki-mcp\",\"version\":\"0.1.0\"}}}"}
```

### 3. 禁用请求响应内容记录

```bash
LOG_REQUEST_RESPONSE=false node dist/mcp-server/main.js
```

输出示例（只显示基本访问信息）：
```
127.0.0.1 - - [2024-01-15T10:30:45.123Z] "GET /health" 200 2 "curl/7.68.0" 5ms
127.0.0.1 - - [2024-01-15T10:30:50.456Z] "POST /mcp" 200 156 "PostmanRuntime/7.28.4" 12ms
```

### 4. 禁用访问日志

```bash
ENABLE_ACCESS_LOG=false node dist/mcp-server/main.js
```

### 5. 生产环境配置

```bash
# 使用 JSON 格式便于日志分析，包含请求响应内容和 MCP 头信息
LOG_FORMAT=json ENABLE_ACCESS_LOG=true LOG_REQUEST_RESPONSE=true node dist/mcp-server/main.js
```

## 日志字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `timestamp` | 请求时间戳 | `2024-01-15T10:30:45.123Z` |
| `method` | HTTP 方法 | `GET`, `POST`, `PUT` |
| `url` | 请求路径 | `/health`, `/mcp` |
| `statusCode` | HTTP 状态码 | `200`, `404`, `500` |
| `duration` | 处理时间 | `5ms`, `23ms` |
| `userAgent` | 用户代理 | `curl/7.68.0` |
| `ip` | 客户端 IP | `127.0.0.1` |
| `contentLength` | 响应大小 | `2`, `156` |
| `referer` | 来源页面 | `-` (无来源) |
| `protocol` | 协议 | `http`, `https` |
| `host` | 主机名 | `localhost:3030` |
| `requestBody` | 请求内容* | `{"jsonrpc":"2.0","id":"1","method":"ping"}` |
| `responseBody` | 响应内容* | `{"jsonrpc":"2.0","id":"1","result":{"content":...}}` |
| `mcpHeaders` | MCP 头信息* | `{"mcpSessionId":"123e4567...","mcpVersion":"2024-11-05","mcpClientInfo":"test-client/1.0.0"}` |

* 仅当 `LOG_REQUEST_RESPONSE=true` 时显示

## 日志分析

### 使用 grep 过滤

```bash
# 查看所有 POST 请求
node dist/mcp-server/main.js | grep "POST"

# 查看错误请求（4xx, 5xx）
node dist/mcp-server/main.js | grep -E " [45][0-9][0-9] "

# 查看慢请求（超过 100ms）
node dist/mcp-server/main.js | grep -E " [0-9]+ms" | awk '$NF > 100'
```

### 使用 jq 分析 JSON 日志

```bash
# 安装 jq
sudo apt install jq

# 启动服务器并分析日志
LOG_FORMAT=json node dist/mcp-server/main.js | jq 'select(.statusCode >= 400)'

# 统计状态码分布
LOG_FORMAT=json node dist/mcp-server/main.js | jq -r '.statusCode' | sort | uniq -c

# 查看最慢的请求
LOG_FORMAT=json node dist/mcp-server/main.js | jq 'select(.duration | tonumber > 100)'
```

## 性能考虑

- 访问日志对性能影响很小（< 1ms per request）
- 可以随时通过环境变量禁用
- 建议生产环境使用 JSON 格式便于分析
- 大量请求时考虑使用专业的日志收集工具

## 故障排除

### 常见问题

1. **日志不输出**
   - 检查 `ENABLE_ACCESS_LOG` 是否为 `true`
   - 确认没有重定向 stdout

2. **JSON 格式错误**
   - 检查 `LOG_FORMAT` 是否为 `json`
   - 确认没有其他输出混入

3. **性能问题**
   - 考虑禁用访问日志：`ENABLE_ACCESS_LOG=false`
   - 使用异步日志收集工具
