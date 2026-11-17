@echo off
chcp 65001 >nul
rem 碎碎清单 Pro 管理后台 · 在这台电脑上运行（正式上线请部署到云服务器，见 README.md）
setlocal
cd /d "%~dp0"
set "NODE_NO_WARNINGS=1"
set "NODE="
rem 需要 Node.js 22.13 或更新：先用项目自带的，版本不够就用电脑上安装的
if exist "..\runtime\windows-x64\node.exe" (
  "..\runtime\windows-x64\node.exe" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" && set "NODE=..\runtime\windows-x64\node.exe"
)
if not defined NODE (
  where node >nul 2>nul && node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" && set "NODE=node"
)
if not defined NODE (
  echo 需要 Node.js 22.13 或更新版本。
  echo 请到 https://nodejs.org 下载安装 LTS 版本，装好后再双击本文件。
  pause
  exit /b 1
)
echo 后台启动后，这个窗口不要关；关掉窗口后台就停了。
echo 电脑上打开： http://localhost:8787/admin/
echo 同一个 Wi-Fi 下的手机打开： http://这台电脑的IP:8787/admin/  （IP 用 ipconfig 查看 IPv4 地址）
echo.
"%NODE%" index.mjs
pause
