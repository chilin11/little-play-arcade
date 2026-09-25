# 玩一会儿 · 小游戏聚合网站

轻量、可直接部署的小游戏网站。原生 HTML / CSS / JavaScript，**没有后端、数据库或构建步骤，生产运行不需要 Node.js**。

目前收录：
- **五子棋**：人机对战、本地双人、悔棋。
- **喵喵星际队**：三轨射击、10 个关卡、Boss、手机触屏操作。
- **2048**：滑动合并、单步撤销、自动续局、最高分，合成 2048 后可以继续挑战。
- **扫雷**：9 × 9 / 12 × 12 两档随机棋盘、首次翻开周围安全、触屏插旗、分难度最快纪录。
- **国际象棋**：本地双人、合法走子、将军与将死、王车易位、吃过路兵、升变、常见和棋与悔棋。
- **森林邮差**：面向 5～8 岁儿童的无数字路径益智游戏，6 个短关卡、提示、重画与关卡解锁。
- **花园翻翻乐**：儿童记忆配对，6 / 8 / 10 对三档花园、键盘与触屏操作、分难度最好步数。
- **星星接接乐**：45 秒温和反应收集，三片大云朵、连击、渐进速度、暂停与最高分。
 - **魔法衣橱**：面向 5～8 岁儿童的真实 SVG 分层换装，4 位森林朋友与上衣、下装、连衣裙、鞋子、帽子、颈饰、配饰七类衣物（8 / 8 / 6 / 6 / 6 / 6 / 8，含“无”选项），12 张不重复愿望订单，以及隔离的自由模式随机整套、重置、收藏与完整作品册。

前两款游戏从 `Documents/five` 与 `Documents/simple shoot game` 复制而来，原文件夹未修改。站内副本移除了远程 Google 字体，并对射击游戏增加窄屏适配；后续修改源游戏后，需要将变更同步到本项目副本。

## 已有功能

- 响应式游戏大厅、分类（从配置自动生成）、关键词搜索、推荐 / 上架时间 / 名称排序。
- 随机游戏、收藏、最近玩过与清空记录。
- 独立分享链接，例如 `/play.html?game=gomoku`。
- 按需加载的 iframe 游玩页：全屏、独立打开、带确认的重载、操作说明。
- 本地 SVG 封面和图标，无 CDN、远程字体或分析追踪请求。
- 404 页面、安全响应头、静态文件压缩。
- Docker + Caddy 自动 HTTPS，以及可选的 Nginx 配置。

收藏、最近游玩、射击与 2048 最高分、扫雷分难度最快纪录、森林邮差关卡解锁、花园翻翻乐分难度最好步数、星星接接乐最高分、魔法衣橱的订单贴纸与完整 symbol ID 作品收藏使用当前浏览器 localStorage；不跨浏览器 / 设备同步。魔法衣橱没有倒计时、生命或失败惩罚，禁用存储时仍能玩并会明确提示，收藏仅在当前页临时保留。2048 自动保存当前棋盘供下次继续，其他游戏不保存进行中的对局。五子棋和国际象棋的双人模式都是**同一设备对弈，不是在线联机**。

## 1. 本地预览

在终端运行（Node.js 20+）：

```sh
cd "$HOME/Documents/game website"
PORT=5180 npm run dev
```

打开 **http://127.0.0.1:5180**。无需先 `npm install`。

默认端口为 5180，显式设置 PORT 可以避免当前终端的环境变量影响。Ctrl+C 停止。若想用同一 Wi-Fi 的手机查看：

```sh
HOST=0.0.0.0 PORT=5180 npm run dev
```

手机访问 `http://电脑的局域网IP:5180`；仅在信任的局域网临时使用。开发服务器不用于公网生产部署。

没有 Node.js 也可以：

```sh
cd "$HOME/Documents/game website/public"
python3 -m http.server 5180 --bind 127.0.0.1
```

**不要直接双击 index.html**：大厅通过 fetch 读取 `games.json`，需要 HTTP 服务器。Python 预览不包含生产安全响应头。

## 2. VPS 部署（推荐：Docker + Caddy）

适用于 Linux VPS。先安装 Docker Engine、Docker Compose 插件、Git 和 GitHub CLI（`gh`），并确认：

```sh
docker --version
docker compose version
git --version
gh --version
```

### 首次部署（私有 GitHub 仓库）

仓库地址：`https://github.com/chilin11/little-play-arcade`。在 VPS 上登录拥有该私有仓库访问权限的 GitHub 账号，按 CLI 提示完成一次授权，然后克隆：

```sh
gh auth login
gh auth setup-git
gh repo clone chilin11/little-play-arcade ~/little-play
cd ~/little-play
cp .env.example .env
```

不要把 GitHub 密码或访问令牌写进命令、URL 或项目文件。`~/little-play/.env` 只保留在 VPS（已被 Git 忽略）。当前用户需有 Docker 权限，否则在 VPS 上的 Docker 命令前使用 `sudo`。

### 配置域名

