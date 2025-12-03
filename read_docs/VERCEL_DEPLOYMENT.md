# Vercel 部署指南

本文档说明如何将 MCP 服务器部署到 Vercel。

## 📋 部署前准备

### 1. 环境变量配置

在 Vercel 项目设置中配置以下环境变量：

#### 必需的环境变量

```bash
# 基础配置
NODE_ENV=production

# OAuth 配置（如果使用 Mock OAuth Provider）
MOCK_OAUTH_PROVIDER=true  # 或 false（使用外部 OAuth 服务器）
OAUTH_DB_PATH=/tmp/db     # Vercel 函数中唯一可写目录

# OAuth 服务器配置
OAUTH_ACCESS_TOKEN_LIFETIME=3600
OAUTH_REFRESH_TOKEN_LIFETIME=86400
OAUTH_AUTHORIZATION_CODE_LIFETIME=600
OAUTH_ALLOWED_SCOPES=read,write,admin
OAUTH_DEFAULT_SCOPES=read
OAUTH_ISSUER=italki-mcp-oauth

# 基础 URL（Vercel 会自动设置 VERCEL_URL，但可以手动覆盖）
BASE_URL=https://your-project.vercel.app

# 如果使用外部 OAuth 服务器
EXTERNAL_OAUTH_SERVER_URL=https://api.italki.com
```

#### 可选的环境变量

```bash
# 日志配置
LOG_LEVEL=info
DISABLE_ACCESS_LOG=false
LOG_FORMAT=common  # 或 'json'
LOG_REQUEST_RESPONSE=false

# OAuth 清理间隔（毫秒）
OAUTH_CLEANUP_INTERVAL=3600000
```

### 2. 重要注意事项

#### ⚠️ 文件系统限制

- **Vercel 函数文件系统是只读的**（除了 `/tmp` 目录）
- 数据库文件必须存储在 `/tmp` 目录下
- **重要**：`/tmp` 目录在每次函数调用时可能会被清理，**不适合持久化存储**
- 建议使用外部数据库服务（如 MongoDB、PostgreSQL）替代 NeDB

#### ⚠️ 会话管理

- 内存中的会话（`Map`）在无服务器环境中**不会持久化**
- 每次函数调用可能在不同的实例上执行
- 建议使用外部存储（Redis、数据库）来管理会话

#### ⚠️ 管理服务器

- 管理服务器已集成到主应用中，路径为 `/admin/*`
- 不再需要单独的端口配置
- 访问管理 API：`https://your-project.vercel.app/admin/api/*`

## 🚀 部署步骤

### 方法 1：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

### 方法 2：通过 GitHub 集成

1. 将代码推送到 GitHub
2. 在 Vercel 控制台导入项目
3. 配置环境变量
4. 部署

### 方法 3：通过 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 导入你的 Git 仓库
4. 配置项目设置：
   - **Framework Preset**: Other
   - **Build Command**: `npm run vercel-build`（可选，Vercel 会自动构建）
   - **Output Directory**: 留空（Vercel 使用 serverless functions）
   - **Install Command**: `npm install`
5. 添加环境变量
6. 点击 "Deploy"

## 📁 项目结构

```
gpt-mcp-server/
├── api/
│   └── index.ts          # Vercel serverless function 入口
├── mcp-server/
│   └── src/              # 源代码
├── vercel.json           # Vercel 配置
└── package.json
```

## 🔧 配置说明

### vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/mcp",
      "dest": "/api/index.ts"
    },
    {
      "src": "/oauth/(.*)",
      "dest": "/api/index.ts"
    },
    {
      "src": "/.well-known/(.*)",
      "dest": "/api/index.ts"
    },
    {
      "src": "/admin/(.*)",
      "dest": "/api/index.ts"
    },
    {
      "src": "/health",
      "dest": "/api/index.ts"
    }
  ],
  "functions": {
    "api/index.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

## 🌐 API 端点

部署后的端点：

- **MCP 端点**: `https://your-project.vercel.app/mcp`
- **健康检查**: `https://your-project.vercel.app/health`
- **OAuth 端点**: `https://your-project.vercel.app/oauth/*`
- **OAuth 元数据**: `https://your-project.vercel.app/.well-known/oauth-protected-resource`
- **管理 API**: `https://your-project.vercel.app/admin/api/*`

## 🔍 故障排查

### 问题 1: 数据库写入失败

**症状**: OAuth 相关操作失败，提示文件系统只读

**解决方案**: 
- 确保 `OAUTH_DB_PATH=/tmp/db`
- 考虑迁移到外部数据库服务

### 问题 2: 会话丢失

**症状**: MCP 会话无法保持

**解决方案**:
- 使用外部存储（Redis）管理会话
- 或确保客户端在每次请求中发送 `Mcp-Session-Id` header

### 问题 3: 构建失败

**症状**: Vercel 构建时报错

**解决方案**:
- 检查 `package.json` 中的依赖是否正确
- 确保 TypeScript 配置正确
- 查看 Vercel 构建日志

### 问题 4: 函数超时

**症状**: 请求超时（30秒）

**解决方案**:
- 检查 `vercel.json` 中的 `maxDuration` 设置
- 优化代码性能
- 考虑使用 Vercel Pro 计划（支持更长的超时时间）

## 📝 改进建议

### 1. 使用外部数据库

将 NeDB 替换为：
- **MongoDB Atlas**（免费层可用）
- **PostgreSQL**（如 Supabase、Neon）
- **Redis**（用于会话存储）

### 2. 使用外部会话存储

- **Redis**（推荐，如 Upstash）
- **数据库**（PostgreSQL/MongoDB）

### 3. 启用 Vercel Analytics

监控函数性能和错误率

### 4. 配置自定义域名

在 Vercel 项目设置中配置自定义域名

## 🔐 安全建议

1. **不要在代码中硬编码密钥**
2. **使用 Vercel 环境变量存储敏感信息**
3. **启用 HTTPS**（Vercel 自动提供）
4. **配置 CORS**（如需要）
5. **限制管理 API 访问**（添加认证中间件）

## 📚 相关文档

- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Routing](https://vercel.com/docs/routing)

