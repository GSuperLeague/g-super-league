# G超联赛

桌面足球联赛管理网站，从原 Sites 项目迁移为独立 Git 仓库。

- [GitHub Pages](https://gsuperleague.github.io/g-super-league/)
- 前端：React + Vite，GitHub Pages 托管。
- 后端：你自己的 Cloudflare Worker + D1 数据库（含压缩头像）。
- 当前已配置独立数据服务：https://g-super-league-api.jason-brown-20-28-2023.workers.dev 。新部署到其他账号时，需设置自己的后端地址。管理员密钥须由账号所有者在 Cloudflare 中设置。

## 功能与规则

球队登记、球员编辑、多球队成员关系、球员画像、虚拟身价、赛程、逐球记分、赛后直接登记最终比分、球队积分榜、射手与防守榜、个人与分位置表现、双人搭档、同阵容换位对照、历史交手、三套 Elo、单场 Elo 变化、三种数据雷达、赛场荣誉、JSON 导出、每 3 秒同步。

- 常驻队比赛计入球队战绩、个人及组合数据；临时组队显示「队伍A / 队伍B」，计个人及组合，不计球队战绩。
- 球员总览和位置统计包括出场、胜平负、胜率、球队得失分、净胜球、场均表现、关键局、连胜和最近 10 场。
- 得失分统计球员在场时的球队比分。射手榜沿用原记账口径：赛后汇总将本队进球计给本场前锋；逐球记录使用实际指定球员，乌龙球不计个人进球。前锋记账不代表实际逐球归属，不由汇总推算助攻、扑救、逆转等事件指标。
- 射手榜累计进球包含进行中比赛；场均进球仅使用已完赛且记录前锋位置的汇总比赛。防守榜仅统计后卫角色明确的完赛汇总，防守球为该场全队净胜球，沿用原榜单口径。
- 前锋、后卫表现使用本场明确记录的角色，不依据当前球员资料推测历史位置。未完赛比赛不计入统计。
- Elo 初始 1200，K=32，按时间顺序计算；完整记录位置的 2 对 2 比赛使用两位队员赛前评分均值计算预期胜率。总 Elo 与位置 Elo 独立更新。
- 每场 Elo 变化为 `32 ×（实际胜负得分 − 预期胜率）`，胜、平、负分别取 1、0.5、0。同一队在同一套评分中的两名球员获得相同变化。位置 Elo 使用本场前锋的前锋评分和后卫的后卫评分组成队伍均值，只更新本场角色。
- 分差、进球数、传统榜单、人工能力、身价和当前常用位置不直接影响 Elo。比赛先后顺序、历史赛果及当场阵容与角色会影响回算；临时组队与常驻队比赛满足定级条件时都计入。
- 打开比赛可切换总 Elo 和位置 Elo，查看四名球员赛前、赛后及变化值，按完整历史回算至本场。未完赛或阵容不满足定级条件时不生成赛后变化。
- 数据页支持比赛类型、北京时间月份与最少出场筛选。Elo 随筛选范围从初始值重新计算；不足 3 场标为小样本，无数据项显示「—」。
- 双人组合只统计同侧恰好两位球员的比赛；可查看胜率矩阵、进攻及防守组合榜。球员与球队交手记录均可下钻到比赛。
- 前后位置搭档矩阵区分「甲前锋 / 乙后卫」与反向站位。同阵容换位对照固定同一对搭档、对方两人及对方位置，两种站位均需达到出场门槛，可查看对应比赛。
- 位置对照展示逐场得分占比的平均值（0:0 排除）、Wilson 95% 胜率区间、搭档和对手人数，以及有效定级场次的搭档、对手赛前总 Elo 均值。上述统计提供阵容和样本背景，不参与 Elo 结算；源数据未记录分制、球桌及先后手，无法完全控制这些差异。
- 球员档案有总览、前锋和后卫三种雷达图，算法与原值可在页面「统计口径与评分」查看；人工能力值作为原始资料保留。
- 赛季或月度 MVP、最佳位置和最佳搭档要求至少 3 场有效样本。缺少事件记录的奖项不生成。
- 编辑比分会替换原结果；删除比赛后榜单重新计算；更改球员常用位置不改变历史比赛角色。
- 身价和人工能力资料由管理员维护；赛果雷达与 Elo 自动计算。

## 部署

### 1. 安装与准备

需要 Node.js 22.13+、npm、Git，以及你自己的 Cloudflare 账号（启用 Workers、D1）。

```bash
git clone https://github.com/GSuperLeague/g-super-league.git
cd g-super-league
npm ci
npx wrangler login
cp backend/wrangler.example.jsonc backend/wrangler.jsonc
npx wrangler d1 create g-super-league
```

将创建 D1 时返回的 `database_id` 填入 `backend/wrangler.jsonc`。该文件虽使用 `.jsonc` 扩展名，请保持标准 JSON（迁移脚本会读取它）。配置文件被 Git 忽略。

`ALLOWED_ORIGINS` 使用网站**来源**而非含路径的网址，默认是 `https://gsuperleague.github.io,https://junjieyu28.github.io,http://localhost:5173`。使用自定义域名时同步更新这里。

### 2. 发布数据服务

```bash
npm run db:remote
npm run api:deploy
npx wrangler secret put ADMIN_TOKEN --config backend/wrangler.jsonc
```

按提示输入你自行生成的至少 24 字符随机管理密钥，妥善保管并交给记录员。它只保存在 Worker secret 中；不要写入 Git、Vite 环境变量或 README。未设置有效密钥时写入会被拒绝，读取仍开放。记录员在右上角「管理员登录」输入密钥，浏览器只在当前标签页 sessionStorage 保存；退出管理即清除。所有访客都可查看联赛数据。

记下 Wrangler 返回的 HTTPS Worker 地址。

### 3. 迁移旧数据

在旧站停止新增登记期间执行，避免迁移过程中两边继续修改造成遗漏。原站不会被修改或删除。

```bash
SOURCE_URL=https://g-super-league.luke19929788.chatgpt.site npm run backup
npm run restore
```

导出内容放在 `.migration/backup.json` 和 `.migration/photos/`，含球队、球员、比赛、设置与头像原文件；这些个人数据不会进入公共仓库。`restore` 使用原头像 ID，且仅允许导入空联赛，拒绝覆盖已有记录。导入后核对人数、场次和榜单，再切换使用新网站。若旧站访问权限改变，需先恢复可读取的导出来源，或使用先前保存的完整备份。

2026-10-19 已将 4 支球队、5 名球员、8 场比赛导入独立 D1 数据库（当时没有头像）。后续迁移应重新导出最新快照。

### 4. 连接 GitHub Pages

本仓库工作流已配置当前后端的默认地址。更换后端时，可在仓库 Settings → Secrets and variables → Actions → **Variables** 新增覆盖值：

| 名称 | 值 |
|---|---|
| `VITE_API_BASE_URL` | 上一步 Worker 的 HTTPS 地址，不带 `/api` |

Settings → Pages → Source 选择 **GitHub Actions**。Actions → Deploy GitHub Pages → Run workflow。推送到 `main` 也会自动测试、构建并发布。

网站路径默认 `/g-super-league/`。如果以后迁到用户根站或改仓库名，修改 `.github/workflows/pages.yml` 的 `VITE_BASE_PATH`。修改 Actions 变量后必须重新运行工作流，变量才会进入新的静态构建。

没有管理密钥会返回 401；来源配置不匹配会返回 403；数据库未初始化时会返回 503。请勿把旧站地址用作新后端，它仍依赖原托管，并且没有新接口所需的跨域配置。

头像默认存储在 D1 的 `photos` 表，客户端压缩到最长边 512 像素，上传限制 1MB。无需 R2 订阅。需要更大规模时，可在配置中加入绑定名为 `BUCKET` 的 R2 桶；接口和迁移脚本仍支持 R2。

## 本地开发

### 后端无法连接时：导出数据、本地预览

在能访问线上数据的浏览器中，进入「联赛设置 → 导出数据快照」，将 JSON 放到仓库根目录。开发机无需连接线上后端，直接启动本地 demo（Node.js 22.13+）：

```bash
npm ci
npm run dev:snapshot -- G超联赛-2026-10-19.json
```

脚本初始化独立的本地 D1，启动真实 Worker 和 Vite，默认访问 `http://localhost:5173/g-super-league/`。端口占用时自动选空闲端口，以控制台输出为准。远程开发机可转发前端端口；API 经 Vite 同源代理，无需额外转发。

启智 Notebook 环境会额外输出包含当前实例路径的 `Notebook 预览` 完整链接，请使用该链接。仅用域名加 `/proxy/5173/` 会在平台网关返回 404。开发预览自动保留代理路径，用于加载页面资源、API 和热更新；生产构建仍使用 GitHub Pages 路径。

Notebook 端口代理只负责打开开发服务器，不等于访问线上接口的网络代理。如需连接线上后端，应在实际发请求的浏览器或主机配置网络代理，确认 `/api/league` 能访问；仅设置终端代理不会让浏览器自动走代理。返回 403 时检查后端 `ALLOWED_ORIGINS` 是否包含当前页面来源。快照模式不依赖线上接口或其网络代理。

本地管理密钥为 `preview-only-admin-token-2026`，仅用于本地 Worker。可登录后测试录入、编辑、删除；所有更改保存在 `.migration/local-preview/`，再次运行命令时会恢复到传入的快照。JSON 中的头像是链接，不含原图。

该模式只运行本地服务，快照与本地数据库不打包进前端，也不写入线上数据。导出的 `G超联赛-*.json` 已加入 Git 忽略规则。

预览确认后运行 `npm test`、`npm run build`，再提交并 `git push origin main`；GitHub Actions 发布前端代码，线上联赛数据保持独立。

### 常规前后端开发

```bash
cp .env.example .env.local
cp backend/wrangler.example.jsonc backend/wrangler.jsonc
npm run db:local
# 在 backend/.dev.vars 写入仅供本地使用的 ADMIN_TOKEN，至少 24 字符
npm run api:dev
# 另开终端
npm run dev
```

访问 `http://localhost:5173/g-super-league/`。本地 D1 使用 Wrangler 本地存储，不改线上数据。

```bash
npm test
npm run build
```

## 源码

| 路径 | 用途 |
|---|---|
| `src/App.tsx`、`src/styles.css` | 页面与交互 |
| `src/api.ts` | 独立接口地址、头像地址、管理员会话 |
| `lib/league.ts` | 共用业务校验、比分及榜单计算 |
| `lib/analytics.ts` | 赛果统计、Elo、搭档、交手和雷达指标 |
| `src/Analytics.tsx`、`src/analytics.css` | 数据总览、球员档案与数据分析页面 |
| `backend/src/index.ts` | 数据与头像 API、CORS、写入认证、并发版本控制 |
| `backend/migrations/` | D1 数据表 |
| `scripts/migrate.mjs` | 数据与头像备份、空库恢复 |
| `scripts/dev-snapshot.mjs` | 使用导出 JSON 启动隔离的本地预览 |
| `.github/workflows/pages.yml` | 自动测试、构建、Pages 部署 |
| `tests/` | 计分规则和接口权限回归测试 |

迁移基于原项目提交 `d821b80a51d029f9523192ac3dede996e6370c88`。本仓库不依赖 Sites 环境变量、托管接口、Vinext 或 Next.js。原站保留，确认新站完整可用后再决定下线时间。
