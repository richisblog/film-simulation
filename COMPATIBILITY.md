# 浏览器兼容说明

## 弱网与素材加载

- 生产构建优先从 Cloudflare Pages 获取 LUT 和漏光；CDN 请求失败后自动回退到应用本站。
- 缩略图、左侧大预览和导出统一使用 8³ LUT；36 个 LUT 在后台同时准备，已成功项立即可用。
- 页面显示完成数量、百分比、最近完成项和失败数；失败项可单独重试，不阻塞其他滤镜。
- 通过版本化 Cache Storage 持久保存校验成功的压缩 LUT，并同步写入约 62 KB 的 localStorage 兼容副本。再次打开网站时读取本地缓存，只联网补齐缺失或损坏项。
- 二进制效果素材成功响应也由 Service Worker 按 CacheFirst 缓存；8³ 上线时缓存名升级到 `film-effects-v3`，避免复用旧 16³ 字节。
- Chromium 与 WebKit 的端到端测试覆盖 CDN 断线、同源回退、36/36 持久缓存、零请求重开和单项续传。

## 推荐环境

- Safari 15 或更新版本：WebGL2 主路径；较新的 Safari 可获得更稳定的 Canvas、WebP 和 PWA 能力。
- Chrome、Edge、Firefox 的当前稳定版：WebGL2 主路径。
- iPhone/iPad 与 Android：使用系统文件选择器；页面按照安全区和动态视口适配。

## 输入格式

| 格式 | 行为 |
| --- | --- |
| JPEG | 基线支持 |
| PNG | 基线支持，透明度进入编辑，但 JPEG 输出会失去透明度 |
| WebP | 基线支持 |
| HEIC/HEIF | 文件可被选择；只有真实解码成功才进入编辑 |

HEIC 支持取决于浏览器、操作系统、图片编码方式和色彩特征。网站不根据 User-Agent 宣称支持，也不上传转码；每个文件都实际尝试 `createImageBitmap`，失败后再尝试图片元素解码。

## 输出格式

JPEG 与 PNG 使用浏览器 Canvas 编码。WebP 编码完成后会检查返回 Blob 的 MIME；如果 Safari 回退成其他格式，页面会提示改用 JPEG，而不是给错误内容加 `.webp` 扩展名。

## 渲染降级

首选 WebGL2，将 8³ RGB8 LUT 作为三维纹理采样，并在同一着色器中完成颗粒、暗角和漏光。WebGL2 初始化失败时使用 Canvas 2D CPU 兼容模式；兼容模式在大图上会更慢。

以下能力只做增强，不是核心流程依赖：WebGPU、OffscreenCanvas、File System Access、Web Share、安装提示。公开部署必须使用 HTTPS，才能稳定启用 Service Worker 与安装型 PWA。
