# 匿名统计指南

生产站使用开源项目 [GoatCounter](https://github.com/arp242/goatcounter) 的托管服务。统计只在项目所有者的私有后台查看；页面不显示浏览量、滤镜排名或统计可用状态。

## 后台与配置

- 管理后台：<https://film-simulation.goatcounter.com>
- 前端配置：`VITE_GOATCOUNTER_URL=https://film-simulation.goatcounter.com`
- 所有正式托管域名统一将页面访问记为路径 `/`，避免按域名拆分数据。
- localhost、HTTP 页面和自动化测试不发送统计。

账户密码只保存在系统密码管理器中，不写入 `.env`、源码、GitHub Secrets 或浏览器包。前端不包含 GoatCounter 管理 API token。

## 导出滤镜事件

每次照片成功导出后记录一次事件，重复导出会分别计数。记录格式为：

- 已选滤镜：路径 `export-filter-<LUT_ID>`；中文页面标题为 `导出滤镜：<公开中文名称>`，英文页面标题为 `Export filter: <public English name>`。
- 未选滤镜：路径 `export-filter-NONE`；中文页面标题为 `导出滤镜：未使用滤镜`，英文页面标题为 `Export filter: No filter`。
- 事件参数固定为 `event: true` 和 `no_session: true`，因此每次成功导出都计一次。

中英文页面始终使用相同的稳定路径；切换语言只改变后台可读标题，不会拆分同一滤镜的计数。

在 GoatCounter 后台选择日期范围，然后在路径列表中搜索 `export-filter-`。按计数排序即可看到用户最常导出的滤镜；`NONE` 可用于判断未使用滤镜的导出占比。

## 数据边界

GoatCounter 接收页面路径 `/`、页面标题、referrer，以及用于聚合报表的粗粒度浏览器、设备、屏幕宽度和国家信息。访客侧不写入 Cookie、localStorage 或广告标识。

导出事件仅增加稳定的滤镜 ID 和页面上已公开的当前语言名称。下列内容不会发送到 GoatCounter：

- 照片、图像字节、文件名、导出文件名和图片元数据
- 颗粒、暗角、漏光、强度和导出画质等调节参数
- LUT 文件内容、本地缓存、渲染结果和任何个人标识

## 排除、故障与停用

打开 `https://film.richis.top/#toggle-goatcounter` 可按提示切换当前浏览器的排除状态；也可在 `Settings → Tracking → Ignore IPs` 排除固定管理 IP。

广告拦截器或网络可能阻止 `gc.zgo.at` 或 `*.goatcounter.com`。统计失败时不显示提示，也不影响滤镜预载、图片打开、预览和导出。导出时如采集脚本还未就绪，页面最多在后台重试三秒后静默放弃，不会阻塞下载。

临时停用时，从生产环境删除 `VITE_GOATCOUNTER_URL` 并重新构建；无需修改编辑器代码。永久停用或删除数据时，使用 GoatCounter 后台的账户删除功能。
