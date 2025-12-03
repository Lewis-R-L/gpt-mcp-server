# Vercel 部署检查清单

## ✅ 已完成的配置

- [x] 创建 Vercel 适配入口文件 (`api/index.ts`)
- [x] 更新 `vercel.json` 配置（路由规则）
- [x] 处理文件系统限制（数据库路径使用 `/tmp`）
- [x] 集成管理服务器到主应用（路径 `/admin/*`）
- [x] 创建部署文档

## 📝 部署前需要做的事情

### 1. 在 Vercel 控制台配置环境变量

访问 Vercel 项目设置 → Environment Variables，添加：

#### 必需变量
```
NODE_ENV=production
MOCK_OAUTH_PROVIDER=true
OAUTH_DB_PATH=/tmp/db
```

#### 推荐变量
```
OAUTH_ACCESS_TOKEN_LIFETIME=3600
OAUTH_REFRESH_TOKEN_LIFETIME=86400
OAUTH_AUTHORIZATION_CODE_LIFETIME=600
OAUTH_ALLOWED_SCOPES=read,write,admin
OAUTH_DEFAULT_SCOPES=read
OAUTH_ISSUER=italki-mcp-oauth
LOG_LEVEL=info
```

### 2. 代码更改说明

#### 新增文件
- `api/index.ts` - Vercel serverless function 入口

#### 修改文件
- `vercel.json` - 更新路由配置和构建设置

#### 重要变化
1. **不再监听端口** - Express app 直接导出给 Vercel
2. **数据库路径** - 自动使用 `/tmp/db`（Vercel 环境）
3. **管理服务器** - 集成到主应用，路径为 `/admin/*`
4. **基础 URL** - 自动从 `VERCEL_URL` 环境变量获取

### 3. 部署命令

```bash
# 使用 Vercel CLI
vercel --prod

# 或通过 Git 推送自动部署
git push origin main
```

### 4. 验证部署

部署后访问以下端点验证：

- [ ] `https://your-project.vercel.app/health` - 应返回 "ok"
- [ ] `https://your-project.vercel.app/mcp` - MCP 端点
- [ ] `https://your-project.vercel.app/admin/api/stats` - 管理 API（如果启用 OAuth）

## ⚠️ 已知限制

1. **数据库持久化**: `/tmp` 目录在函数调用间可能被清理，不适合生产环境
2. **会话管理**: 内存会话在无服务器环境中不持久化
3. **管理服务器**: 不再有独立端口，所有路由都在主应用下

## 🔄 后续改进建议

1. **迁移到外部数据库**（MongoDB Atlas、PostgreSQL）
2. **使用 Redis 管理会话**（Upstash Redis）
3. **添加认证中间件**保护管理 API
4. **配置监控和日志**（Vercel Analytics）

## 📚 参考文档

- 详细部署指南: `VERCEL_DEPLOYMENT.md`
- Vercel 官方文档: https://vercel.com/docs

