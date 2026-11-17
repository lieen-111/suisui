#!/usr/bin/env bash
# 碎碎清单 · 一键安装到云服务器（Ubuntu 22.04 / 24.04 / Debian 12）
#
# 用法（在服务器上以 root 执行，域名换成你自己的；不填域名就用服务器 IP 自动生成一个）：
#   curl -fsSL https://raw.githubusercontent.com/lieen-111/suisui/premium/server/deploy/install.sh | sudo bash -s -- 你的域名
#
# 装好后同一个地址提供两样东西：
#   https://域名/          碎碎清单网页版（替代 Netlify）
#   https://域名/admin/    Pro 管理后台
# 再次执行同一条命令 = 更新到最新代码，数据不受影响。
set -euo pipefail

REPO=https://github.com/lieen-111/suisui.git
BRANCH=${SUISUI_BRANCH:-premium}
CODE=/opt/suisui
DATA=/opt/suisui-data

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "请用 root 执行：在命令前加 sudo。"
command -v apt-get >/dev/null || die "这个脚本只支持 Ubuntu / Debian 系统，重装系统时请选 Ubuntu 24.04。"

say "1/5 安装基础工具"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https >/dev/null

IP=$(curl -fsS4 --max-time 10 https://api.ipify.org || curl -fsS4 --max-time 10 https://ifconfig.me || true)
DOMAIN=${1:-}
if [ -z "$DOMAIN" ]; then
  [ -n "$IP" ] || die "查不到这台服务器的公网 IP，请在命令最后写上你的域名再试。"
  DOMAIN="suisui-${IP//./-}.sslip.io"
  echo "没有填域名，先用自动地址：$DOMAIN（以后换成自己的域名，带上域名再执行一次即可）"
else
  RESOLVED=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
  if [ -n "$IP" ] && [ "$RESOLVED" != "$IP" ]; then
    echo "注意：$DOMAIN 现在指向「${RESOLVED:-还没有解析}」，这台服务器是 $IP。"
    echo "请到买域名的平台添加 A 记录指向 $IP。解析生效前 HTTPS 证书申请不下来，生效后会自动补上。"
  fi
fi

say "2/5 安装 Node.js 22"
NODE_OK=0
if command -v node >/dev/null; then
  node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" && NODE_OK=1 || true
fi
if [ "$NODE_OK" = 0 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

say "3/5 下载碎碎清单代码"
if [ -d "$CODE/.git" ]; then
  git -C "$CODE" fetch -q origin "$BRANCH"
  git -C "$CODE" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  rm -rf "$CODE"
  git clone -q --depth 1 -b "$BRANCH" "$REPO" "$CODE"
fi
id suisui >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin suisui
mkdir -p "$DATA" && chown -R suisui "$DATA" && chmod 700 "$DATA"

say "4/5 启动后台（开机自启，崩溃自动重启）"
cp "$CODE/server/deploy/suisui-pro.service" /etc/systemd/system/suisui-pro.service
systemctl daemon-reload
systemctl enable -q suisui-pro
systemctl restart suisui-pro

say "5/5 配置 HTTPS（Caddy 自动申请和续期证书）"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
sed "s/pay.example.com/$DOMAIN/" "$CODE/server/deploy/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable -q caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80,443/tcp >/dev/null; fi

sleep 3
TOKEN=$(journalctl -u suisui-pro --no-pager -n 200 | grep -o '设置口令是 *[A-Za-z0-9_-]*' | tail -1 | awk '{print $NF}' || true)
systemctl is-active -q suisui-pro || die "后台没有启动成功，执行 journalctl -u suisui-pro -n 50 查看原因。"

say "安装完成"
echo "网页版：   https://$DOMAIN/"
echo "管理后台： https://$DOMAIN/admin/"
if [ -n "$TOKEN" ]; then
  echo "设置口令： $TOKEN   （第一次打开后台时填，用一次就失效）"
else
  echo "后台已经设置过密码，直接登录即可。"
fi
echo
echo "打不开的话：到云服务器控制台的「防火墙 / 安全组」放行 80 和 443 端口。"
echo "数据在 $DATA，后台每天自动备份；以后更新只要再执行一次这条安装命令。"
