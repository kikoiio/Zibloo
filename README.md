# Zibloo

一只陪你计时的章鱼。安卓 App 与网页版同一套代码。

Zibloo 陪你做间歇训练、专注计时和生活提醒。产品意图与当前实现见 [`docs/README.md`](docs/README.md)。

## 运行

```sh
npm install
npm run dev        # 开发服务器
npm run test       # 单元与属性测试
npm run check      # 类型检查
npm run build      # 静态站点
npm run smoke      # 网页冒烟(需先 build)
```

调试 APK 由 GitHub Actions 的 `Android APK` 工作流产出。网页版不承诺锁屏或杀进程后的提醒。
