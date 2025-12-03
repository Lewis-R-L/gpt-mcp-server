# authInfo 底层流程详解

## 📋 概述

本文档详细说明从 Express 中间件设置 `req.auth` 到工具回调中获取 `extra.authInfo` 的完整底层流程，包括 MCP SDK 内部的源码实现。

---

## 🔗 完整调用链（带源码）

### 步骤 1: Express 中间件设置 req.auth

**位置：** `main.ts:181-202`

```typescript
// 文件: mcp-server/src/main.ts
// 第 181-202 行

app.use((req, res, next) => {
  // Cookie 解析...
  
  // 👇 关键：从 HTTP Header 提取 Authorization
  const authorizationHeader = req.get('Authorization');
  if (authorizationHeader) {
    // 解析格式: "Bearer <token>"
    const token = authorizationHeader.split(' ')[1];
    
    // 👇 设置 req.auth（扩展了 Express Request 类型）
    req.auth = {
      token: token,
      clientId: '',
      scopes: []
    } as AuthInfo;
  }
  next();  // 继续下一个中间件
});
```

**关键点：**
- ✅ 从 HTTP Header `Authorization` 提取 token
- ✅ 设置到 `req.auth` 对象
- ✅ 通过 `declare global` 扩展了 Express Request 类型

---

### 步骤 2: Express 路由调用 transport.handleRequest

**位置：** `main.ts:460` 或 `main.ts:480`

```typescript
// 文件: mcp-server/src/main.ts
// 第 451-494 行

app.all('/mcp', async (req, res) => {
  try {
    const sessionId = req.get('Mcp-Session-Id');
    const session = sessionId ? getSession(sessionId) : createMCPSession();
    
    // 👇 关键：将 req（包含 req.auth）传递给 transport
    await session.transport.handleRequest(req as any, res as any, req.body);
    
  } catch (error) {
    // 错误处理
  }
});
```

**关键点：**
- ✅ `req` 对象包含 `req.auth`（在步骤 1 中设置）
- ✅ 将 `req` 传递给 `transport.handleRequest()`

---

### 步骤 3: StreamableHTTPServerTransport 提取 authInfo

**位置：** MCP SDK 源码 `node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js:297`

```javascript
// 文件: node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js
// 第 97-417 行（handlePostRequest 方法）

async handlePostRequest(req, res, parsedBody) {
  // ... 验证 Content-Type 等 ...
  
  // 👇 关键：从 req.auth 提取认证信息
  const authInfo = req.auth;  // 第 297 行
  
  const requestInfo = { headers: req.headers };
  
  // 解析 JSON-RPC 消息
  let rawMessage;
  if (parsedBody !== undefined) {
    rawMessage = parsedBody;
  } else {
    // 从请求体读取...
    rawMessage = JSON.parse(body.toString());
  }
  
  // 处理批量或单个消息
  let messages;
  if (Array.isArray(rawMessage)) {
    messages = rawMessage.map(msg => JSONRPCMessageSchema.parse(msg));
  } else {
    messages = [JSONRPCMessageSchema.parse(rawMessage)];
  }
  
  // ... 处理初始化请求 ...
  
  // 👇 关键：调用 onmessage，传递 authInfo
  if (!hasRequests) {
    // 只有通知或响应
    res.writeHead(202).end();
    for (const message of messages) {
      // 第 374 行：调用 onmessage，传递 { authInfo, requestInfo }
      this.onmessage?.call(this, message, { authInfo, requestInfo });
    }
  } else if (hasRequests) {
    // 有请求需要响应
    // ... 设置 SSE 流 ...
    
    // 第 412 行：调用 onmessage，传递 { authInfo, requestInfo }
    for (const message of messages) {
      this.onmessage?.call(this, message, { authInfo, requestInfo });
    }
  }
}
```

**关键源码位置：**
- **第 297 行**：`const authInfo = req.auth;` - 从 Express request 提取
- **第 374 行**：`this.onmessage?.call(this, message, { authInfo, requestInfo });` - 传递 authInfo
- **第 412 行**：`this.onmessage?.call(this, message, { authInfo, requestInfo });` - 传递 authInfo

**关键点：**
- ✅ MCP SDK 直接从 `req.auth` 读取认证信息
- ✅ 将 `authInfo` 包装到 `{ authInfo, requestInfo }` 对象中
- ✅ 通过 `onmessage` 回调传递给上层

---

### 步骤 4: McpServer 连接 transport 的 onmessage

**位置：** MCP SDK 内部（当调用 `globalMcpServer.connect(transport)` 时）

**伪代码（基于 MCP SDK 架构）：**

