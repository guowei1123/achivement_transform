# 腾讯云服务器部署指南

本文档详细说明如何将科技服务知识图谱系统部署到腾讯云服务器。

## 前置要求

### 1. 腾讯云服务器准备
- 已购买腾讯云服务器（CVM）
- 操作系统：Ubuntu 20.04 或 CentOS 7/8
- 服务器配置建议：2核4G及以上
- 已配置安全组，开放80端口

### 2. 本地环境准备
- Node.js 16+ 和 npm
- Git（可选）
- SSH客户端（Windows用户推荐PuTTY或Git Bash）

### 3. 域名准备（可选）
- 已购买域名
- 已将域名解析到服务器IP地址

## 服务器环境配置

### 1. 安装Nginx

#### Ubuntu/Debian系统
```bash
# 更新包管理器
sudo apt update

# 安装Nginx
sudo apt install nginx -y

# 启动Nginx服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx

# 检查Nginx状态
sudo systemctl status nginx
```

#### CentOS/RHEL系统
```bash
# 安装EPEL仓库
sudo yum install epel-release -y

# 安装Nginx
sudo yum install nginx -y

# 启动Nginx服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx

# 检查Nginx状态
sudo systemctl status nginx
```

### 2. 配置防火墙

#### Ubuntu (UFW)
```bash
# 允许HTTP流量
sudo ufw allow 'Nginx HTTP'

# 允许SSH流量
sudo ufw allow 'OpenSSH'

# 启用防火墙
sudo ufw enable
```

#### CentOS (firewalld)
```bash
# 添加HTTP服务
sudo firewall-cmd --permanent --add-service=http

# 重载防火墙
sudo firewall-cmd --reload
```

### 3. 创建网站目录
```bash
# 创建网站根目录
sudo mkdir -p /var/www/tech-service-knowledge-graph

# 设置目录权限
sudo chown -R www-data:www-data /var/www/tech-service-knowledge-graph
sudo chmod -R 755 /var/www/tech-service-knowledge-graph
```

## 部署步骤

### 方法一：使用部署脚本（推荐）

#### Windows用户
1. 修改 `deploy.bat` 文件中的配置变量：
   ```batch
   set SERVER_IP=your-server-ip
   set SERVER_USER=root
   ```

2. 安装PuTTY工具：
   - 下载PuTTY：https://www.putty.org/
   - 将 `plink.exe` 和 `pscp.exe` 放到系统PATH中

3. 运行部署脚本：
   ```batch
   deploy.bat
   ```

#### Linux/Mac用户
1. 修改 `deploy.sh` 文件中的配置变量：
   ```bash
   SERVER_IP="your-server-ip"
   SERVER_USER="root"
   ```

2. 添加执行权限：
   ```bash
   chmod +x deploy.sh
   ```

3. 运行部署脚本：
   ```bash
   ./deploy.sh
   ```

### 方法二：手动部署

#### 1. 本地构建
```bash
# 安装依赖
npm install

# 构建生产版本
npm run build
```

#### 2. 上传文件到服务器

使用SCP上传：
```bash
scp -r dist/* root@your-server-ip:/var/www/tech-service-knowledge-graph/
```

使用SFTP上传：
```bash
sftp root@your-server-ip
put -r dist/* /var/www/tech-service-knowledge-graph/
exit
```

#### 3. 配置Nginx

将 `nginx.conf` 文件上传到服务器：
```bash
scp nginx.conf root@your-server-ip:/etc/nginx/sites-available/tech-service-knowledge-graph
```

创建软链接：
```bash
sudo ln -s /etc/nginx/sites-available/tech-service-knowledge-graph /etc/nginx/sites-enabled/
```

删除默认配置（可选）：
```bash
sudo rm /etc/nginx/sites-enabled/default
```

#### 4. 测试并重启Nginx
```bash
# 测试Nginx配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

## 配置HTTPS（可选）

### 使用Let's Encrypt免费证书

#### 1. 安装Certbot
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

#### 2. 获取SSL证书
```bash
sudo certbot --nginx -d your-domain.com
```

#### 3. 自动续期
```bash
# 测试自动续期
sudo certbot renew --dry-run

# Certbot会自动设置定时任务进行续期
```

## 验证部署

### 1. 检查服务状态
```bash
# 检查Nginx状态
sudo systemctl status nginx

# 查看Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. 访问网站
- 通过浏览器访问：`http://your-server-ip` 或 `http://your-domain.com`
- 如果配置了HTTPS：`https://your-domain.com`

### 3. 检查文件权限
```bash
ls -la /var/www/tech-service-knowledge-graph
```

## 常见问题排查

### 1. 403 Forbidden错误
```bash
# 检查文件权限
sudo chmod -R 755 /var/www/tech-service-knowledge-graph
sudo chown -R www-data:www-data /var/www/tech-service-knowledge-graph
```

### 2. 502 Bad Gateway错误
```bash
# 检查Nginx配置
sudo nginx -t

# 检查Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

### 3. 页面空白或资源加载失败
```bash
# 检查文件是否完整上传
ls -la /var/www/tech-service-knowledge-graph

# 检查Nginx配置中的root路径是否正确
sudo cat /etc/nginx/sites-available/tech-service-knowledge-graph
```

### 4. 无法访问网站
```bash
# 检查防火墙状态
sudo ufw status  # Ubuntu
sudo firewall-cmd --list-all  # CentOS

# 检查安全组配置（腾讯云控制台）
# 确保已开放80和443端口
```

## 性能优化

### 1. 启用Gzip压缩
Nginx配置文件中已包含Gzip配置，确保以下设置：
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
```

### 2. 设置静态资源缓存
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 启用HTTP/2
在Nginx配置中添加：
```nginx
listen 443 ssl http2;
```

## 监控与维护

### 1. 日志监控
```bash
# 实时查看访问日志
sudo tail -f /var/log/nginx/access.log

# 实时查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 2. 定期备份
```bash
# 创建备份脚本
#!/bin/bash
BACKUP_DIR="/var/backups/tech-service-knowledge-graph"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz /var/www/tech-service-knowledge-graph
```

### 3. 更新部署
当需要更新网站时：
```bash
# 本地重新构建
npm run build

# 上传新文件
scp -r dist/* root@your-server-ip:/var/www/tech-service-knowledge-graph/

# 清除浏览器缓存或更新版本号
```

## 安全建议

1. **使用SSH密钥认证**：禁用密码登录，使用SSH密钥
2. **配置防火墙**：只开放必要的端口
3. **定期更新系统**：保持系统和软件包最新
4. **配置HTTPS**：使用SSL证书加密传输
5. **限制访问**：根据需要限制特定IP访问
6. **定期备份**：建立定期备份机制

## 联系支持

如遇到部署问题，请检查：
1. 服务器日志：`/var/log/nginx/error.log`
2. 系统日志：`/var/log/syslog` 或 `/var/log/messages`
3. 浏览器控制台错误信息

---

部署完成后，您的科技服务知识图谱系统将可以通过公网IP或域名访问。