1. 将 `games.example.com` 的 **A 记录**指向 VPS 公网 IPv4。
2. 只有 VPS 的 IPv6 正确可达时才设置 AAAA，错误的 AAAA 会影响访问与证书申请。
3. 在云厂商安全组与系统防火墙中放行 TCP **80、443**。UDP 443 可选，用于 HTTP/3。
4. 保留 SSH 端口放行，**不要为了部署而重置防火墙**。
5. 确保 VPS 的 80 / 443 没有被已有 Nginx、Apache、Caddy 或容器占用。已有站点请用下方 Nginx 方案，或接到现有反向代理，不要直接停止别人的服务。

编辑 VPS 上的配置文件：

```sh
cd ~/little-play
nano .env
```

将 `.env` 设为（换成自己的域名）：

```dotenv
SITE_ADDRESS=games.example.com
```

Caddy 自动申请与续期 HTTPS 证书。无域名时可先使用 `SITE_ADDRESS=:80`，通过 `http://VPS_IP` 测试；这种模式不会提供 HTTPS。

### 启动与检查

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 web
```

访问 `https://games.example.com`，确认：
- 首页游戏列表可加载，游玩页能正常启动。
- 收藏在刷新后保留。
- `/not-found` 返回 404，`/.env`、`/package.json` 不可读取。
- 浏览器没有混合内容、CSP 或资源加载错误。

```sh
curl -I https://games.example.com
curl -I https://games.example.com/not-found
```

镜像仅复制 `public/` 和 Caddy 配置，不会公开项目源配置与测试文件。证书保存在 Docker 命名卷中；**不要使用 `docker compose down -v`**，以免删除证书数据。

### 更新、停止与备份

本地修改推送到 GitHub 后，在 VPS 上执行：

```sh
cd ~/little-play
git pull --ff-only
docker compose up -d --build
```

页面和资源采用 `Cache-Control: no-cache`，浏览器会重新验证，不用手动清缓存。没有数据库迁移。

停止：`docker compose down`（保留命名卷）。备份项目代码、VPS 的 `.env` 和 Caddy 的 `caddy_data` 卷；玩家本地收藏不会上传至服务器。

## 3. 小 VPS 部署（Nginx 静态托管，无 Docker / Node.js）

适用于 Ubuntu / Debian。VPS 只运行 Nginx，不构建镜像、不安装 Node.js；用本机的 `rsync` 通过 SSH 上传 `public/`，无需在 VPS 上登录私有 GitHub 仓库。此方案和上面的 Docker + Caddy **二选一**，不要同时占用 80 / 443 端口。

### 首次准备（在 VPS 上执行一次）

先登录 VPS 安装 Nginx 和 rsync（精简系统通常未预装 rsync）：

```sh
ssh YOUR_USER@YOUR_VPS_IP
sudo apt update
sudo apt install nginx rsync
exit
```

### 首次上传（在本机执行）

将下列 `YOUR_USER@YOUR_VPS_IP` 替换为你的 SSH 登录地址；本机在项目根目录运行：

```sh
ssh YOUR_USER@YOUR_VPS_IP 'mkdir -p ~/little-play/public'
rsync -av --delete public/ YOUR_USER@YOUR_VPS_IP:~/little-play/public/
scp deploy/nginx.conf YOUR_USER@YOUR_VPS_IP:~/little-play/nginx.conf
```

`public/` 末尾的斜杠很重要：网站根目录必须直接包含 `index.html`。不要把整个仓库、`.env` 或测试文件放入网站根目录。

### 配置并启动（在 VPS 上执行）

```sh
ssh YOUR_USER@YOUR_VPS_IP
sudo mkdir -p /var/www/little-play
sudo rsync -a --delete ~/little-play/public/ /var/www/little-play/
nano ~/little-play/nginx.conf
```

把配置中的 `server_name games.example.com;` 改成自己的域名；**仅用 IP 测试**可改成 `server_name _;`。有域名时先将 A 记录指向 VPS 公网 IP（仅在 IPv6 确实可用时设置 AAAA）。确保云安全组和防火墙放行 TCP 80；申请 HTTPS 还需放行 TCP 443，同时保留 SSH 端口。若 VPS 上已有站点或 80 / 443 被占用，不要覆盖其配置或停止其他服务，先检查现有反向代理方案。

```sh
sudo install -m 644 ~/little-play/nginx.conf /etc/nginx/sites-available/little-play
sudo ln -s /etc/nginx/sites-available/little-play /etc/nginx/sites-enabled/little-play
sudo nginx -t && sudo systemctl reload nginx
curl -I http://127.0.0.1
```

新装 Nginx 如果用 IP 访问仍显示默认欢迎页，且这台 VPS 没有其他网站，可移除默认站点链接后检查并重载：`sudo rm /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx`。有域名时用 `http://你的域名` 检查首页；访问不存在的路径应返回 404。不要删除已有业务站点。

### 域名 HTTPS（可选）

域名解析与 80 / 443 放行后，在 Ubuntu / Debian 的 VPS 上执行（仅用 IP 测试可跳过）：

```sh
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d games.example.com
sudo certbot renew --dry-run
```