```typescript
// MCP SDK 内部（McpServer 类）
// 当调用 globalMcpServer.connect(transport) 时

class McpServer {
  connect(transport: Transport) {
    // 设置 transport 的 onmessage 回调
    transport.onmessage = (message, extra) => {
      // extra 包含 { authInfo, requestInfo }
      this.handleMessage(message, extra);
    };
  }
  
  async handleMessage(message, extra) {
    // extra = { authInfo, requestInfo }
    
    if (message.method === 'tools/call') {
      // 找到对应的工具
      const tool = this.registeredTools.get(message.params.name);
      
      // 👇 调用工具回调，传递 extra（包含 authInfo）
      const result = await tool.callback(
        message.params.arguments,
        {
          ...extra,  // 包含 authInfo
          signal: abortSignal,
          requestId: message.id,
          // ... 其他字段
        }
      );
      
      return result;
    }
  }
}
```

**关键点：**
- ✅ `connect()` 方法设置 `transport.onmessage` 回调
- ✅ `handleMessage()` 接收 `extra`（包含 `authInfo`）
- ✅ 调用工具回调时传递 `extra`

---

### 步骤 5: 工具注册回调接收 extra

**位置：** `main.ts:59-74`

```typescript
// 文件: mcp-server/src/main.ts
// 第 59-74 行

globalMcpServer.registerTool(mcpTool.name, mcpTool.config, async (args, extra) => {
  // 👇 extra 包含 authInfo（从 MCP SDK 传递下来）
  // extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  // extra.authInfo: AuthInfo | undefined
  
  if (mcpTool.needAuthInfo) {
    const authInfo = extra.authInfo;  // 👈 从 extra 获取
    if (!authInfo || !authInfo.token) {
      throw new McpError(401, 'Authentication required');
    }
  }
  
  try {
    // 👇 调用工具回调，传递 extra（包含 authInfo）
    const result = await mcpTool.toolCallback(args, extra);
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
});
```

**关键点：**
- ✅ `extra` 参数包含 `authInfo`
- ✅ 类型：`RequestHandlerExtra<ServerRequest, ServerNotification>`
- ✅ `extra.authInfo` 的类型是 `AuthInfo | undefined`

---

### 步骤 6: 工具回调使用 extra.authInfo

**位置：** `calendar.ts:152-165`

```typescript
// 文件: mcp-server/src/mcp-modules/my/calendar.ts
// 第 152-165 行

toolCallback: async (args, extra) => {
  // extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  
  // 验证输入
  const validatedArgs = MY_CALENDAR_EVENTS_INPUT_TYPE.safeParse(args);
  
  // 👇 使用 extra.authInfo?.token
  const events = await getMyCalendarEvents(
    extra.authInfo?.token,  // 👈 从 extra 获取 token
    new Date(validatedArgs.data.startDatetime),
    new Date(validatedArgs.data.endDatetime),
    validatedArgs.data.showStudentEvents,
    validatedArgs.data.showTeacherEvents
  );
  
  return {
    content: [{ type: 'text', text: getTextForMyCalendarEvents(events) }],
    structuredContent: { events: events }
  };
}
```

**关键点：**
- ✅ 从 `extra.authInfo?.token` 获取 token
- ✅ 使用可选链操作符 `?.` 防止 undefined

---

