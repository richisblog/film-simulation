# Dazz 素材提取与网站接入记录

## 最终结果

- GitHub 归档保留 43 个相机、67 条配方及其全部 64³/8³ 文件；产品启用 31 个相机、44 条配方。
- 每条归档配方同时保存 64³ 和 8³ LUT，格式为 RGB8、red-fastest、Deflate；运行时只使用并预加载启用配方的 8³ 文件。
- 27 张确认属于漏光的原始素材：通用 17 张、Instant 10 张，转换为 WebP；`flashc_*.jpg` 是样片，没有混入漏光。
- 原网站的 36 个 LUT 和 20 个漏光未被覆盖。

最终网站资产位于：

- `public/assets/dazz/luts/manifest-v1.json`
- `public/assets/dazz/luts/full/`
- `public/assets/dazz/luts/preview/`
- `public/assets/dazz/light_leaks/manifest-v1.json`
- `public/assets/dazz/light_leaks/general/`
- `public/assets/dazz/light_leaks/instant/`
- `public/assets/dazz/textures/`

相机名称、二级配方名称与原始 LUT 阶段映射保存在 `scripts/dazz-recipes.json`；产品下架策略保存在 `scripts/dazz-product-policy.json`。生成后的 manifest 只列启用项，并记录文件尺寸和 SHA-256。

## 逆向与归类过程

1. 解包 IPA，检查 `Payload/DazzCamera.app` 的图片资源、命名与尺寸。
2. 对可见 CUBE 文件读取 `LUT_3D_SIZE` 和采样数据，确认其为标准三维 LUT，行序为红色通道最快。
3. 结合相机友好名称映射，把 72 个技术 LUT 归入 42 个相机。
4. 排除不应单独显示的辅助资源：`lookup_mask_collage`、`lookup_hoga_mask`、`lookup_kv88_r`、`lut_lip`。
5. 对普通配方烘焙多 LUT 阶段；KV80、GRF、FQS 保留已证实的有序原生节点，不再把 FQS Light→Color 压成一张运行时 LUT。
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

生成脚本是 `scripts/generate-dazz-assets.mjs`。测试会核对 43/67 归档、31/44 上架、27 漏光及 3 张颗粒纹理，并检查所有 8³ 阶段 LUT 的解压长度与哈希。

## 网站处理链

照片在浏览器本地解码。全局顺序为用户曝光/漏光 → 完整原生配方 → 一次整体强度混合 → 用户颗粒/暗角。经典配方、Dazz 8³ 预览 LUT、6 个原生阶段 LUT 及 3 张颗粒纹理统一进入预加载进度；产品不请求仓库保留的 64³ 文件。

三条重点链路的独立记录：`DAZZ_KV80_PIPELINE.md`、`DAZZ_GRF_PIPELINE.md`、`DAZZ_FQS_PIPELINE.md`。

这些素材可能受原作者版权、商标或许可限制。本仓库声明为非商业学习与研究用途；公开部署或再分发前，应自行确认并取得所需授权。
