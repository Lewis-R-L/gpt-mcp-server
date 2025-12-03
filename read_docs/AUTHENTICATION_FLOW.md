# 认证流程详解

## 📋 概述

本文档详细说明 Authorization header 的完整流程，从客户端传入到工具使用。

---

## 🔗 完整认证流程

```
客户端发送请求（带 Authorization header）
    ↓
Express 中间件解析 Authorization header
    ↓
设置 req.auth = { token, clientId, scopes }
    ↓
transport.handleRequest(req, res, req.body)
    ↓
MCP SDK 从 req.auth 提取认证信息
    ↓
传递给 extra.authInfo
    ↓
工具注册时的认证检查
    ↓
工具回调中使用 extra.authInfo.token
```

---

## 📍 关键代码位置

### 1️⃣ **客户端发送 Authorization Header**

**格式：**
```
Authorization: Bearer <access_token>
```

**示例（curl）：**
```bash
curl -X POST http://localhost:3030/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Mcp-Session-Id: <session-id>' \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "my-calendar-events",
      "arguments": { ... }
    }
  }'
```

**关键点：**
- ✅ **不是 Cookie**：Authorization 是通过 HTTP Header 传递的
- ✅ **格式**：`Bearer <token>`（OAuth 2.0 标准格式）
- ✅ **位置**：HTTP 请求头，不是请求体

---

### 2️⃣ **Express 中间件解析（main.ts:191-200）**

```typescript
// 文件: mcp-server/src/main.ts
// 第 180-202 行

app.use((req, res, next) => {
  // Cookie 解析（与认证无关，但在这里一起处理）
  req.cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach((cookie) => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        req.cookies[parts[0]] = parts[1];
      }
    });
  }
  
  // 👇 关键：解析 Authorization header
  const authorizationHeader = req.get('Authorization');
  if (authorizationHeader) {
    // 格式: "Bearer <token>"
    // split(' ') 分割后，[0] = "Bearer", [1] = "<token>"
    const token = authorizationHeader.split(' ')[1];
    
    // 设置 req.auth（扩展了 Express Request 类型）
    req.auth = {
      token: token,        // Access Token
      clientId: '',        // 暂时为空（可以从 token 验证中获取）
      scopes: []          // 暂时为空（可以从 token 验证中获取）
    } as AuthInfo;
  }
  next();
});
```

**关键点：**
- ✅ **从 HTTP Header 获取**：`req.get('Authorization')`
- ✅ **格式解析**：`"Bearer <token>"` → 提取 `<token>`
- ✅ **设置 req.auth**：将 token 存储到 `req.auth` 对象中
- ✅ **类型扩展**：通过 `declare global` 扩展了 Express Request 类型

**类型定义（main.ts:17-25）：**
```typescript
declare global {
  namespace Express {
    interface Request {
      cookies?: { [key: string]: string };
      auth: AuthInfo;  // 👈 扩展了 Request 类型
    }
  }
}
```

---

### 3️⃣ **MCP SDK 提取认证信息**

**代码位置：** `main.ts:460` 或 `main.ts:480`

```typescript
// 文件: mcp-server/src/main.ts
// 第 450-494 行

app.all('/mcp', async (req, res) => {
  try {
    const sessionId = req.get('Mcp-Session-Id');
    const session = sessionId ? getSession(sessionId) : createMCPSession();
    
    // 👇 关键：将 req 传递给 transport
    // MCP SDK 的 StreamableHTTPServerTransport 会从 req.auth 中提取认证信息
    await session.transport.handleRequest(req as any, res as any, req.body);
    
  } catch (error) {
    // 错误处理
  }
});
```

**MCP SDK 内部处理（简化说明）：**
```typescript
// MCP SDK 内部（StreamableHTTPServerTransport）
// 伪代码，实际在 SDK 内部

handleRequest(req, res, body) {
  // 从 req.auth 提取认证信息
  const authInfo = req.auth || null;
  
  // 创建 extra 对象
  const extra: RequestHandlerExtra = {
    authInfo: authInfo  // 👈 传递给工具回调
  };
  
  // 调用工具时传递 extra
  toolCallback(args, extra);
}
```

