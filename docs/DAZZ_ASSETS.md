# Dazz 素材提取与网站接入记录

## 最终结果

- 42 个相机分类，64 个用户可选配方。
- 每条配方同时保存 64³ 正式 LUT 和 8³ 缩略图 LUT，格式为 RGB8、red-fastest、Deflate。
- 27 张确认属于漏光的原始素材：通用 17 张、Instant 10 张，转换为 WebP；`flashc_*.jpg` 是样片，没有混入漏光。
- 原网站的 36 个 LUT 和 20 个漏光未被覆盖。

最终网站资产位于：

- `public/assets/dazz/luts/manifest-v1.json`
- `public/assets/dazz/luts/full/`
- `public/assets/dazz/luts/preview/`
- `public/assets/dazz/light_leaks/manifest-v1.json`
- `public/assets/dazz/light_leaks/general/`
- `public/assets/dazz/light_leaks/instant/`

相机名称、二级配方名称与原始 LUT 阶段映射保存在 `scripts/dazz-recipes.json`。生成后的 manifest 还记录了文件尺寸和 SHA-256，便于核验。

## 逆向与归类过程

1. 解包 IPA，检查 `Payload/DazzCamera.app` 的图片资源、命名与尺寸。
2. 对可见 CUBE 文件读取 `LUT_3D_SIZE` 和采样数据，确认其为标准三维 LUT，行序为红色通道最快。
3. 结合相机友好名称映射，把 72 个技术 LUT 归入 42 个相机。
4. 排除不应单独显示的辅助资源：`lookup_mask_collage`、`lookup_hoga_mask`、`lookup_kv88_r`、`lut_lip`。
5. 将四组实际处理链合成为单个用户配方：FQS Light→Color、OFM Light→Color、PAF EC100 Light→Color、PAF EB3000 Light→Color。
6. 逐点执行配方链并烘焙为统一 64³ LUT；另烘焙 8³ 版本供菜单缩略图按需加载。
7. 对漏光执行格式转换并生成带尺寸、哈希和原文件名的清单。

## 可复现生成

生成器不会把本机源目录写死。准备原始 CUBE 目录和解包后的 `.app` 目录后运行：

```bash
DAZZ_CUBE_DIR=/path/to/cubes \
DAZZ_APP_DIR=/path/to/Payload/DazzCamera.app \
npm run assets:dazz
npm run test:dazz-assets
```

生成脚本是 `scripts/generate-dazz-assets.mjs`。测试会核对 42/64/27 的数量、所有压缩 LUT 解压后的字节数，以及原有 36/20 数量没有变化。

## 网站处理链

照片在浏览器本地解码；选中的 3D LUT 先完成颜色映射，然后依次叠加可调颗粒、暗角和 Screen 模式漏光，最后在本地编码导出。Dazz 菜单只加载 8³ 预览；用户真正选中某配方后才下载对应 64³ LUT。

这些素材可能受原作者版权、商标或许可限制。本仓库声明为非商业学习与研究用途；公开部署或再分发前，应自行确认并取得所需授权。
