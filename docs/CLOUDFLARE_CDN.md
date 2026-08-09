# Cloudflare CDN 部署指南

这套配置不把 Cloudflare 作为正确性的前提。应用始终打包完整素材，并按“Cloudflare 主源 → 当前网站 `./assets`”的顺序尝试；Cloudflare、DNS 或跨境线路故障时仍可使用 `film.richis.top` 上的文件。

## 方案与限制

仓库使用 Cloudflare Pages Direct Upload，把同一个 `dist/` 静态产物发布到 Cloudflare 全球网络，不需要 R2、数据库或后端。建议保留现有 `film.richis.top` nginx 站点，把 `film-cdn.richis.top` 单独指向 Pages。

普通 Cloudflare 全球服务不等同于 Cloudflare 中国网络，也不承诺中国大陆访问延迟。这个方案提供多线路与自动回退；实际速度需要用目标运营商网络验证。由于 `richis.top` 当前使用阿里云 DNS，子域可以通过 CNAME 接入 Pages，无需先迁移整个域名的 NS。

## 首次部署

需要 Node.js 22 或更新版本。

```bash
npm install
npx wrangler login
npx wrangler whoami
npm run deploy:cloudflare
```

Wrangler 使用 `wrangler.jsonc` 中的现有项目名 `film-simulation` 和输出目录 `dist`。这个已有 Pages 项目的生产分支是 `main`，所以部署脚本显式使用 `--branch main`；这与 GitHub 仓库当前使用 `master` 不冲突。成功后的稳定地址为 `https://film-simulation.pages.dev`，每次发布还会返回一个带版本前缀的地址。

Cloudflare Direct Upload 项目以后不能原地改为 Git integration；如需 Git integration，应新建另一个 Pages 项目。仓库现有 GitHub Pages/nginx 部署不受影响。

## 自定义素材域名

1. 在 Cloudflare Dashboard 打开 Workers & Pages → `film-simulation` → Custom domains。
2. 先添加 `film-cdn.richis.top` 并等待 Cloudflare 给出验证目标。
3. 再到阿里云 DNS 创建 CNAME：主机记录 `film-cdn`，目标为 Cloudflare 展示的 `<项目名>.pages.dev`。
4. 不要只创建 CNAME 而跳过 Dashboard 的 Custom domains 关联，否则 Pages 可能返回 522。
5. 等待证书与域名状态变为 Active。

验证：

```bash
curl -I https://film-cdn.richis.top/assets/luts/INSTWARM.rgb.deflate
curl -I -H 'Origin: https://film.richis.top' https://film-cdn.richis.top/assets/luts/INSTWARM.rgb.deflate
```

响应应为 `200`，并包含 `Access-Control-Allow-Origin: *`。`public/_headers` 为 LUT 和漏光设置 7 天浏览器缓存；清单仍从应用本站加载，避免应用版本与清单错配。

## 让应用优先使用 CDN

生产构建默认使用已部署的 Pages 地址（见 `.env.production`）。本地或 nginx 构建可用环境变量覆盖：

```bash
VITE_ASSET_BASE_URL=https://film-simulation.pages.dev/assets npm run build
```

GitHub Actions 的生产构建会自动读取仓库中的 `.env.production`。`film-cdn.richis.top` 激活后，把该文件中的地址替换为 `https://film-cdn.richis.top/assets` 并重新构建。

变量不属于秘密。不要在其中加入 token 或签名查询参数。构建后的 CDN 地址已经写入 JavaScript，因此修改变量后必须重新构建和部署。

## 验收

1. 打开浏览器开发者工具 Network，并清除站点数据后刷新页面。
2. 页面应显示从 `0 / 36` 到 `36 / 36` 的加载进度，所有 LUT 请求都应指向 `/assets/luts/8cube-v1/`。
3. 缩略图、左侧大预览和导出都不应请求 `/assets/luts/<ID>.rgb.deflate` 的 64³ 文件。
4. 正常情况下第一个请求域名应为 `film-simulation.pages.dev`，自定义域激活后为 `film-cdn.richis.top`。
5. 完成 36 / 36 后关闭并重新打开页面；LUT 网络请求应为 0，资源从版本化本地缓存读取。
6. 清除一个 LUT 缓存或让一个请求失败后刷新；只有缺失项应重新经过 CDN → `film.richis.top` 回退链路。
7. 页面不应产生照片上传、分析或遥测请求。

## CORS、缓存和更新

- Pages 读取构建产物根目录的 `_headers`；GitHub Pages 和 nginx 不会把该文件当服务器配置。
- nginx 继续为 `/assets/` 提供缓存，但 `manifest.json` 应使用 `no-cache` 或较短缓存，二进制 LUT/WebP 可以保持 7 天缓存。
- 应用使用 `film-lut-bytes-v1` Cache Storage 并双写约 62 KB 的 localStorage 兼容副本；缓存键包含尺寸和清单字节长度。
- Service Worker 使用 `film-effects-v3` CacheFirst 缓存，只缓存成功的二进制素材响应。
- 更换 LUT 内容但沿用同名文件时，应同步升级 Service Worker 缓存名；更推荐以后把内容哈希加入文件名。

## 回滚

最快回滚不需要删除 Cloudflare 项目：

1. 删除或清空 `.env.production` 中的默认值。
2. 重新执行 `npm run build` 并部署。
3. 应用将只使用打包的 `./assets`。

如果只想撤销某次 Pages 发布，可在 Cloudflare Dashboard 的 Deployments 中选择上一版本并执行 Rollback。确认应用已回到同源素材后，再决定是否删除 `film-cdn.richis.top` CNAME 或自定义域名关联。

## CI 凭据（可选）

如以后要让 GitHub Actions 同时发布 Cloudflare Pages，按 Cloudflare Direct Upload CI 文档创建最小权限 API Token，并把 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 保存为 GitHub Secrets。当前工作流不要求或保存 Cloudflare 凭据。
