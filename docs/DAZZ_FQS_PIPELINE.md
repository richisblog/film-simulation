# FQS 成像链路记录

## 已确认顺序

1. 光学模糊节点：半径 6、角度 0、质量 5。
2. `grain_ou.jpg` 颗粒，参数 1。
3. `lookup_ou_light` 明度/阶调 LUT。
4. `grain_ou_lowlight.jpg` 低光颗粒调用；追踪中传入参数为 null。
5. `lookup_ou_color` 色彩 LUT。

两张 LUT 必须分开，因为颗粒节点位于它们之间。运行时资产为 `DAZZ_STAGE_LOOKUP_OU_LIGHT.rgb.deflate`、`DAZZ_STAGE_LOOKUP_OU_COLOR.rgb.deflate`、`GRAIN_OU.webp` 和 `GRAIN_OU_LOWLIGHT.webp`。

## 已知边界

静态逆向可以确认资源、节点、顺序和上述参数，但不能证明 Dazz 私有颗粒混合核的每个数学常量。当 amount 为 null 时，网站不猜测一个隐藏数值，而是跳过该低光混合；这一边界在测试中被明确锁定。
