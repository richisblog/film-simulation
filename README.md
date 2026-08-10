# 胶片模拟

> ⚠️ **实验性项目**：本工具为个人学习与实验用途，功能与稳定性不作保证，请勿用于生产环境或商业场景。

“胶片模拟”是一个无需登录的本地胶片工作台。照片从文件选择器进入浏览器后，使用 WebGL2（或 Canvas 兼容模式）在本机完成 LUT、颗粒、暗角和漏光处理；原图与输出均不会上传。

界面完整支持中文和英文。首次访问会根据浏览器语言自动选择（中文环境使用中文，其他环境使用英文），手动切换后会在当前浏览器中记住选择。

## 功能

- 输入：JPEG、PNG、WebP；HEIC/HEIF 仅在当前浏览器能够原生解码时使用。
- 效果：原图、36 个经典 LUT，以及按 29 个相机分类的 40 个启用 Dazz 配方；76 个运行时 LUT 均以 8³ 形式预加载。支持曝光、LUT 强度、确定性颗粒、暗角、20 个原有漏光和 27 个 Dazz 漏光。
- 输出：JPEG、PNG、WebP；原尺寸或 4096、3072、2048、1080 长边，不放大小图。
- 设备：响应式电脑/手机界面、键盘和触控操作、PWA 安装与按需离线效果缓存。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

浏览器打开终端给出的本地地址。效果素材（LUT 与漏光）已随仓库提供，无需额外同步。

## 测试与构建

```bash
npm run test:assets
npm run test:dazz-assets
npm run test:pwa-assets
npm test
npm run test:e2e
npm run build
npm run preview
```

E2E 首次运行前安装项目对应浏览器：

```bash
npx playwright install chromium
```

生产文件位于 `dist/`。它是纯静态站点，可部署到任意支持 HTTPS 的静态托管服务。部署时把 `dist/` 内容作为站点根目录；无需自建 API、数据库或服务端路由。

可选的 `VITE_ASSET_BASE_URL` 能把 LUT 与漏光优先放到 CDN；CDN 失败时应用会自动回退到随站点发布的素材。Cloudflare Pages 的部署、`film-cdn.richis.top` 配置与回滚步骤见 [Cloudflare CDN 指南](./docs/CLOUDFLARE_CDN.md)。

Dazz 素材的来源判定、相机映射、组合配方、生成命令和最终目录见 [Dazz 素材记录](./docs/DAZZ_ASSETS.md)。

可选的 `VITE_GOATCOUNTER_URL` 用于启用无 Cookie 的匿名访问与导出滤镜统计。统计仅在私有后台查看，前台不展示浏览量或滤镜排名。生产统计配置、后台查询与停用方法见 [流量统计指南](./docs/ANALYTICS.md)。

## 隐私与限制

- 应用只通过浏览器 File API 读取用户明确选择的单张照片，没有相册扫描、账户或广告 Cookie。
- 生产站使用 GoatCounter 记录聚合页面访问，并在导出成功后记录当时的稳定滤镜 ID 与当前语言下的公开名称；不使用广告标识、Cookie、localStorage 或指纹追踪。
- 照片、图像数据、文件名、导出文件名、调节参数、LUT 内容和导出结果均不会发送给统计服务；网络还用于下载网页自身、LUT 与漏光素材。
- 刷新页面后原图消失。输出不会保留 EXIF、位置、ICC、HDR gain map 或其他源元数据。
- HEIC 不使用 WASM 或服务器转码。不支持时请先在系统相册中导出 JPEG。
- 原尺寸导出受浏览器与 GPU 最大纹理尺寸限制；页面会提示改选较低分辨率。

更详细的浏览器行为见 [COMPATIBILITY.md](./COMPATIBILITY.md)。

## 许可证与声明

本项目采用 [**CC BY-NC 4.0**（署名-非商业性使用 4.0 国际）](https://creativecommons.org/licenses/by-nc/4.0/) 协议，详见 [LICENSE](./LICENSE)。

- **仅供学习与参考**，禁止任何形式的商业使用（包括但不限于销售、付费服务、商业产品集成等）。
- 本项目内的滤镜与漏光等效果素材**收集自网络**，版权归原作者所有；此处仅用于学习、研究与展示，如涉及侵权请联系移除。
- 本项目代码与素材均按“原样”提供，不附带任何担保，使用者需自行承担相关风险。

如需商业使用，请先确认所涉素材的授权情况并取得相应权利人许可。