**关键点：**
- ✅ MCP SDK 的 `StreamableHTTPServerTransport` 会从 `req.auth` 中提取认证信息
- ✅ 将认证信息包装到 `extra.authInfo` 中
- ✅ 在调用工具回调时传递 `extra` 参数

---

### 4️⃣ **工具注册时的认证检查（main.ts:59-74）**

```typescript
// 文件: mcp-server/src/main.ts
// 第 59-74 行

globalMcpServer.registerTool(mcpTool.name, mcpTool.config, async (args, extra) => {
  // 👇 如果工具需要认证
  if (mcpTool.needAuthInfo) {
    // 从 extra 中获取认证信息
    const authInfo = extra.authInfo;
    
    // 👇 检查认证信息是否存在
    if (!authInfo || !authInfo.token) {
      // 抛出认证错误
      throw new McpError(
        MCP_CUSTOMIZED_ERROR_CODES.AUTHENTICATION_REQUIRED,  // 401
        'Authentication information is required. Check the info according to RFC 9728'
      );
    }
  }
  
  // 调用工具回调，传递 extra（包含 authInfo）
  const result = await mcpTool.toolCallback(args, extra);
  return result;
});
```

**关键点：**
- ✅ **认证检查**：如果工具设置了 `needAuthInfo: true`，会检查 `extra.authInfo`
- ✅ **错误处理**：如果没有 token，抛出 401 错误
- ✅ **传递 extra**：将 `extra`（包含 `authInfo`）传递给工具回调

---

### 5️⃣ **工具中使用认证信息（calendar.ts:160）**

```typescript
// 文件: mcp-server/src/mcp-modules/my/calendar.ts
// 第 138-165 行

const MY_CALENDAR_EVENTS_TOOL: MCPTool<ZodRawShape, ZodRawShape> = {
  name: 'my-calendar-events',
  type: 'tool',
  config: { ... },
  needAuthInfo: true,  // 👈 标记需要认证
  toolCallback: async (args, extra) => {
    // 验证输入
    const validatedArgs = MY_CALENDAR_EVENTS_INPUT_TYPE.safeParse(args);
    
    // 👇 使用 extra.authInfo.token 调用 API
    const events = await getMyCalendarEvents(
      extra.authInfo?.token,  // 👈 从 extra 中获取 token
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
};
```

