# KV80 成像链路记录

## 已确认结果

KV80 运行时链路为 `lookup_kv80_kg200` 3D LUT 后叠加 `grain_ofm.jpg` 颗粒纹理。程序证据中没有固定 `-0.7 EV`、`-1 EV` 或独立曝光曲线节点，网站因此不会暗中降曝光。用户的曝光滑杆保持 0 EV，并在原生链路前执行。

## 资产位置

- 64³ 归档：`public/assets/dazz/luts/full/DAZZ_KV80_KG200.rgb.deflate`
- 8³ 阶段：`public/assets/dazz/luts/preview/DAZZ_STAGE_LOOKUP_KV80_KG200.rgb.deflate`
- 原颗粒转码：`public/assets/dazz/textures/GRAIN_OFM.webp`
- 声明式链路：`public/assets/dazz/luts/manifest-v1.json` 中的 `DAZZ_PIPELINE_KV80`

## 边界

LUT 和颗粒来自安装包，节点顺序来自程序追踪；Dazz 未公开的 Core Image 颗粒混合核仍无法从静态资源中完整还原，网站实现明确命名为 `dazzGrainApproximation`，不把该部分冒充为已证实常量。
