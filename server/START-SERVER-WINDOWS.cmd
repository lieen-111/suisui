@echo off
rem 在自己的电脑上试运行后台（只能本机访问；正式使用请部署到云服务器，见 README.md）
setlocal
cd /d "%~dp0"
set "NODE_NO_WARNINGS=1"
if exist "..\runtime\windows-x64\node.exe" (
  "..\runtime\windows-x64\node.exe" index.mjs
) else (
  node index.mjs
)
pause