**API 调用中使用 token（calendar.ts:88-97）：**
```typescript
async function getMyCalendarEvents(oauthToken: string, ...) {
  const url = `https://api.italki.com/api/v2/fixme/user/my_calendar?...`;
  
  const response = await fetch(url, {
    headers: {
      // 👇 将 token 添加到 API 请求的 Authorization header
      'Authorization': `Bearer ${oauthToken}`
    }
  });
  
  // 处理响应...
}
```

**关键点：**
- ✅ **从 extra 获取**：`extra.authInfo?.token`
- ✅ **传递给 API**：将 token 添加到 italki API 请求的 Authorization header
- ✅ **可选链操作符**：使用 `?.` 防止 authInfo 为 undefined

---

## 🔐 权限控制实现

### 1. 工具级别的权限控制

**标记需要认证的工具：**
```typescript
const MY_CALENDAR_EVENTS_TOOL: MCPTool<...> = {
  needAuthInfo: true,  // 👈 标记需要认证
  // ...
};
```

**注册时的检查：**
```typescript
if (mcpTool.needAuthInfo) {
  const authInfo = extra.authInfo;
  if (!authInfo || !authInfo.token) {
    throw new McpError(401, 'Authentication required');
  }
}
```

**结果：**
- ✅ 如果工具需要认证但没有 token → 返回 401 错误
- ✅ 如果工具需要认证且有 token → 正常执行
- ✅ 如果工具不需要认证 → 直接执行

---

### 2. Token 验证（可选，当前未实现）

**当前实现：**
```typescript
// main.ts:195-199
req.auth = {
  token: token,        // 直接使用，未验证
  clientId: '',
  scopes: []
};
```

**可以增强为：**
```typescript
// 如果启用了 OAuth Server
if (oauthServer) {
  const authInfo = await oauthServer.validateAccessToken(token);
  if (authInfo) {
    req.auth = {
      token: token,
      clientId: authInfo.clientId,
      scopes: authInfo.scopes,
      expiresAt: authInfo.expiresAt
    };
  } else {
    // Token 无效
    req.auth = null;
  }
}
```

**OAuth Server 的验证（oauth-server/index.ts:73-86）：**
```typescript
const validateAccessToken = async (token: string) => {
  try {
    const authInfo = await provider.verifyAccessToken(token);
    return {
      clientId: authInfo.clientId,
      scopes: authInfo.scopes,
      expiresAt: authInfo.expiresAt,
    };
  } catch {
    return null;  // Token 无效
  }
};
```

---

### 3. Scope 权限控制（可选）

**可以基于 scope 控制访问：**
```typescript
if (mcpTool.needAuthInfo) {
  const authInfo = extra.authInfo;
  if (!authInfo || !authInfo.token) {
    throw new McpError(401, 'Authentication required');
  }
  
  // 检查 scope
  if (mcpTool.requiredScopes) {
    const hasScope = mcpTool.requiredScopes.some(scope => 
      authInfo.scopes.includes(scope)
    );
    if (!hasScope) {
      throw new McpError(403, 'Insufficient permissions');
    }
  }
}
```

---

## 📊 数据流图

```
┌─────────────────────────────────────────────────────────────┐
│ 客户端                                                       │
│                                                              │
│ POST /mcp                                                    │
│ Headers:                                                     │
│   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 │
│   Mcp-Session-Id: abc-123                                   │
│ Body: { "method": "tools/call", "params": {...} }          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Express 中间件 (main.ts:181-202)                            │
│                                                              │
│ 1. 解析 Authorization header                                │
│    const token = authorizationHeader.split(' ')[1];         │
│                                                              │
│ 2. 设置 req.auth                                            │
│    req.auth = {                                             │
│      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",         │
│      clientId: '',                                           │
│      scopes: []                                              │
│    };                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ transport.handleRequest(req, res, req.body)                │
│                                                              │
│ MCP SDK 内部：                                               │
│   - 从 req.auth 提取认证信息                                │
│   - 创建 extra.authInfo = req.auth                          │
│   - 调用工具回调时传递 extra                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 工具注册回调 (main.ts:59-74)                                │
│                                                              │
│ if (mcpTool.needAuthInfo) {                                 │
│   const authInfo = extra.authInfo;                          │
│   if (!authInfo || !authInfo.token) {                      │
│     throw new McpError(401, 'Auth required');               │
│   }                                                          │
│ }                                                            │
│                                                              │
│ await mcpTool.toolCallback(args, extra);                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 工具回调 (calendar.ts:152-165)                              │
│                                                              │
│ toolCallback: async (args, extra) => {                      │
│   const token = extra.authInfo?.token;                       │
│   const events = await getMyCalendarEvents(token, ...);      │
│   return { ... };                                            │
│ }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ API 调用 (calendar.ts:88-97)                                │
│                                                              │
│ fetch('https://api.italki.com/...', {                       │
│   headers: {                                                │
│     'Authorization': `Bearer ${oauthToken}`                  │
│   }                                                          │
│ });                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 关键问题解答

### Q1: Authorization 是在哪里传的？

**A:** 客户端通过 HTTP Header 传递，格式：
```
Authorization: Bearer <access_token>
```

**不是 Cookie**，是标准的 HTTP 请求头。

---

### Q2: 从哪里获取的？

**A:** Express 中间件从 HTTP Header 获取：
```typescript
const authorizationHeader = req.get('Authorization');  // 从 HTTP Header
const token = authorizationHeader.split(' ')[1];      // 提取 token
```

---

### Q3: 格式是什么？

**A:** OAuth 2.0 标准格式：
```
Authorization: Bearer <access_token>
```

