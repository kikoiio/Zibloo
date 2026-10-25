# Zibloo

一只陪你计时的章鱼:计时器 App(Android + 网页版,同一套代码)。Zibloo 是产品的灵魂、导航的载体、声音的签名和品牌的全部。

- 产品需求:`docs/PRD.md`
- 架构定稿:`docs/arch/A0-architecture.md`(Svelte 5 + SvelteKit 静态站点 + Capacitor Android,自写 Kotlin 可靠性插件)
- 品牌与角色:`docs/brand/selected-direction.md`;原型验证历史:`docs/prototype-history.md`

## 开发

```sh
npm install
npm run dev        # 开发服务器
npm run test       # Vitest 单元/属性测试
npm run check      # svelte-check
npm run build      # 静态站点构建(adapter-static)
npm run smoke      # 网页冒烟验收(本地需先 build;CI 每次推送自动执行)
```

## 代码结构

```
src/
├─ core/          纯 TypeScript 引擎:计时、提醒规则、Zibloo 状态映射(零框架依赖,单测主场)
├─ state/         Svelte 5 runes store 与副作用编排
├─ platform/      平台端口:AlarmPort/AudioPort/ForegroundPort;web 降级实现,Capacitor 封装
├─ persistence/   Dexie(IndexedDB)仓库
├─ i18n/          typesafe t() + zh-CN/en 资源
├─ zibloo/        ZiblooPresenter.svelte:姿态帧渲染,只吃 ZiblooPresentation
└─ routes/        小窝主页 / 运行页 / 提醒 / 历史 / 设置
static/
├─ zibloo/        B2 五姿态帧、C3 字标
└─ sounds/        已选 E/G 十段叫声(含清单)
android/          Capacitor 工程 + zibloo-alarms Kotlin 插件(闹钟/重启重建/前台服务)
scripts/smoke.mjs 网页冒烟验收(CI 云端执行)
```

架构不变式:时间戳即真值(剩余时间永远是 `f(锚点, now)` 的推导);规则表为唯一事实源,原生调度只是投影;Zibloo 呈现无状态,由 `mapZibloo` 现算;原生层只收绝对时刻。

可靠性(锁屏/后台/重启)由 Android 端 `zibloo-alarms` Kotlin 插件承担(`SCHEDULE_EXACT_ALARM` + BootReceiver 从镜像重建 + 前台服务);调试 APK 由 GitHub Actions 构建分发,必须真机验收(P1,模拟器不算数);网页版不承诺后台可靠性。
