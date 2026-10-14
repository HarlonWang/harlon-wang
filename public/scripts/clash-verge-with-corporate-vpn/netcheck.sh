#!/usr/bin/env bash
# netcheck.sh —— Clash Verge（TUN）与公司 VPN 共存时的只读自检脚本（macOS）
# 配套文章：https://harlon.wang/posts/clash-verge-with-corporate-vpn/
#
# 只读：不修改任何配置，也不写任何文件。用法：
#   bash netcheck.sh
# 配置项会从 Clash Verge 的运行时配置自动推断，再在终端里逐项确认（直接回车采用 [] 中的值）。
# 也可以用环境变量直接指定，跳过询问：
#   CORP_SUFFIXES="corp.example.com corp.example.net" CORP_GIT_HOST=git.corp.example.com bash netcheck.sh
# 每一项输出 ✅ / ⚠️ / ❌，失败项后面标注了对应的文章章节。

# ===================== 配置区 =====================
# 留空则自动推断，并在终端里询问确认
CORP_SUFFIXES="${CORP_SUFFIXES:-}"        # 公司内网域名后缀，空格或逗号分隔
CORP_GIT_HOST="${CORP_GIT_HOST:-}"        # 内网 Git 服务（HTTPS + SSH 都会测）
PROXY_PORT="${PROXY_PORT:-}"              # Clash mixed-port
EXPECTED_EXIT_IP="${EXPECTED_EXIT_IP:-}"  # 你的节点出口 IP；留空则只打印不比对
CLASH_CONFIG="${CLASH_CONFIG:-$HOME/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/clash-verge.yaml}"  # Verge 运行时配置
# 用来探测「VPN 接管了哪些外网域名」的样本
PROBE_DOMAINS=(github.com ssh.github.com raw.githubusercontent.com docker.io repo1.maven.org registry.npmjs.org pypi.org google.com)
# ==================================================

PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
warn() { echo "  ⚠️  $*"; WARN=$((WARN+1)); }
bad()  { echo "  ❌ $*"; FAIL=$((FAIL+1)); }
sec()  { echo; echo "【$*】"; }
iface_of() { route -n get "$1" 2>/dev/null | awk '/interface:/{print $2}'; }
in_fake_range() { [[ "$1" =~ ^198\.1[89]\. ]]; }
resolve() { dscacheutil -q host -a name "$1" | awk '/ip_address/{print $2; exit}'; }

