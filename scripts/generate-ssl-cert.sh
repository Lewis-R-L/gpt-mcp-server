#!/bin/bash

# SSL 证书生成脚本
# 用于生成自签名证书用于开发环境

CERT_DIR="./certs"
CERT_FILE="$CERT_DIR/server.crt"
KEY_FILE="$CERT_DIR/server.key"

echo "生成 SSL 证书..."

# 创建证书目录
mkdir -p $CERT_DIR

# 生成私钥和证书
openssl req -x509 -newkey rsa:4096 -keyout $KEY_FILE -out $CERT_FILE -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"

echo "SSL 证书已生成："
echo "  证书文件: $CERT_FILE"
echo "  私钥文件: $KEY_FILE"
echo ""
echo "使用方法："
echo "  USE_HTTPS=true node dist/mcp-server/main.js"
echo ""
echo "注意：这是自签名证书，浏览器会显示安全警告。"
echo "生产环境请使用正式的 SSL 证书。"