**示例：**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**解析：**
- `"Bearer "` 是固定的前缀
- `<access_token>` 是实际的 token 值（通常是 JWT）

---

### Q4: req.auth 最后是怎么被使用的？

**A:** 使用流程：

1. **设置**（main.ts:195-199）：
   ```typescript
   req.auth = {
     token: token,
     clientId: '',
     scopes: []
   };
   ```

2. **传递**（main.ts:460/480）：
   ```typescript
   transport.handleRequest(req, res, req.body);
   // MCP SDK 从 req.auth 提取并传递给 extra.authInfo
   ```

3. **检查**（main.ts:60-64）：
   ```typescript
   if (mcpTool.needAuthInfo) {
     const authInfo = extra.authInfo;
     if (!authInfo || !authInfo.token) {
       throw new McpError(401, 'Auth required');
     }
   }
   ```

4. **使用**（calendar.ts:160）：
   ```typescript
   const events = await getMyCalendarEvents(
     extra.authInfo?.token,  // 👈 使用 token
     ...
   );
   ```

5. **API 调用**（calendar.ts:95）：
   ```typescript
   headers: {
     'Authorization': `Bearer ${oauthToken}`  // 👈 传递给 italki API
   }
   ```

---

### Q5: 如何实现权限控制？

**A:** 三层权限控制：

#### 1. 工具级别（needAuthInfo）
```typescript
needAuthInfo: true  // 工具需要认证
```

#### 2. 注册时检查（main.ts:60-64）
```typescript
if (mcpTool.needAuthInfo) {
  if (!extra.authInfo || !extra.authInfo.token) {
    throw new McpError(401, 'Authentication required');
  }
}
```

#### 3. Token 验证（可选，当前未实现）
```typescript
// 可以验证 token 是否有效
const authInfo = await oauthServer.validateAccessToken(token);
if (!authInfo) {
  throw new McpError(401, 'Invalid token');
}
```

#### 4. Scope 权限（可选，当前未实现）
```typescript
// 可以检查 scope
if (!authInfo.scopes.includes('read')) {
  throw new McpError(403, 'Insufficient permissions');
}
```

---

## 🧪 测试示例

### 测试需要认证的工具

```bash
# 1. 不带 Authorization header（应该失败）
curl -X POST http://localhost:3030/mcp \
  -H 'Content-Type: application/json' \
  -H 'Mcp-Session-Id: <session-id>' \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "my-calendar-events",
      "arguments": {
        "startDatetime": "2024-01-01T00:00:00Z",
        "endDatetime": "2024-01-31T23:59:59Z",
        "showStudentEvents": true,
        "showTeacherEvents": true
      }
    }
  }'

# 预期：401 错误
# {
#   "jsonrpc": "2.0",
#   "id": "1",
#   "error": {
#     "code": 401,
#     "message": "Authentication information is required..."
#   }
# }

# 2. 带 Authorization header（应该成功）
curl -X POST http://localhost:3030/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <valid-token>' \
  -H 'Mcp-Session-Id: <session-id>' \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "my-calendar-events",
      "arguments": { ... }
    }
  }'

# 预期：成功返回日历事件
```

---

## 📝 总结

**认证流程：**
1. ✅ 客户端通过 HTTP Header 发送 `Authorization: Bearer <token>`
2. ✅ Express 中间件解析并设置 `req.auth`
3. ✅ MCP SDK 从 `req.auth` 提取并传递给 `extra.authInfo`
4. ✅ 工具注册时检查 `extra.authInfo`（如果 `needAuthInfo: true`）
5. ✅ 工具回调中使用 `extra.authInfo.token` 调用 API

**权限控制：**
- ✅ 工具级别：`needAuthInfo: true`
- ✅ 注册时检查：验证 token 是否存在
- ✅ 可选增强：Token 验证、Scope 检查

**关键点：**
- Authorization 是 HTTP Header，不是 Cookie
- 格式：`Bearer <token>`
- `req.auth` → `extra.authInfo` → `toolCallback` 中使用

