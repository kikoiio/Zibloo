# Zibloo

Zibloo 是个人热点与计时看板,当前只开发和维护网页端。其他平台的开发已暂停。

- 在一条信息流里发现 GitHub、Hacker News、Lobsters 等社区项目,搜索并收藏感兴趣的条目,查看原始指标和来源。
- 看板提供一个可调时长的计时器,支持暂停、继续和结束。
- 计时提示音依赖网页运行;浏览器在后台可能降低计时精度,关闭页面后不会触发计时提示。

产品范围见 [`docs/intent.md`](docs/intent.md),当前实现见 [`docs/architecture.md`](docs/architecture.md)。

## 本地开发

```sh
npm ci
npm run dev       # 开发服务器
npm run check     # Svelte / TypeScript 检查
npm test          # 单元与属性测试
npm run build     # 静态网页构建
npm run smoke     # 构建产物上的 Playwright 冒烟(需安装 Chromium)
```

开发环境通过 Vite 代理收取跨域热点;静态网页部署直接请求来源,部分来源可能受浏览器跨域策略限制。网页 CI 见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。
