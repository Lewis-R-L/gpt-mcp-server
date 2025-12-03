# OAuth Server 架构分析

## 📋 概述

`oauth-server` 文件夹实现了一个完整的 OAuth 2.0 授权服务器，用于为 MCP 服务器提供认证和授权功能。它支持两种模式：
1. **Mock OAuth Provider**：内置的完整 OAuth 服务器（开发/测试用）
2. **External OAuth Server**：仅提供元数据端点（使用外部 OAuth 服务器）

---

## 🎯 核心功能

### 1. OAuth 2.0 授权码流程（Authorization Code Flow）

实现标准的 OAuth 2.0 授权码流程：
- 客户端注册
- 用户登录
- 授权确认
- 授权码生成
- Token 交换
- Token 验证

### 2. PKCE 支持

支持 OAuth 2.0 PKCE（Proof Key for Code Exchange）扩展，增强安全性。

### 3. 数据持久化

使用 NeDB（NoSQL 数据库）持久化存储：
- 客户端信息
- 用户信息
- 授权码
- Access Token / Refresh Token
- 待处理授权
- 用户会话

---

## 📁 文件结构

```
oauth-server/
├── index.ts                    # 入口文件，创建 OAuth 服务器
├── provider.ts                 # OAuth Provider 核心实现
├── clients-store.ts            # 客户端数据存储
├── users-store.ts              # 用户数据存储
├── authorization-codes-store.ts # 授权码存储
├── tokens-store.ts             # Token 存储
├── pending-authorizations-store.ts # 待处理授权存储
├── user-sessions-store.ts      # 用户会话存储
└── auth-pages.ts               # HTML 认证页面
```

---

## 🏗️ 底层架构

### 架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                    Express 应用层                            │
│  (main.ts: 路由注册和中间件)                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              OAuth Server 接口层                             │
│  (index.ts: createOAuthServer / createOAuthMetadataServer)  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  MCP SDK Router (mcpAuthRouter)                    │    │
│  │  - /oauth/authorize (GET)                         │    │
│  │  - /oauth/token (POST)                            │    │
│  │  - /oauth/register (POST)                         │    │
│  │  - /.well-known/oauth-authorization-server        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  自定义路由 (main.ts:378-400)                      │    │
│  │  - /oauth/login (POST)                             │    │
│  │  - /oauth/register (POST)                          │    │
│  │  - /oauth/authorize (POST)                         │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              OAuth Provider 层                               │
│  (provider.ts: NeDBOAuthServerProvider)                      │
│                                                              │
│  实现 OAuthServerProvider 接口：                             │
│  - authorize()              # 授权端点处理                   │
│  - exchangeAuthorizationCode() # Token 交换                  │
│  - verifyAccessToken()      # Token 验证                    │
│  - handleLogin()            # 用户登录                       │
│  - handleRegister()         # 用户注册                       │
│  - handleAuthorizationConfirmation() # 授权确认             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              数据存储层 (Store Layer)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ ClientsStore │  │  UsersStore   │  │  CodesStore  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ TokensStore  │  │PendingAuthStore│ │SessionStore  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              持久化层 (NeDB)                                 │
│  ./db/                                                       │
│  ├── clients.db                                             │
│  ├── users.db                                               │
│  ├── authorization_codes.db                                 │
│  ├── tokens.db                                              │
│  ├── pending_authorizations.db                              │
│  └── user_sessions.db                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 外界如何关联

### 1. 初始化（main.ts:359-417）

```typescript
// 文件: mcp-server/src/main.ts
// 第 359-417 行

if (MOCK_OAUTH_PROVIDER) {
  // 创建 OAuth 服务器
  oauthServer = createOAuthServer({
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 86400,
    authorizationCodeLifetime: 600,
    allowedScopes: 'read,write,admin'.split(','),
    defaultScopes: 'read'.split(','),
    dbPath: process.env.OAUTH_DB_PATH || './db',
    issuerUrl: new URL('https://learnabc.italki.com'),
    baseUrl: new URL('https://learnabc.italki.com'),
    resourceServerUrl: new URL('mcp', baseUrl),
    scopesSupported: 'read,write,admin'.split(','),
    resourceName: 'italki MCP Server',
  });

  // 注册自定义路由
  app.post('/oauth/login', async (req, res) => {
    await oauthServer.provider.handleLogin(req, res);
  });

  app.post('/oauth/register', async (req, res) => {
    await oauthServer.provider.handleRegister(req, res);
  });

  app.post('/oauth/authorize', async (req, res) => {
    await oauthServer.provider.handleAuthorizationConfirmation(req, res);
  });

  // 注册 MCP SDK 的路由（标准 OAuth 端点）
  app.use(oauthServer.router);
}
```

