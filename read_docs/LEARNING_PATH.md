# 项目学习路径指南

## 📚 前置知识清单

### 核心必备知识（必须掌握）

1. **TypeScript 基础**
   - 类型系统（接口、类型别名、泛型）
   - 模块系统（import/export）
   - 异步编程（async/await, Promise）
   - 推荐学习：TypeScript 官方文档

2. **Node.js 基础**
   - 事件循环
   - 模块系统（CommonJS vs ES Modules）
   - 环境变量（process.env）
   - 文件系统操作（fs 模块）

3. **Express.js 框架**
   - 路由和中间件
   - 请求/响应处理
   - 错误处理
   - 推荐学习：Express 官方文档

4. **HTTP/HTTPS 协议**
   - 请求方法（GET, POST）
   - 状态码
   - 请求头/响应头
   - Cookie 和 Session

### 重要概念（需要理解）

5. **Model Context Protocol (MCP)**
   - **核心概念**：MCP 是 AI 应用与外部数据源/工具交互的协议
   - **关键组件**：
     - Tools（工具）：可执行的函数
     - Resources（资源）：可读取的数据
     - Prompts（提示）：模板化的提示词
   - **通信方式**：JSON-RPC 2.0
   - **推荐阅读**：
     - MCP SDK 文档：`@modelcontextprotocol/sdk`
     - 项目中的 `main.ts` 了解实现

6. **OAuth 2.0 认证**
   - **核心流程**：授权码流程（Authorization Code Flow）
   - **关键概念**：
     - Client（客户端）
     - Authorization Server（授权服务器）
     - Resource Server（资源服务器）
     - Access Token / Refresh Token
     - Authorization Code
     - PKCE（Proof Key for Code Exchange）
   - **RFC 标准**：
     - RFC 6749（OAuth 2.0 核心）
     - RFC 9728（OAuth 2.0 Protected Resource Metadata）
   - **推荐学习**：OAuth 2.0 简化指南

7. **Zod 数据验证**
   - Schema 定义
   - 类型推断
   - 验证和解析
   - 推荐学习：Zod 官方文档

### 辅助知识（了解即可）

8. **Nx Monorepo**
   - 项目结构
   - 构建系统
   - 推荐：先了解基本概念，深入时再学习

9. **EJS 模板引擎**
   - 模板语法
   - 数据渲染
   - 推荐：使用时查阅文档即可

10. **NeDB 数据库**
    - NoSQL 文档数据库
    - 文件存储
    - 推荐：了解基本操作即可

---

## 🗺️ 文件阅读顺序（从简单到复杂）

### 第一阶段：理解项目结构（30分钟）

1. **`package.json`** ⭐⭐⭐
   - 了解项目依赖
   - 查看脚本命令
   - 理解项目基本信息

2. **`README.md`** ⭐⭐⭐
   - 项目概述
   - 快速开始指南
   - 基本使用示例

3. **`env.example`** ⭐⭐
   - 环境变量配置
   - 理解可配置项

### 第二阶段：核心接口和类型（1小时）

4. **`mcp-server/src/interfaces.ts`** ⭐⭐⭐⭐⭐
   - **关键文件**：定义所有模块接口
   - 理解 `MCPModule`, `MCPTool`, `MCPResource`, `MCPPrompt`
   - 这是理解整个模块系统的关键

5. **`mcp-server/src/italki-api-interfaces.ts`** ⭐⭐⭐
   - italki API 的类型定义
   - 了解数据结构

### 第三阶段：简单模块示例（1小时）

6. **`mcp-server/src/mcp-modules/system/ping.ts`** ⭐⭐⭐⭐
   - **最简单的模块示例**
   - 理解工具的基本结构
   - 无参数、无认证的简单工具

7. **`mcp-server/src/mcp-modules/index.ts`** ⭐⭐⭐
   - 查看所有已注册的模块
   - 理解模块注册机制

### 第四阶段：业务模块（2小时）

8. **`mcp-server/src/mcp-modules/metadata/all-language.ts`** ⭐⭐⭐
   - 读取外部 API 的示例
   - 理解资源类型模块

9. **`mcp-server/src/mcp-modules/teacher/recommendation.ts`** ⭐⭐⭐⭐
   - **重要示例**：完整的工具实现
   - 包含：
     - 输入验证（Zod）
     - API 调用
     - 数据转换
     - EJS 模板渲染
     - 结构化输出

10. **`mcp-server/src/mcp-modules/my/calendar.ts`** ⭐⭐⭐⭐⭐
    - **需要认证的模块示例**
    - 理解 `needAuthInfo` 标志
    - 理解 `extra.authInfo` 的使用
    - OAuth Token 的使用

### 第五阶段：OAuth 系统（3-4小时）

11. **`mcp-server/src/oauth-server/index.ts`** ⭐⭐⭐⭐
    - OAuth 服务器的创建
    - Mock Provider vs 外部 Provider
    - 理解两种模式的区别

12. **`mcp-server/src/oauth-server/provider.ts`** ⭐⭐⭐⭐⭐
    - **核心实现**：OAuth Provider
    - 客户端管理
    - Token 管理
    - 授权码流程

13. **`mcp-server/src/oauth-server/*-store.ts`** ⭐⭐⭐
    - 各种数据存储实现
    - 理解数据持久化

14. **`mcp-server/src/admin-server.ts`** ⭐⭐⭐
    - 管理 API 的实现
    - RESTful API 设计