## 📊 完整数据流图

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Express 中间件 (main.ts:181-202)                         │
│                                                              │
│ const authorizationHeader = req.get('Authorization');       │
│ const token = authorizationHeader.split(' ')[1];            │
│ req.auth = { token, clientId: '', scopes: [] };            │
│                                                              │
│ req.auth = {                                                │
│   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",           │
│   clientId: '',                                             │
│   scopes: []                                                │
│ }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Express 路由 (main.ts:460/480)                          │
│                                                              │
│ await session.transport.handleRequest(                     │
│   req,    // ← 包含 req.auth                                │
│   res,                                                      │
│   req.body                                                  │
│ );                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. StreamableHTTPServerTransport                            │
│    (streamableHttp.js:297)                                  │
│                                                              │
│ const authInfo = req.auth;  // 👈 提取                     │
│                                                              │
│ // 解析 JSON-RPC 消息                                       │
│ const messages = [...];                                     │
│                                                              │
│ // 调用 onmessage，传递 authInfo                            │
│ this.onmessage?.call(this, message, {                       │
│   authInfo,      // 👈 从 req.auth 提取                    │
│   requestInfo: { headers: req.headers }                      │
│ });                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. McpServer.connect() 设置的 onmessage 回调                │
│    (MCP SDK 内部)                                            │
│                                                              │
│ transport.onmessage = (message, extra) => {                 │
│   // extra = { authInfo, requestInfo }                      │
│   this.handleMessage(message, extra);                       │
│ };                                                           │
│                                                              │
│ handleMessage(message, extra) {                             │
│   // extra.authInfo 可用                                    │
│   const tool = this.registeredTools.get(...);               │
│   await tool.callback(args, extra);  // 👈 传递 extra      │
│ }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. 工具注册回调 (main.ts:59-74)                            │
│                                                              │
│ globalMcpServer.registerTool(..., async (args, extra) => {  │
│   // extra.authInfo 可用                                    │
│   const authInfo = extra.authInfo;                          │
│   if (!authInfo || !authInfo.token) {                      │
│     throw new McpError(401, 'Auth required');              │
│   }                                                          │
│   await mcpTool.toolCallback(args, extra);  // 👈 传递    │
│ });                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 工具回调 (calendar.ts:152)                               │
│                                                              │
│ toolCallback: async (args, extra) => {                      │
│   const token = extra.authInfo?.token;  // 👈 使用         │
│   await getMyCalendarEvents(token, ...);                    │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 关键源码位置

### 1. Express 中间件设置 req.auth

**文件：** `mcp-server/src/main.ts`
**行号：** 191-200

```typescript
const authorizationHeader = req.get('Authorization');
if (authorizationHeader) {
  const token = authorizationHeader.split(' ')[1];
  req.auth = {
    token: token,
    clientId: '',
    scopes: []
  } as AuthInfo;
}
```

---

### 2. MCP SDK 提取 authInfo

**文件：** `node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js`
**行号：** 297

```javascript
const authInfo = req.auth;  // 👈 直接从 req.auth 读取
```

---

### 3. MCP SDK 传递 authInfo

**文件：** `node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js`
**行号：** 374, 412

```javascript
// 第 374 行（通知/响应）
this.onmessage?.call(this, message, { authInfo, requestInfo });

// 第 412 行（请求）
this.onmessage?.call(this, message, { authInfo, requestInfo });
```

---

### 4. RequestHandlerExtra 类型定义

**文件：** `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts`
**行号：** 76-84

```typescript
export type RequestHandlerExtra<SendRequestT extends Request, SendNotificationT extends Notification> = {
  signal: AbortSignal;
  /**
   * Information about a validated access token, provided to request handlers.
   */
  authInfo?: AuthInfo;  // 👈 可选字段
  sessionId?: string;
  _meta?: RequestMeta;
  requestId: RequestId;
  // ...
};
```

---

## 💡 关键设计点

### 1. 为什么使用 req.auth？

**原因：**
- ✅ Express 中间件可以轻松设置 `req.auth`
- ✅ MCP SDK 可以直接从 `req.auth` 读取
- ✅ 符合 Express 的中间件模式

**约定：**
- MCP SDK 期望 Express 应用在 `req.auth` 中提供认证信息
- 类型：`AuthInfo | undefined`

---

### 2. 为什么通过 extra 传递？

**原因：**
- ✅ 统一的参数传递方式
- ✅ 包含其他上下文信息（requestInfo, signal, requestId 等）
- ✅ 类型安全（TypeScript 类型定义）

**结构：**
```typescript
extra: {
  authInfo?: AuthInfo,      // 认证信息
  requestInfo: {            // 请求信息
    headers: {...}
  },
  signal: AbortSignal,      // 取消信号
  requestId: RequestId,     // 请求 ID
  // ...
}
```

---

### 3. 回调函数链

```
Express 中间件
  ↓ 设置 req.auth
Express 路由
  ↓ 传递 req
StreamableHTTPServerTransport.handleRequest()
  ↓ 提取 req.auth → authInfo
  ↓ 调用 onmessage(message, { authInfo, requestInfo })
McpServer.onmessage 回调
  ↓ 接收 extra = { authInfo, requestInfo }
  ↓ 调用 handleMessage(message, extra)
McpServer.handleMessage()
  ↓ 调用 tool.callback(args, extra)
工具注册回调 (main.ts:59)
  ↓ 接收 extra
  ↓ 调用 mcpTool.toolCallback(args, extra)
工具回调 (calendar.ts:152)
  ↓ 使用 extra.authInfo?.token
```

---

## 🎓 总结

**完整流程：**

1. ✅ **Express 中间件**：从 `Authorization` header 提取 token，设置 `req.auth`
2. ✅ **Express 路由**：将 `req`（包含 `req.auth`）传递给 `transport.handleRequest()`
3. ✅ **StreamableHTTPServerTransport**：从 `req.auth` 提取 `authInfo`（第 297 行）
4. ✅ **StreamableHTTPServerTransport**：调用 `onmessage(message, { authInfo, requestInfo })`（第 374/412 行）
5. ✅ **McpServer**：通过 `connect()` 设置的 `onmessage` 回调接收 `extra`
6. ✅ **McpServer**：调用工具回调时传递 `extra`（包含 `authInfo`）
7. ✅ **工具注册回调**：接收 `extra`，检查 `extra.authInfo`
8. ✅ **工具回调**：使用 `extra.authInfo?.token`

**关键源码位置：**
- `main.ts:191-200` - Express 中间件设置 `req.auth`
- `streamableHttp.js:297` - 提取 `req.auth`
- `streamableHttp.js:374,412` - 传递 `authInfo` 给 `onmessage`
- `protocol.d.ts:76-84` - `RequestHandlerExtra` 类型定义

**设计模式：**
- **中间件模式**：Express 中间件设置 `req.auth`
- **回调链**：通过 `onmessage` 回调传递数据
- **依赖注入**：通过 `extra` 参数注入上下文信息

