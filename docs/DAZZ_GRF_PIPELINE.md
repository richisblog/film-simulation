# GRF 成像链路记录

GRF 是一台相机下的三个胶片偏向，网站以二级菜单呈现：

- `400TX` → `lookup_dblack_1`
- `NEOP100` → `lookup_dblack_2`
- `VELVIA` → `lookup_velvia_x5`

三条证据链均为单独 3D LUT，未发现额外的固定曝光补偿。对应 8³ 文件在 `public/assets/dazz/luts/preview/DAZZ_STAGE_LOOKUP_DBLACK_1.rgb.deflate`、`DAZZ_STAGE_LOOKUP_DBLACK_2.rgb.deflate` 与 `DAZZ_STAGE_LOOKUP_VELVIA_X5.rgb.deflate`；声明式定义位于 LUT manifest 的三个 `DAZZ_PIPELINE_GRF_*` 项。
