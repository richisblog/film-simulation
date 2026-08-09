# 流量统计指南

生产站使用开源项目 [GoatCounter](https://github.com/arp242/goatcounter) 的托管服务，从启用当天开始记录页面浏览量（PV）。不回填上线前的数据。

## 后台与公开数字

- 管理后台：<https://film-simulation.goatcounter.com>
- 公开总数接口：<https://film-simulation.goatcounter.com/counter/TOTAL.json>
- 前端配置：`VITE_GOATCOUNTER_URL=https://film-simulation.goatcounter.com`
- 所有正式托管域名统一记录为路径 `/`，避免 `film.richis.top`、GitHub Pages 与 Cloudflare Pages 被拆成多条数据。

GoatCounter 后台通常在约 10 秒内更新。公开计数响应可能被缓存最长四小时，因此页脚数字可能落后于后台；页面不做乐观加一，始终展示服务端返回的累计值。

## 首次设置

在管理后台完成以下设置：

1. `Settings → Site settings`：站点域名设为 `film.richis.top`。
2. 启用 `Allow adding visitor counts on your website`，否则公开总数接口不可读。
3. `Settings → Data collection → Sessions`：关闭 Sessions 去重，使每次文档加载和刷新都计为一个 PV。
4. 保持 individual pageviews 关闭；本项目只需要聚合统计。

账户密码只保存在系统密码管理器中，不写入 `.env`、源码、GitHub Secrets 或浏览器包。前端只包含公开站点 URL，不使用 GoatCounter 管理 API token。

## 收集与不收集的内容

GoatCounter 接收页面路径 `/`、页面标题、referrer，以及用于生成聚合报表的粗粒度浏览器、设备、屏幕宽度和国家信息。访客侧不写 Cookie、localStorage 或广告标识。

以下内容永远不发送到 GoatCounter：

- 用户照片、文件名和图片元数据
- 选择的滤镜、颗粒、暗角和漏光参数
- LUT 文件内容与本地缓存内容
- 渲染结果和导出文件

## 排除自己的访问

打开 `https://film.richis.top/#toggle-goatcounter` 并按页面提示切换当前浏览器的排除状态；也可以在 `Settings → Tracking → Ignore IPs` 中排除固定管理 IP。

## 故障与停用

广告拦截器或网络可能阻止 `gc.zgo.at`、`*.goatcounter.com`。统计脚本或公开接口失败时，页脚显示“浏览量暂不可用”，滤镜预载、图片打开、预览和导出不受影响。

临时停用时，从生产环境删除 `VITE_GOATCOUNTER_URL` 并重新构建；无需修改编辑器代码。永久停用或删除数据时，使用 GoatCounter 后台的账户删除功能。账户恢复使用项目所有者邮箱完成。
