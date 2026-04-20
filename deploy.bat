@echo off
REM Windows部署脚本 - 部署到腾讯云服务器

REM 配置变量
set SERVER_IP=your-server-ip
set SERVER_USER=root
set SERVER_PATH=/var/www/tech-service-knowledge-graph
set LOCAL_DIST=.\dist

echo 开始部署到腾讯云服务器...

REM 检查本地dist目录是否存在
if not exist "%LOCAL_DIST%" (
    echo 错误: dist目录不存在，请先运行 npm run build
    exit /b 1
)

REM 创建服务器目录
echo 创建服务器目录...
plink -ssh %SERVER_USER%@%SERVER_IP% "mkdir -p %SERVER_PATH%"

REM 上传文件到服务器
echo 上传文件到服务器...
pscp -r %LOCAL_DIST%\* %SERVER_USER%@%SERVER_IP%:%SERVER_PATH%/

REM 设置文件权限
echo 设置文件权限...
plink -ssh %SERVER_USER%@%SERVER_IP% "chown -R www-data:www-data %SERVER_PATH% ^&^& chmod -R 755 %SERVER_PATH%"

REM 重启Nginx
echo 重启Nginx服务...
plink -ssh %SERVER_USER%@%SERVER_IP% "systemctl reload nginx"

echo 部署完成！
echo 请访问 http://%SERVER_IP% 或您的域名查看应用
