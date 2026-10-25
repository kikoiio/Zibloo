# P0 原型档案(已删除)

P0 交互原型 `p0-v2` 已于 2026-10-24 完成使命并彻底删除(连同早期被否决的 3D 路线产物与手工重画稿)。本页保留其验证结论的索引,完整截图与 observations 在 git 历史的 `prototype/` 目录中可查。

## 原型验证过什么

以 B2/C3 已选原图与五姿态帧(四帧划水循环 + 抬爪招呼)验证了:主页小窝布局与三模式入口、快捷计时、训练模板与参数、番茄钟长休息、暂停/继续/跳段/结束、提醒增改启停删除、历史、中英双语、E/G 声音接入、减少动态效果适配。

## 云端验证记录(GitHub Actions)

| 内容 | 结果 | 链接 |
|---|---|---|
| 恢复原图版(引用一致/布局/主要流程) | 通过 | [run 39744898017](https://github.com/kikoiio/Zibloo/actions/runs/39744898017) |
| 声音探索(8 音色 × 4 段) | 通过 | [run 39748474988](https://github.com/kikoiio/Zibloo/actions/runs/39748474988) |
| 第二轮叫名试听 | 通过 | [run 39751960844](https://github.com/kikoiio/Zibloo/actions/runs/39751960844) |
| 第三轮临时声音接入计时器 | 通过 | [run 39756434941](https://github.com/kikoiio/Zibloo/actions/runs/39756434941) |
| E/G 已选预设接入 | 通过 | [run 39757963993](https://github.com/kikoiio/Zibloo/actions/runs/39757963993) |
| 2D 整图游动 | 通过 | [run 40109793609](https://github.com/kikoiio/Zibloo/actions/runs/40109793609) |
| 五姿态帧动画(最终一轮) | 通过 | [run 40117331256](https://github.com/kikoiio/Zibloo/actions/runs/40117331256) |

## 资产去向

- B2 五姿态帧、C3 字标 → `static/zibloo/`
- E/G 十段叫声(含哈希清单) → `static/sounds/`
- 已选 B2/C3 概念板原件 → `docs/brand/references/`
