# G超联赛

桌面足球联赛管理网站，从原 Sites 项目迁移为独立 Git 仓库。

- [GitHub Pages](https://junjieyu28.github.io/g-super-league/)
- 前端：React + Vite，GitHub Pages 托管。
- 后端：你自己的 Cloudflare Worker + D1 数据库 + R2 头像桶。
- **首次部署需要配置后端地址；仅发布 Pages 还不能登记或同步比分。** 未配置时页面会提示等待数据服务，不会生成假数据或把数据默默保存到单台浏览器。

## 功能与规则

球队登记、球员编辑、多球队成员关系、球员画像、虚拟身价、六维能力图、赛程、逐球记分、赛后直接登记最终比分、球队积分榜、射手榜、防守榜、JSON 导出、每 3 秒同步。

- 常驻队比赛计入球队榜和个人榜。
- 临时混搭显示「队伍A / 队伍B」，只计个人榜。
- 每场指定双方固定前锋、后卫；本队进球全部记给本场前锋。
- 场均进球 = 担任前锋时的总进球 ÷ 前锋场次，0 球的前锋场次也计入。
- 防守球 = 本队进球 − 对手进球。8:5 时，双方后卫分别 +3、−3。
- 场均防守 = 累计有正负的防守球 ÷ 后卫场次。平局计 0，仍算一场。
- 历史逐球记录未明确位置时，不猜测前锋/后卫场次；补录赛后结果后进入角色统计。
- 编辑比分会替换原结果；删除比赛后榜单重新计算；更改球员常用位置不改变历史比赛角色。
- 身价和六维能力由管理员手动维护。

## 部署

### 1. 安装与准备

需要 Node.js 22.13+、npm、Git，以及你自己的 Cloudflare 账号（启用 Workers、D1、R2）。

```bash
git clone https://github.com/JunjieYu28/g-super-league.git
cd g-super-league
npm ci
npx wrangler login
cp backend/wrangler.example.jsonc backend/wrangler.jsonc
npx wrangler d1 create g-super-league
npx wrangler r2 bucket create g-super-league-photos
```

将创建 D1 时返回的 `database_id` 填入 `backend/wrangler.jsonc`，检查 `bucket_name` 与实际一致。该文件虽使用 `.jsonc` 扩展名，请保持标准 JSON（迁移脚本会读取它）。配置文件被 Git 忽略。

`ALLOWED_ORIGINS` 使用网站**来源**而非含路径的网址，默认是 `https://junjieyu28.github.io,http://localhost:5173`。使用自定义域名时同步更新这里。

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

截至迁移准备时，旧站读取到 4 支球队、5 名球员、8 场比赛、0 张头像。数据尚未导入新服务，实际切换时应重新导出最新快照。

### 4. 连接 GitHub Pages

仓库 Settings → Secrets and variables → Actions → **Variables**，新增：

| 名称 | 值 |
|---|---|
| `VITE_API_BASE_URL` | 上一步 Worker 的 HTTPS 地址，不带 `/api` |

Settings → Pages → Source 选择 **GitHub Actions**。Actions → Deploy GitHub Pages → Run workflow。推送到 `main` 也会自动测试、构建并发布。

网站路径默认 `/g-super-league/`。如果以后迁到用户根站或改仓库名，修改 `.github/workflows/pages.yml` 的 `VITE_BASE_PATH`。修改 Actions 变量后必须重新运行工作流，变量才会进入新的静态构建。

没有管理密钥会返回 401；来源配置不匹配会返回 403；数据库未初始化时会返回 503。请勿把旧站地址用作新后端，它仍依赖原托管，并且没有新接口所需的跨域配置。

## 本地开发

```bash
cp .env.example .env.local
cp backend/wrangler.example.jsonc backend/wrangler.jsonc
npm run db:local
# 在 backend/.dev.vars 写入仅供本地使用的 ADMIN_TOKEN，至少 24 字符
npm run api:dev
# 另开终端
npm run dev
```

访问 `http://localhost:5173/g-super-league/`。本地 D1/R2 使用 Wrangler 本地存储，不改线上数据。

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
| `backend/src/index.ts` | 数据与头像 API、CORS、写入认证、并发版本控制 |
| `backend/migrations/` | D1 数据表 |
| `scripts/migrate.mjs` | 数据与头像备份、空库恢复 |
| `.github/workflows/pages.yml` | 自动测试、构建、Pages 部署 |
| `tests/` | 计分规则和接口权限回归测试 |

迁移基于原项目提交 `d821b80a51d029f9523192ac3dede996e6370c88`。本仓库不依赖 Sites 环境变量、托管接口、Vinext 或 Next.js。原站保留，确认新站完整可用后再决定下线时间。
