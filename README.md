# 胶片模拟

“胶片模拟”是一个无需登录的本地胶片工作台。照片从文件选择器进入浏览器后，使用 WebGL2（或 Canvas 兼容模式）在本机完成 LUT、颗粒、暗角和漏光处理；原图与输出均不会上传。

## 功能

- 输入：JPEG、PNG、WebP；HEIC/HEIF 仅在当前浏览器能够原生解码时使用。
- 效果：原图与 36 个 64³ LUT、LUT 强度、确定性颗粒、暗角、20 个 Screen 漏光与漏光强度。
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
npm test
npm run test:e2e
npm run build
npm run preview
```

E2E 首次运行前安装项目对应浏览器：

```bash
npx playwright install chromium
```

生产文件位于 `dist/`。它是纯静态站点，可部署到任意支持 HTTPS 的静态托管服务。部署时把 `dist/` 内容作为站点根目录；无需 API、数据库、环境变量或服务端路由。

## 隐私与限制

- 应用只通过浏览器 File API 读取用户明确选择的单张照片，没有相册扫描、账户、Cookie、分析或遥测。
- 网络只用于下载网页自身、所选 LUT 和所选漏光素材；测试会验证不存在上传/API 请求。
- 刷新页面后原图消失。输出不会保留 EXIF、位置、ICC、HDR gain map 或其他源元数据。
- HEIC 不使用 WASM 或服务器转码。不支持时请先在系统相册中导出 JPEG。
- 原尺寸导出受浏览器与 GPU 最大纹理尺寸限制；页面会提示改选较低分辨率。

更详细的浏览器行为见 [COMPATIBILITY.md](./COMPATIBILITY.md)。
