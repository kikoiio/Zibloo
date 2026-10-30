---
status: accepted
date: 2026-10-24
---

# 叫声预设 E 灵巧啾噜、G 清透轻呼

## 上下文

叫声是训练时不看屏的语义通道,也是品牌签名。原型阶段多轮试听后,用户选定第三轮 E 与 G。第二轮叫名方案已否决;D / F 只作历史试听,不进产品。

## 决定

- 代码 id:`chirrup`(E 灵巧啾噜,默认)、`breeze`(G 清透轻呼)。可静音。
- 每套五段 WAV:招呼、工作、休息、完成、提醒。资产在 `static/sounds/`,哈希见该目录 `manifest.json`。
- 原生侧将同套 WAV 打进 APK `res/raw/`,App 已死时由 MediaPlayer 播放。
- 不重新生成或改变已选音色。更正式的音频设计可后续整套替换,不改 Cue 语义。

## 后果

Cue 只有 `work | rest | complete | greet | reminder` 一套词汇,对应文件名。语音播报是后期功能,不混进这套叫声。