替换为实际域名，随后访问 `https://你的域名`。Certbot 只在申请或续期时运行；极低内存的 VPS 若安装或签发失败，可先只用 HTTP 测试，正式公网使用再配置 HTTPS。

### 后续更新

本机在项目根目录上传更新：

```sh
rsync -av --delete public/ YOUR_USER@YOUR_VPS_IP:~/little-play/public/
ssh YOUR_USER@YOUR_VPS_IP 'sudo rsync -a --delete ~/little-play/public/ /var/www/little-play/'
```

只更新静态文件无需重启 Nginx。`--delete` 只作用于这两个专用目录，不要将其他文件放进去。若修改了 `deploy/nginx.conf`，还需重新上传、安装并运行 `sudo nginx -t && sudo systemctl reload nginx`。页面采用 `Cache-Control: no-cache`，浏览器会重新验证。若使用 1Panel / 宝塔，亦可创建静态网站并把网站根目录指向 `public/` 的上传位置，在面板申请 SSL；游玩页需要同源 iframe，**不要设置 `X-Frame-Options: DENY`**。

## 4. 后续添加游戏

无需修改大厅或游玩页代码。

### A. 放游戏文件

```text
public/games/snake/
├── index.html
├── style.css
└── game.js
```

游戏内部使用相对路径，例如 `src="game.js"`、`href="style.css"`，避免写成 `/game.js`。

### B. 放封面

例如：`public/assets/snake.svg`（或 PNG / WebP / JPG），建议宽高比约 **12:7**。

### C. 修改 `public/games.json`

往数组添加以下对象，注意对象之间需要逗号，JSON 不支持注释：

```json
{
  "id": "snake",
  "title": "贪吃蛇",
  "subtitle": "A LITTLE HUNGRY",
  "description": "吃一点，长一点，看看你能坚持多久。",
  "category": "休闲街机",
  "tags": ["经典", "反应", "单人"],
  "devices": ["电脑"],
  "controls": "方向键控制移动，避免撞到墙和自己。",
  "note": "刷新或离开页面会重置本局。",
  "entry": "games/snake/index.html",
  "cover": "assets/snake.svg",
  "color": "sage",
  "badge": "新游上架",
  "featured": false,
  "addedAt": "2026-09-08"
}
```

- `id` 唯一，只用小写英文、数字、短横线；发布后尽量不改，否则旧分享链接、收藏和记录会失效。
- `entry` / `cover` 为相对 `public/` 的本地路径，不以 `/` 开头，不支持 URL、`..` 或查询参数。
- `category` 自动成为分类，不必编辑 HTML。
- `color` 支持 `sage`（绿色）、`lavender`（紫色）和 `apricot`（杏色）；其他值回退为绿色。
- `featured: true` 排在推荐列表前面；`addedAt` 用 `YYYY-MM-DD` 格式。
- `devices` 如实填写，只有游戏真正支持触屏时才加「手机」。
- 当前 CSP 允许本地脚本与图片、data 图片、动态样式；**不允许内联 JS、HTML onclick 或外部 CDN**。将逻辑放入本地 `.js` 并使用事件监听器。未来加入 WebAssembly、Worker 或外部 API 游戏时，应只针对实际需要调整安全策略并测试。
- 仅接入自己编写或可信的游戏。iframe 隔离样式与全局变量，**不是不可信代码的安全沙箱**；同源游戏能够访问站点存储，不提供用户上传功能。

检查、预览、提交推送到 GitHub 后按上面的更新命令部署:

```sh
npm run check
PORT=5180 npm run dev
```

## 5. 开发测试

静态检查与基础单元测试不需要安装依赖：

```sh
npm run check
npm test
```

浏览器测试（仅开发时需要下载依赖和 Chromium）：

```sh
npm ci --include=dev
npx playwright install chromium
npm run test:e2e
```

测试自动启动专用的 5187 端口，不复用其他项目的预览服务器。覆盖桌面与手机模拟尺寸的大厅、搜索收藏、四个儿童游戏的基本操作、暂停、存储不可用、非法链接、最近记录与横向溢出。手机模拟不等同于真实 iOS Safari 测试；上线前建议再用真机试玩。

`docker compose config --quiet` 可以检查 Compose 配置；镜像构建与 HTTPS 签发需要运行中的 Docker、可达的 VPS 与正确域名配置，不能仅凭本地浏览器测试保证。

## 目录

```text
public/                 # 唯一的网站公开根目录
  index.html            # 游戏大厅
  play.html             # 统一游玩页
  games.json            # 游戏注册表：新增游戏主要修改这里
  assets/               # 网站 CSS、JS、封面、图标
  games/                # 各游戏独立目录
  404.html
scripts/                # 本地服务器与静态检查
 tests/                 # 单元与浏览器测试
 deploy/                # Caddy / Nginx 配置
Dockerfile
compose.yaml
.env.example
```

当前不包含账号、云存档、在线排行榜、联机或后台上传管理。这些功能需要以后增加服务端；现阶段以打开即玩、低运维成本和方便添加游戏为主。