**关键点：**
- ✅ `createOAuthServer()` 创建服务器实例
- ✅ 注册自定义路由（登录、注册、授权确认）
- ✅ 注册 MCP SDK 的路由（标准 OAuth 端点）

---

### 2. 端点映射

#### MCP SDK 提供的标准端点

| 端点 | 方法 | 处理者 | 说明 |
|------|------|--------|------|
| `/oauth/authorize` | GET | MCP SDK | 授权端点（启动授权流程） |
| `/oauth/token` | POST | MCP SDK | Token 端点（交换授权码） |
| `/oauth/register` | POST | MCP SDK | 客户端注册 |
| `/.well-known/oauth-authorization-server` | GET | MCP SDK | 授权服务器元数据 |
| `/.well-known/oauth-protected-resource` | GET | MCP SDK | 受保护资源元数据 |

#### 自定义端点

| 端点 | 方法 | 处理者 | 说明 |
|------|------|--------|------|
| `/oauth/login` | POST | provider.handleLogin() | 用户登录 |
| `/oauth/register` | POST | provider.handleRegister() | 用户注册 |
| `/oauth/authorize` | POST | provider.handleAuthorizationConfirmation() | 授权确认 |

---

### 3. 数据流（完整 OAuth 流程）

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 客户端注册                                                │
│                                                              │
│ POST /oauth/register                                         │
│ Body: { client_name, redirect_uris, ... }                    │
│                                                              │
│ → MCP SDK Router → provider.registerClient()                │
│ → ClientsStore.registerClient()                             │
│ → 返回: { client_id, client_secret, ... }                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 授权请求                                                  │
│                                                              │
│ GET /oauth/authorize?                                        │
│   client_id=xxx&                                             │
│   redirect_uri=xxx&                                          │
│   scope=read&                                                │
│   response_type=code&                                        │
│   code_challenge=xxx                                         │
│                                                              │
│ → MCP SDK Router → provider.authorize()                     │
│ → 检查用户登录状态                                           │
│ → 如果未登录：显示登录页面                                   │
│ → 如果已登录：显示授权确认页面                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 用户登录（如果未登录）                                    │
│                                                              │
│ POST /oauth/login                                            │
│ Body: { username, password }                                 │
│                                                              │
│ → provider.handleLogin()                                     │
│ → UsersStore.verifyUser()                                    │
│ → UserSessionsStore.createSession()                          │
│ → 设置 sessionId cookie                                       │
│ → 重定向到授权确认页面                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 授权确认                                                  │
│                                                              │
│ POST /oauth/authorize                                        │
│ Body: { approved: true/false }                               │
│                                                              │
│ → provider.handleAuthorizationConfirmation()                │
│ → 如果批准：                                                 │
│   - 生成授权码                                               │
│   - AuthorizationCodesStore.createCode()                    │
│   - 重定向到 redirect_uri?code=xxx&state=xxx                 │
│ → 如果拒绝：                                                 │
│   - 重定向到 redirect_uri?error=access_denied               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Token 交换                                                │
│                                                              │
│ POST /oauth/token                                            │
│ Body: {                                                      │
│   grant_type: "authorization_code",                          │
│   code: "xxx",                                               │
│   code_verifier: "xxx",                                      │
│   redirect_uri: "xxx"                                        │
│ }                                                            │
│                                                              │
│ → MCP SDK Router → provider.exchangeAuthorizationCode()     │
│ → AuthorizationCodesStore.getCode()                         │
│ → 验证 PKCE (code_verifier)                                 │
│ → 生成 Access Token 和 Refresh Token                        │
│ → TokensStore.createToken()                                  │
│ → 返回: { access_token, refresh_token, ... }                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 使用 Token                                                │
│                                                              │
│ POST /mcp                                                    │
│ Headers: Authorization: Bearer <access_token>               │
│                                                              │
│ → Express 中间件提取 token                                   │
│ → provider.verifyAccessToken(token)                          │
│ → TokensStore.getToken()                                    │
│ → 检查过期时间                                               │
│ → 返回 AuthInfo { clientId, scopes, expiresAt }             │
│ → 传递给工具回调                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 核心组件详解

### 1. index.ts - 入口文件

**职责：**
- 创建 OAuth 服务器实例
- 集成 MCP SDK 的路由
- 提供工具函数（validateAccessToken, startCleanup）

**关键函数：**

```typescript
// 创建完整的 OAuth 服务器
export function createOAuthServer(options: OAuthServerOptions): OAuthServer {
  // 1. 创建 Provider
  const provider = new NeDBOAuthServerProvider(config);
  
  // 2. 创建 OAuth 元数据
  const metadata = createOAuthMetadata({...});
  
  // 3. 创建 MCP SDK 路由
  const router = mcpAuthRouter({
    provider,
    issuerUrl,
    baseUrl,
    resourceServerUrl,
    scopesSupported,
    resourceName,
  });
  
  return {
    router,        // Express 路由处理器
    metadata,      // OAuth 元数据
    provider,      // Provider 实例
    validateAccessToken,  // Token 验证函数
    startCleanup,  // 清理任务启动函数
  };
}
```

