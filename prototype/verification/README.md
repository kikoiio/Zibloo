# 云端原型验证

用户授权使用 `kikoiio/Zibloo` 的 GitHub Actions 验证本版原型。浏览器及依赖安装只在云端运行，不在本机启动浏览器自动化。

工作流：`/.github/workflows/prototype-review.yml`。验证分支：`codex/prototype-b2-c3`。

使用官方 Playwright 1.64.1，单个 Chromium 顺序执行各场景：1280、768、390、320 像素宽度；入口可见与互不遮挡、横向溢出、原图一致性、整体悬浮/专注/减少动态效果、鼠标与键盘/触屏操作、训练与快捷计时、完整专注短休息/长休息循环、提醒增改启停删除、英语界面。

2026-10-24 更新为 2D 原图路线：删除 WebGL/3D 倾斜检查，改测整图点按反馈、取消按压、安静专注；新增桌面/手机点击游动、循环摆动、短暂气泡尾迹、途中改向、边界、复位、方向键、减少动态效果与离开后返回主页的检查。[本轮运行通过](https://github.com/kikoiio/Zibloo/actions/runs/40108876723)，验证提交 `19511fc767a8befdb1f93060b890ea34fb41f037`；[截图与完整记录](../review/2d-swimming-2026-10-24/README.md)。

专注长时流程使用浏览器模拟时钟推进，不等待真实几十分钟。云端浏览器结果不能替代安卓真机后台、锁屏与重启可靠性验收。

Artifacts：截图与 `observations.json`，保留 7 天。[本次运行已通过](https://github.com/kikoiio/Zibloo/actions/runs/39733464150)，验证提交 `0f48b64360e28d2e0b4f5f59e08513d2918a4bb2`。本机保存的[截图与检查记录](../review/p0-v2-2026-10-22/README.md)可继续用于用户评审。

用户已否决手工重画角色与字标；当前检查直接引用已选原图、没有重画路径，并核对整体悬浮、游动、摆动与静止状态。当前原型使用整图动作及气泡反馈，不声称实现独立腕足动画。

恢复版[运行已通过](https://github.com/kikoiio/Zibloo/actions/runs/39744898017)，提交 `e65808dddd22a4b837a54ddd7191aa26f1b26c18`。[当前截图与记录](../review/approved-originals-2026-10-22/README.md)。

## 声音检查

新增云端检查：快捷 Start 在用户手势中启用 AudioContext、完成回调输出实际非零波形、专注工作/休息切换不受训练引导关闭影响、关闭训练引导仍有完成声、全局静音抑制提示。浏览器使用默认自动播放策略，不添加绕过标记。

独立试听页检查 40 个 WAV 解码、样本峰值与非静音信号、单段播放/切换/串联队列/停止、候选刷新后保存、1280/390/320 宽度。实际音色、情绪和提醒效果仍由人试听；云端波形不能替代手机扬声器、环境噪声与锁屏验收。

本次[声音验证已通过](https://github.com/kikoiio/Zibloo/actions/runs/39748474988)，提交 `1788fd517b6ab3263eef7f280689fb85c8559e1e`；[截图和检查记录](../review/sound-exploration-2026-10-22/README.md)。

第二轮叫名试听[最终云端检查通过](https://github.com/kikoiio/Zibloo/actions/runs/39751960844)，提交 `460780496667a3c36ef995e7cd89f2a7250c212e`；[截图与检查记录](../review/name-voice-round2-2026-10-22/README.md)。

第三轮[临时声音与计时接入检查通过](https://github.com/kikoiio/Zibloo/actions/runs/39756434941)，提交 `0e7b0d513e220207b9136588b4f611d185f29842`；[截图与记录](../review/temporary-voices-2026-10-22/README.md)。

## E/G 已选预设

用户选定 E/G 后，验证改用音频 Buffer 实际播放检查，保留静音/计时流程回归。十个文件与原件 SHA256 一致，十个场景试听映射正确，默认 E、G 保留、旧偏好迁移、角色/提醒预览、无旧振荡器播放及中英三种设置宽度通过。

[运行通过](https://github.com/kikoiio/Zibloo/actions/runs/39757963993)，提交 `251ae33b2655340f7ba58ae994bfc8ef41881339`；[截图与记录](../review/selected-voices-2026-10-22/README.md)。