# 交互输入从 /dev/tty 读，这样 curl ... | bash 也能询问；没有终端时不询问，直接用默认值
HAS_TTY=0; (exec </dev/tty) 2>/dev/null && HAS_TTY=1
ask() {  # ask 提示 默认值 → 输出用户输入，直接回车则输出默认值
  local ans=""
  [ "$HAS_TTY" = 1 ] && read -r -p "  $1 [${2:-回车跳过}]: " ans </dev/tty
  echo "${ans:-$2}"
}
# 规范化后缀列表：逗号/空格分隔，去掉 +. *. . 前缀，转小写，去重
norm_suffixes() { echo "$1" | tr ',' ' ' | tr 'A-Z' 'a-z' | tr -s ' ' '\n' | sed -E 's/^(\+\.|\*\.|\.)//' | awk 'NF && !seen[$0]++' | xargs; }
# 从 Verge 运行时配置推断内网后缀：dns.nameserver-policy 里 DNS 指向私网 IP 的那些键
detect_suffixes() {
  [ -f "$CLASH_CONFIG" ] || return
  awk '
    function priv(s) { return s ~ /(^|[^0-9.])(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)[0-9]/ }
    /^[^ #]/ { indns = ($0 ~ /^dns:/); inpol = 0; next }
    !indns { next }
    /^  [^ #]/ { inpol = ($0 ~ /^  nameserver-policy:/); cur = ""; next }
    !inpol { next }
    /^    [^ #-]/ {
      line = $0; sub(/^ +/, "", line)
      if (!match(line, /:( |$)/)) next
      cur = substr(line, 1, RSTART - 1); gsub(/["\047]/, "", cur)
      if (!(cur in seen)) { seen[cur] = 1; keys[++n] = cur }
      if (priv(substr(line, RSTART + 1))) corp[cur] = 1
      next
    }
    cur != "" && priv($0) { corp[cur] = 1 }
    END {
      for (i = 1; i <= n; i++) if (keys[i] in corp) {
        m = split(keys[i], parts, ",")
        for (j = 1; j <= m; j++) { p = parts[j]; gsub(/ /, "", p); if (p !~ /:/) print p }
      }
    }' "$CLASH_CONFIG"
}
# Clash fake-ip 下任何域名都能「解析」出 28.x，所以兜底时只认私网 IP
is_private() { [[ "$1" =~ ^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.) ]]; }
# 推断内网 Git 主机：优先用 ~/.ssh/known_hosts 里连过的 *git*.内网后缀，其次尝试解析 git.* / gitlab.*
guess_git_host() {
  local s h
  for s in "${CORP_SUFFIXES[@]}"; do
    h=$(awk '{print $1}' ~/.ssh/known_hosts 2>/dev/null | tr ',' '\n' | sed -E 's/^\[([^]]+)\].*/\1/' | grep -iE "^[^.]*git[^.]*\.${s//./\\.}$" | head -1)
    [ -n "$h" ] && { echo "$h"; return; }
  done
  for h in git gitlab; do
    for s in "${CORP_SUFFIXES[@]}"; do is_private "$(resolve "$h.$s")" && { echo "$h.$s"; return; }; done
  done
}

# 读取 ~/.zshrc 中的代理变量，保证在非交互 shell 里也能测到终端的真实行为
[ -f ~/.zshrc ] && eval "$(grep -E '^export (https?_proxy|all_proxy|no_proxy|NO_PROXY|NODE_USE_ENV_PROXY)' ~/.zshrc 2>/dev/null)"

sec "0. 配置（自动推断，直接回车采用 [] 中的值）"
if [ -f "$CLASH_CONFIG" ]; then echo "  · 读取 Verge 运行时配置：$CLASH_CONFIG"
else echo "  · 没找到 Verge 运行时配置，需要手动输入（可用 CLASH_CONFIG=路径 指定）"; fi
if [ -z "$PROXY_PORT" ]; then
  [ -f "$CLASH_CONFIG" ] && PROXY_PORT=$(awk '/^mixed-port:/{print $2; exit}' "$CLASH_CONFIG")
  if [ -z "$PROXY_PORT" ] && [ -n "${https_proxy:-}" ]; then PROXY_PORT=${https_proxy##*:}; PROXY_PORT=${PROXY_PORT%%/*}; fi
  PROXY_PORT=${PROXY_PORT:-7897}
fi
if [ -z "$CORP_SUFFIXES" ]; then CORP_SUFFIXES=$(ask "内网域名后缀（空格分隔）" "$(norm_suffixes "$(detect_suffixes)")"); fi
CORP_SUFFIXES=($(norm_suffixes "$CORP_SUFFIXES"))
if [ ${#CORP_SUFFIXES[@]} -eq 0 ]; then
  echo "  ❌ 无法确定内网域名后缀。请在终端里运行，或用环境变量指定："
  echo "     CORP_SUFFIXES=\"corp.example.com corp.example.net\" bash netcheck.sh"
  exit 2
fi
if [ -z "$CORP_GIT_HOST" ]; then CORP_GIT_HOST=$(ask "内网 Git 主机" "$(guess_git_host)"); fi
[ -z "$EXPECTED_EXIT_IP" ] && EXPECTED_EXIT_IP=$(ask "节点出口 IP（可选，用于比对）" "")
echo "  · 内网后缀：${CORP_SUFFIXES[*]}    内网 Git：${CORP_GIT_HOST:-未指定}    代理端口：$PROXY_PORT    出口 IP：${EXPECTED_EXIT_IP:-不比对}"

sec "1. Clash 是否在工作（阶段二）"
if nc -z -G 2 127.0.0.1 "$PROXY_PORT" 2>/dev/null; then ok "代理端口 127.0.0.1:$PROXY_PORT 在监听"; else bad "代理端口 $PROXY_PORT 没有监听：Clash Verge 没开？"; fi
CLASH_IF=$(iface_of 1.1.1.1)
if [[ "$CLASH_IF" == utun* ]]; then ok "TUN 已开启，Clash 网卡是 $CLASH_IF"; else warn "1.1.1.1 走的是 ${CLASH_IF}，TUN 可能没开（不开 TUN 时第 3、6 项结论不适用）"; fi

sec "2. 公司 VPN 与 fake-ip 冲突（阶段二）"
VPN_DNS=$(scutil --dns | awk '/nameserver\[0\]/{print $3; exit}')
VPN_IF=$(iface_of "$VPN_DNS")
echo "  · 系统首选 DNS：${VPN_DNS}（经 ${VPN_IF}）"
CLASH_FAKE=$(dig +short +time=2 +tries=1 netcheck-probe.example.org @114.114.114.114 2>/dev/null | tail -1)
if [ -z "$CLASH_FAKE" ]; then
  warn "拿不到 Clash 的 fake-ip（DNS 劫持没生效？）"
else
  FAKE_IF=$(iface_of "$CLASH_FAKE")
  if [ "$FAKE_IF" = "$CLASH_IF" ]; then ok "Clash fake-ip $CLASH_FAKE 经 $FAKE_IF 回到 Clash"
  else bad "Clash fake-ip $CLASH_FAKE 被路由到 ${FAKE_IF}（不是 Clash）：fake-ip 段与 VPN 冲突，改 fake-ip-range"; fi
fi
VPN_FAKE_ROUTES=$(netstat -rn -f inet | awk '$1 ~ /^198\.1[89]/ && $NF !~ /^'"$CLASH_IF"'$/ {print $1"→"$NF}' | xargs)
[ -n "$VPN_FAKE_ROUTES" ] && echo "  · VPN 占用的 198.18/15 路由：$VPN_FAKE_ROUTES"

sec "3. 内网访问（阶段三、四）"
for s in "${CORP_SUFFIXES[@]}"; do
  scutil --proxy | grep -q "\*\.$s" && ok "系统代理绕过包含 *.$s" || bad "系统代理绕过缺少 *.$s"
  [[ ",${no_proxy:-}," == *",.$s,"* ]] && ok "终端 no_proxy 包含 .$s" || bad "终端 no_proxy 缺少 .$s"
done
if [ -z "$CORP_GIT_HOST" ]; then
  warn "未指定内网 Git 主机，跳过解析、HTTPS 和 SSH 测试"
else
  CORP_IP=$(resolve "$CORP_GIT_HOST")
  if [ -n "$CORP_IP" ]; then ok "$CORP_GIT_HOST 解析为 ${CORP_IP}（出口网卡 $(iface_of "$CORP_IP")）"; else bad "$CORP_GIT_HOST 解析失败：检查 nameserver-policy"; fi
  code=$(curl -s -o /dev/null -m 8 -w '%{http_code}' "https://$CORP_GIT_HOST" 2>/dev/null)
  [[ "$code" =~ ^[23] ]] && ok "HTTPS $CORP_GIT_HOST → $code" || bad "HTTPS $CORP_GIT_HOST → ${code:-超时}"
  out=$(ssh -o BatchMode=yes -o ConnectTimeout=8 -T "git@$CORP_GIT_HOST" 2>&1 </dev/null | head -1)
  [[ "$out" =~ Welcome|successfully ]] && ok "SSH ${CORP_GIT_HOST}：$out" || bad "SSH ${CORP_GIT_HOST}：$out"
fi

sec "4. 外网出口（阶段三）"
via_proxy=$(curl -s -m 8 https://api.ipify.org 2>/dev/null)
if [ -z "$via_proxy" ]; then bad "走代理访问外网失败"
elif [ -n "$EXPECTED_EXIT_IP" ] && [ "$via_proxy" != "$EXPECTED_EXIT_IP" ]; then bad "走代理的出口是 ${via_proxy}，不是预期的 $EXPECTED_EXIT_IP"
else ok "走代理的出口：$via_proxy"; fi

sec "5. VPN 接管的外网域名（阶段五）"
taken=()
for d in "${PROBE_DOMAINS[@]}"; do
  ip=$(dscacheutil -q host -a name "$d" | awk '/ip_address/{print $2; exit}')
  if in_fake_range "$ip" && [ "$(iface_of "$ip")" != "$CLASH_IF" ]; then taken+=("$d"); fi
done
if [ ${#taken[@]} -eq 0 ]; then ok "样本域名都没有被 VPN 接管"
else warn "被 VPN 接管（不走代理的程序会经公司出口）：${taken[*]}"; fi

sec "6. 不走代理的工具（阶段五）"
if grep -A6 -E '^Host .*github\.com' ~/.ssh/config 2>/dev/null | grep -q ProxyCommand; then
  out=$(ssh -o BatchMode=yes -o ConnectTimeout=10 -T git@github.com 2>&1 </dev/null | head -1)
  [[ "$out" == *successfully* ]] && ok "SSH github.com 经代理：认证成功" || bad "SSH github.com：$out"
else
  warn "~/.ssh/config 的 github.com 没有 ProxyCommand：SSH 访问 GitHub 不走节点"
fi
if [ -f ~/.gradle/gradle.properties ]; then
  if grep -q 'proxyHost' ~/.gradle/gradle.properties; then
    missing=()
    for s in "${CORP_SUFFIXES[@]}"; do
      grep -qE "nonProxyHosts=.*${s//./\\.}" ~/.gradle/gradle.properties || missing+=("$s")
    done
    [ ${#missing[@]} -eq 0 ] && ok "Gradle 已配代理和内网例外" || bad "Gradle 配了代理，但 nonProxyHosts 缺少：${missing[*]}"
  else warn "Gradle 没配代理"; fi
fi
if command -v node >/dev/null; then
  [ "${NODE_USE_ENV_PROXY:-}" = "1" ] && ok "Node 已开启 NODE_USE_ENV_PROXY" || warn "Node 未开启 NODE_USE_ENV_PROXY：原生 fetch 不读代理变量"
fi

echo
echo "结果：✅ $PASS   ⚠️  $WARN   ❌ $FAIL"
if [ "$HAS_TTY" = 1 ]; then
  echo
  echo "下次跳过询问，可直接运行："
  echo "  CORP_SUFFIXES=\"${CORP_SUFFIXES[*]}\"${CORP_GIT_HOST:+ CORP_GIT_HOST=$CORP_GIT_HOST}${EXPECTED_EXIT_IP:+ EXPECTED_EXIT_IP=$EXPECTED_EXIT_IP} bash netcheck.sh"
fi
[ "$FAIL" -eq 0 ]