---

### 2. provider.ts - OAuth Provider 核心实现

**职责：**
- 实现 `OAuthServerProvider` 接口
- 处理 OAuth 2.0 授权码流程
- 管理用户登录/注册
- Token 生成和验证

**关键方法：**

#### authorize() - 授权端点处理

```typescript
async authorize(client, params, res): Promise<void> {
  // 1. 检查用户登录状态
  if (!(await this.isUserLoggedIn(sessionId))) {
    // 未登录：存储待处理授权，显示登录页面
    await this.pendingAuthorizationsStore.createPendingAuthorization(...);
    res.send(getLoginPage());
    return;
  }
  
  // 2. 已登录：存储待处理授权，显示授权确认页面
  await this.pendingAuthorizationsStore.createPendingAuthorization(...);
  res.send(getAuthorizationPage(...));
}
```

#### exchangeAuthorizationCode() - Token 交换

```typescript
async exchangeAuthorizationCode(client, code, codeVerifier, ...): Promise<OAuthTokens> {
  // 1. 验证授权码
  const codeData = await this.codesStore.getCode(code);
  if (!codeData || codeData.expiresAt < Date.now()) {
    throw new InvalidRequestError('Invalid or expired code');
  }
  
  // 2. 验证 PKCE
  // (由 MCP SDK 处理)
  
  // 3. 生成 Token
  const accessToken = randomUUID();
  const refreshToken = randomUUID();
  
  // 4. 存储 Token
  await this.tokensStore.createToken(accessTokenData);
  await this.tokensStore.createToken(refreshTokenData);
  
  // 5. 删除授权码（单次使用）
  await this.codesStore.deleteCode(code);
  
  // 6. 返回 Token
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: this.config.accessTokenLifetime,
    scope: scopes.join(' '),
  };
}
```

#### verifyAccessToken() - Token 验证

```typescript
async verifyAccessToken(token: string): Promise<AuthInfo> {
  // 1. 从数据库获取 Token
  const tokenData = await this.tokensStore.getToken(token, 'access');
  
  if (!tokenData) {
    throw new InvalidTokenError('Token not found');
  }
  
  // 2. 检查过期
  if (tokenData.expiresAt < Date.now()) {
    throw new InvalidTokenError('Token expired');
  }
  
  // 3. 返回认证信息
  return {
    clientId: tokenData.clientId,
    scopes: tokenData.scopes,
    expiresAt: tokenData.expiresAt,
  };
}
```

---

### 3. Store 层 - 数据存储

所有 Store 都使用 NeDB（NoSQL 数据库）进行持久化存储。

#### ClientsStore - 客户端存储

**文件：** `clients-store.ts`

**职责：**
- 客户端注册
- 客户端查询/更新/删除
- Scope 验证

**关键方法：**
- `registerClient()` - 注册新客户端，生成 `client_id` 和 `client_secret`
- `getClient()` - 根据 `client_id` 获取客户端信息
- `updateClient()` - 更新客户端信息
- `deleteClient()` - 删除客户端

#### UsersStore - 用户存储

**文件：** `users-store.ts`

**职责：**
- 用户注册
- 用户认证
- 密码管理

**关键方法：**
- `createUser()` - 创建用户（密码哈希）
- `getUser()` - 获取用户信息
- `verifyUser()` - 验证用户名和密码
- `updatePassword()` - 更新密码

#### AuthorizationCodesStore - 授权码存储

**文件：** `authorization-codes-store.ts`

**职责：**
- 授权码生成和存储
- 授权码验证
- 授权码清理（过期）

**关键方法：**
- `createCode()` - 创建授权码
- `getCode()` - 获取授权码信息
- `deleteCode()` - 删除授权码（单次使用）
- `cleanupExpired()` - 清理过期授权码

#### TokensStore - Token 存储

**文件：** `tokens-store.ts`

**职责：**
- Access Token 和 Refresh Token 存储
- Token 查询和验证
- Token 清理（过期）

**关键方法：**
- `createToken()` - 创建 Token
- `getToken()` - 获取 Token 信息
- `deleteToken()` - 删除 Token
- `cleanupExpired()` - 清理过期 Token

#### PendingAuthorizationsStore - 待处理授权存储

**文件：** `pending-authorizations-store.ts`

**职责：**
- 存储待用户确认的授权请求
- 管理授权请求的生命周期

**关键方法：**
- `createPendingAuthorization()` - 创建待处理授权
- `getPendingAuthorization()` - 获取待处理授权
- `updatePendingAuthorization()` - 更新待处理授权
- `deletePendingAuthorization()` - 删除待处理授权
- `cleanupExpired()` - 清理过期授权

