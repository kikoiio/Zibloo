# Zibloo

Zibloo 是个人热点与计时看板,提供 Android App 和同源网页。

- 打开后可按来源浏览 GitHub、Hacker News、Lobsters 等社区热点,收取后在卡片里记笔记并打开来源。
- 训练、专注和快捷计时都在看板卡片上运行,支持多张同时计时。
- Android 使用原生闹钟处理后台计时段边界;网页仅保证页面存活期间的计时。

产品范围见 [`docs/intent.md`](docs/intent.md),当前实现和架构见 [`docs/architecture.md`](docs/architecture.md)。

## 本地开发

```sh
npm ci
npm run dev       # 开发服务器
npm run check     # Svelte / TypeScript 检查
npm test          # 单元与属性测试
npm run build     # 静态网页构建
npm run smoke     # 构建产物上的 Playwright 冒烟(需安装 Chromium)
```

开发环境通过 Vite 代理收取跨域热点;Android 使用 CapacitorHttp。静态网页部署没有该代理,部分来源可能受浏览器跨域策略限制。

Android debug APK 由 GitHub Actions 的 `Android APK` 工作流构建。真机验收步骤见 [`docs/runbooks/device-acceptance.md`](docs/runbooks/device-acceptance.md)。