### 第六阶段：主服务器（2-3小时）

15. **`mcp-server/src/main.ts`** ⭐⭐⭐⭐⭐
    - **最核心的文件**
    - 理解：
      - MCP 服务器初始化
      - 会话管理
      - 路由设置
      - 中间件
      - OAuth 集成
      - 日志系统

### 第七阶段：配置和部署（1小时）

16. **`ACCESS_LOGS.md`** ⭐⭐
    - 日志系统配置

17. **`HTTPS_DEPLOYMENT.md`** ⭐⭐
    - HTTPS 部署指南

18. **`nx.json`** ⭐
    - 构建配置

---

## 🔑 关键概念详解

### 1. MCP 模块系统

```typescript
// 工具模块结构
const MY_TOOL: MCPTool<InputSchema, OutputSchema> = {
  name: 'tool-name',           // 工具名称
  type: 'tool',                 // 模块类型
  needAuthInfo: true,           // 是否需要认证（可选）
  config: {
    title: '工具标题',
    description: '工具描述',
    inputSchema: {...},          // Zod schema
    outputSchema: {...},         // Zod schema
  },
  toolCallback: async (args, extra) => {
    // 工具实现逻辑
    // extra.authInfo 包含认证信息（如果 needAuthInfo=true）
    return { content: [...] };
  }
};
```

### 2. 会话管理

- 每个 MCP 客户端连接创建一个会话
- 会话 ID 通过 `Mcp-Session-Id` 头部传递
- 会话 30 分钟无活动后自动过期
- 多个客户端可以同时连接（不同会话）

### 3. OAuth 流程

```
1. 客户端注册 → 获取 client_id 和 client_secret
2. 用户授权 → 获取 authorization_code
3. 交换 Token → 使用 code 换取 access_token
4. 访问资源 → 使用 access_token 调用需要认证的工具
```

### 4. 认证集成

```typescript
// 在工具中使用认证
if (mcpTool.needAuthInfo) {
  const authInfo = extra.authInfo;
  if (!authInfo || !authInfo.token) {
    throw new McpError(401, 'Authentication required');
  }
  // 使用 authInfo.token 调用 italki API
}
```

---

## 🎯 实践建议

### 第一步：运行项目

```bash
# 1. 安装依赖
npm install

# 2. 构建项目
npx nx build mcp-server

# 3. 启动服务器
node dist/mcp-server/main.js

# 4. 测试健康检查
curl http://localhost:3030/health
```

### 第二步：测试简单工具

```bash
# 初始化 MCP 会话
RESPONSE=$(curl -si -X POST http://localhost:3030/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}')

SESSION_ID=$(echo "$RESPONSE" | grep -i "mcp-session-id" | cut -d' ' -f2)

# 调用 ping 工具
curl -si -X POST http://localhost:3030/mcp \
  -H 'Content-Type: application/json' \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"ping"}}'
```

### 第三步：阅读代码并添加注释

- 在关键函数处添加自己的理解注释
- 画出数据流图
- 记录疑问点

### 第四步：创建自己的模块

参考 `ping.ts` 创建一个简单的工具模块：
- 定义输入/输出 schema
- 实现工具逻辑
- 在 `mcp-modules/index.ts` 中注册

### 第五步：理解 OAuth 流程

1. 启动 Mock OAuth Provider：`MOCK_OAUTH_PROVIDER=true`
2. 注册客户端
3. 完成授权流程
4. 使用 Token 调用需要认证的工具

---

## 📖 推荐学习资源

### 官方文档
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [Express.js 文档](https://expressjs.com/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Zod 文档](https://zod.dev/)

### 调试技巧
1. **使用日志**：设置 `LOG_REQUEST_RESPONSE=true` 查看详细请求
2. **断点调试**：使用 VS Code 调试器
3. **API 测试**：使用 Postman 或 curl 测试端点
4. **查看数据库**：检查 `./db` 目录下的 NeDB 文件

---

## ⚠️ 常见难点

1. **MCP 协议理解**
   - 难点：JSON-RPC 2.0 格式
   - 解决：查看 `main.ts` 中的请求处理逻辑

2. **OAuth 流程**
   - 难点：多个步骤和状态管理
   - 解决：画出流程图，逐步跟踪代码

3. **类型系统**
   - 难点：Zod schema 和 TypeScript 类型转换
   - 解决：理解 `z.infer<typeof Schema>`

4. **会话管理**
   - 难点：多客户端并发
   - 解决：理解 `sessions` Map 的使用

---

## 🎓 学习检查清单

完成以下任务表示你已经理解项目：

- [ ] 能够解释 MCP 协议的基本概念
- [ ] 理解三种模块类型（Tool, Resource, Prompt）的区别
- [ ] 能够创建一个简单的工具模块
- [ ] 理解 OAuth 2.0 授权码流程
- [ ] 能够解释会话管理机制
- [ ] 理解认证如何集成到工具中
- [ ] 能够配置和启动服务器
- [ ] 能够使用 curl 测试 MCP 端点
- [ ] 理解日志系统的配置
- [ ] 能够解释数据验证流程（Zod）

---

## 💡 下一步建议

1. **深入理解**：选择一个模块深入研究其实现细节
2. **扩展功能**：添加新的 italki API 集成
3. **优化改进**：添加错误处理、缓存、限流等
4. **测试**：编写单元测试和集成测试
5. **文档**：为你的代码添加 JSDoc 注释

---

**祝你学习顺利！** 🚀