#### UserSessionsStore - 用户会话存储

**文件：** `user-sessions-store.ts`

**职责：**
- 用户登录会话管理
- 会话过期处理

**关键方法：**
- `createSession()` - 创建用户会话
- `getSession()` - 获取会话信息
- `deleteSession()` - 删除会话
- `cleanupExpired()` - 清理过期会话

---

### 4. auth-pages.ts - HTML 认证页面

**职责：**
- 生成登录页面 HTML
- 生成注册页面 HTML
- 生成授权确认页面 HTML

**关键函数：**
- `getLoginPage()` - 返回登录页面 HTML
- `getAuthorizationPage()` - 返回授权确认页面 HTML

---

## 🔄 完整 OAuth 流程示例

### 场景：客户端获取 Access Token

```
1. 客户端注册
   POST /oauth/register
   → 返回: { client_id: "abc-123", client_secret: "xyz-789" }

2. 用户授权请求
   GET /oauth/authorize?client_id=abc-123&redirect_uri=...&scope=read&response_type=code&code_challenge=...
   → 如果未登录：显示登录页面
   → 如果已登录：显示授权确认页面

3. 用户登录（如果需要）
   POST /oauth/login
   Body: { username: "user1", password: "pass123" }
   → 创建用户会话
   → 设置 sessionId cookie
   → 重定向到授权确认页面

4. 用户确认授权
   POST /oauth/authorize
   Body: { approved: true }
   → 生成授权码: "auth-code-456"
   → 重定向: redirect_uri?code=auth-code-456&state=...

5. 交换 Token
   POST /oauth/token
   Body: {
     grant_type: "authorization_code",
     code: "auth-code-456",
     code_verifier: "...",
     redirect_uri: "..."
   }
   Headers: Authorization: Basic <client_credentials>
   → 验证授权码
   → 验证 PKCE
   → 生成 Access Token: "access-token-789"
   → 返回: {
       access_token: "access-token-789",
       refresh_token: "refresh-token-101",
       token_type: "bearer",
       expires_in: 3600,
       scope: "read"
     }

6. 使用 Token
   POST /mcp
   Headers: Authorization: Bearer access-token-789
   → provider.verifyAccessToken("access-token-789")
   → 返回 AuthInfo
   → 传递给工具回调
```

---

## 🔐 安全机制

### 1. PKCE（Proof Key for Code Exchange）

- 客户端生成 `code_challenge` 和 `code_verifier`
- 授权请求时发送 `code_challenge`
- Token 交换时发送 `code_verifier`
- 服务器验证 `code_challenge` 和 `code_verifier` 的匹配

### 2. 授权码单次使用

- 授权码只能使用一次
- Token 交换后立即删除授权码

### 3. Token 过期

- Access Token：默认 1 小时
- Refresh Token：默认 24 小时
- 授权码：默认 10 分钟

### 4. 会话管理

- 用户会话：30 分钟超时
- 使用 HTTP-only Cookie 存储 sessionId

### 5. 密码安全

- 密码使用 bcrypt 哈希存储
- 不存储明文密码

---

## 📊 数据模型

### Client（客户端）

```typescript
{
  client_id: string;
  client_secret: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  client_name?: string;
  client_uri?: string;
  redirect_uris: string[];
  scope: string;
  // ...
}
```

### User（用户）

```typescript
{
  username: string;
  passwordHash: string;  // bcrypt 哈希
  createdAt: number;
}
```

### AuthorizationCode（授权码）

```typescript
{
  code: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
  createdAt: number;
}
```

### Token（Token）

```typescript
{
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
  type: 'access' | 'refresh';
  refreshToken?: string;
  authorizationCode?: string;
}
```

---

## 🎓 总结

**OAuth Server 的作用：**
1. ✅ 提供完整的 OAuth 2.0 授权服务器功能
2. ✅ 管理客户端、用户、Token 等数据
3. ✅ 为 MCP 工具提供认证支持

**外界关联方式：**
1. ✅ 通过 `createOAuthServer()` 创建服务器
2. ✅ 通过 Express 路由注册端点
3. ✅ 通过 `provider` 实例处理业务逻辑

**底层架构：**
1. ✅ **接口层**：MCP SDK Router + 自定义路由
2. ✅ **业务层**：NeDBOAuthServerProvider
3. ✅ **存储层**：6 个 Store（Clients, Users, Codes, Tokens, PendingAuth, Sessions）
4. ✅ **持久化层**：NeDB 数据库文件

**设计模式：**
- **分层架构**：接口层 → 业务层 → 存储层 → 持久化层
- **Repository 模式**：每个 Store 封装数据访问逻辑
- **Provider 模式**：Provider 实现 OAuth 协议逻辑

