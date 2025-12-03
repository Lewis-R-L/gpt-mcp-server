# HTTPS 部署指南

## 功能特性

- ✅ 同时支持 HTTP 和 HTTPS
- ✅ 环境变量配置
- ✅ 自签名证书生成（开发环境）
- ✅ 生产环境 SSL 证书支持
- ✅ 自动降级（HTTPS 失败时继续使用 HTTP）

## 快速开始

### 1. 开发环境（自签名证书）

```bash
# 生成自签名证书
./scripts/generate-ssl-cert.sh

# 启动 HTTPS 服务器
USE_HTTPS=true node dist/mcp-server/main.js
```

### 2. 生产环境（正式证书）

```bash
# 设置环境变量
export USE_HTTPS=true
export SSL_CERT_PATH=/path/to/your/cert.pem
export SSL_KEY_PATH=/path/to/your/private.key

# 启动服务器
node dist/mcp-server/main.js
```

## 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `USE_HTTPS` | `false` | 是否启用 HTTPS |
| `PORT` | `3030` | HTTP 端口 |
| `HTTPS_PORT` | `3443` | HTTPS 端口 |
| `SSL_CERT_PATH` | `./certs/server.crt` | SSL 证书路径 |
| `SSL_KEY_PATH` | `./certs/server.key` | SSL 私钥路径 |

## 测试 HTTPS

### 健康检查
```bash
# HTTP
curl http://localhost:3030/health

# HTTPS (忽略证书验证)
curl -k https://localhost:3443/health
```

### MCP 客户端测试
```bash
# HTTPS MCP 初始化
RESPONSE=$(curl -k -si -X POST https://localhost:3443/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}')

SESSION_ID=$(echo "$RESPONSE" | grep -i "mcp-session-id" | cut -d' ' -f2 | tr -d '\r')

# 发送 initialized 通知
curl -k -si -X POST https://localhost:3443/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 调用工具
curl -k -si -X POST https://localhost:3443/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"ping"}}'
```

## 生产环境部署

### 1. 使用 Let's Encrypt 证书

```bash
# 安装 certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 设置环境变量
export USE_HTTPS=true
export SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
export SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem

# 启动服务器
node dist/mcp-server/main.js
```

### 2. 使用 Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/private.key;

    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY dist/mcp-server ./
COPY certs ./certs

ENV USE_HTTPS=true
ENV SSL_CERT_PATH=./certs/server.crt
ENV SSL_KEY_PATH=./certs/server.key

EXPOSE 3030 3443
CMD ["node", "main.js"]
```

## 安全建议

1. **生产环境使用正式证书**：不要在生产环境使用自签名证书
2. **证书定期更新**：设置自动续期
3. **防火墙配置**：只开放必要端口
4. **访问控制**：配置适当的访问权限

## 故障排除

### 常见问题

1. **证书文件不存在**
   ```
   Error: SSL certificate files not found
   ```
   解决：检查证书路径是否正确

2. **端口被占用**
   ```
   Error: listen EADDRINUSE
   ```
   解决：更改端口或停止占用端口的进程

3. **权限问题**
   ```
   Error: EACCES
   ```
   解决：检查文件权限，确保有读取权限

### 调试模式

```bash
# 启用详细日志
DEBUG=* node dist/mcp-server/main.js

# 检查证书
openssl x509 -in ./certs/server.crt -text -noout
```
