# 快速部署指南

## 一键部署步骤

### 1. 准备服务器信息
- 腾讯云服务器IP地址
- 服务器登录用户名（通常是root）
- 服务器SSH密码或密钥

### 2. 修改部署脚本

**Windows用户：** 编辑 `deploy.bat`
```batch
set SERVER_IP=123.456.789.0
set SERVER_USER=root
```

**Linux/Mac用户：** 编辑 `deploy.sh`
```bash
SERVER_IP="123.456.789.0"
SERVER_USER="root"
```

### 3. 执行部署

**Windows：**
```batch
deploy.bat
```

**Linux/Mac：**
```bash
chmod +x deploy.sh
./deploy.sh
```

### 4. 访问网站
部署完成后，在浏览器中访问：
- `http://your-server-ip`
- 或 `http://your-domain.com`

## 服务器环境准备（首次部署）

### 安装Nginx

**Ubuntu/Debian：**
```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

**CentOS/RHEL：**
```bash
sudo yum install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 创建网站目录
```bash
sudo mkdir -p /var/www/tech-service-knowledge-graph
sudo chown -R www-data:www-data /var/www/tech-service-knowledge-graph
sudo chmod -R 755 /var/www/tech-service-knowledge-graph
```

### 配置Nginx
```bash
# 上传nginx.conf到服务器
scp nginx.conf root@your-server-ip:/etc/nginx/sites-available/tech-service-knowledge-graph

# 创建软链接
sudo ln -s /etc/nginx/sites-available/tech-service-knowledge-graph /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

## 本地构建

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build
```

## 手动上传（不使用脚本）

```bash
# 使用SCP上传
scp -r dist/* root@your-server-ip:/var/www/tech-service-knowledge-graph/

# 设置权限
ssh root@your-server-ip "chown -R www-data:www-data /var/www/tech-service-knowledge-graph"

# 重启Nginx
ssh root@your-server-ip "systemctl reload nginx"
```

## 验证部署

1. 检查Nginx状态：
```bash
sudo systemctl status nginx
```

2. 查看访问日志：
```bash
sudo tail -f /var/log/nginx/access.log
```

3. 在浏览器中访问您的网站

## 常见问题

### 403 Forbidden
```bash
sudo chmod -R 755 /var/www/tech-service-knowledge-graph
sudo chown -R www-data:www-data /var/www/tech-service-knowledge-graph
```

### 502 Bad Gateway
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 无法访问
- 检查防火墙设置
- 检查腾讯云安全组配置（确保开放80端口）
- 检查Nginx是否正常运行

## 更新部署

当需要更新网站时：

1. 本地重新构建：
```bash
npm run build
```

2. 重新上传：
```bash
# 使用脚本
deploy.bat  # Windows
./deploy.sh  # Linux/Mac

# 或手动上传
scp -r dist/* root@your-server-ip:/var/www/tech-service-knowledge-graph/
```

## 配置HTTPS（可选）

使用Let's Encrypt免费证书：

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y  # Ubuntu
sudo yum install certbot python3-certbot-nginx -y  # CentOS

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

详细部署文档请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)
