# 云端原型验证

用户授权使用 `kikoiio/Zibloo` 的 GitHub Actions 验证本版原型。浏览器及依赖安装只在云端运行，不在本机启动浏览器自动化。

工作流：`/.github/workflows/prototype-review.yml`。验证分支：`codex/prototype-b2-c3`。

使用官方 Playwright 1.64.1，单个 Chromium 顺序执行各场景：1280、768、390、320 像素宽度；入口可见与互不遮挡、横向溢出、原图一致性、整体悬浮/专注/减少动态效果、鼠标与键盘/触屏操作、训练与快捷计时、完整专注短休息/长休息循环、提醒增改启停删除、英语界面。

专注长时流程使用浏览器模拟时钟推进，不等待真实几十分钟。云端浏览器结果不能替代安卓真机后台、锁屏与重启可靠性验收。

Artifacts：截图与 `observations.json`，保留 7 天。[本次运行已通过](https://github.com/kikoiio/Zibloo/actions/runs/39733464150)，验证提交 `0f48b64360e28d2e0b4f5f59e08513d2918a4bb2`。本机保存的[截图与检查记录](../review/p0-v2-2026-10-22/README.md)可继续用于用户评审。

用户已否决首次验证中的手工重画角色与字标；当前检查已改为直接引用已选原图、无重画路径，并核对整体悬浮与静止。独立腕足动画待原稿分层后制作，不再声称已验证连续腕足动作。

恢复版[运行已通过](https://github.com/kikoiio/Zibloo/actions/runs/39744898017)，提交 `e65808dddd22a4b837a54ddd7191aa26f1b26c18`。[当前截图与记录](../review/approved-originals-2026-10-22/README.md)。

## 声音检查

新增云端检查：快捷 Start 在用户手势中启用 AudioContext、完成回调输出实际非零波形、专注工作/休息切换不受训练引导关闭影响、关闭训练引导仍有完成声、全局静音抑制提示。浏览器使用默认自动播放策略，不添加绕过标记。

独立试听页检查 40 个 WAV 解码、样本峰值与非静音信号、单段播放/切换/串联队列/停止、候选刷新后保存、1280/390/320 宽度。实际音色、情绪和提醒效果仍由人试听；云端波形不能替代手机扬声器、环境噪声与锁屏验收。

本次[声音验证已通过](https://github.com/kikoiio/Zibloo/actions/runs/39748474988)，提交 `1788fd517b6ab3263eef7f280689fb85c8559e1e`；[截图和检查记录](../review/sound-exploration-2026-10-22/README.md)。

第二轮叫名试听[最终云端检查通过](https://github.com/kikoiio/Zibloo/actions/runs/39751960844)，提交 `460780496667a3c36ef995e7cd89f2a7250c212e`；[截图与检查记录](../review/name-voice-round2-2026-10-22/README.md)。
