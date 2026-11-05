---
status: superseded
date: 2026-11-01
supersedes: 0007
superseded-by: 0010
---

# 看板按来源分组,去掉侧栏和日报

## 上下文

[0007](0007-single-board.md) 收成一块看板,仍留侧栏在看板和日报之间切换。用过之后不需要侧栏、日报,也不要五列那种并排分栏。暂时只要一块大看板,里面按信息来源分开。

## 决定

- 主页只有一块看板。没有侧栏,没有日报视图。
- 热点卡片按来源分块纵向排列:GitHub、Hacker News、Lobsters、Hugging Face、GitLab、crates.io、DEV、Flathub、Product Hunt、X。每块是标题加卡片网格,整页一起滚。
- 计时卡片单独放在「计时」块,仍可在看板上倒计时。
- 顶栏只留章鱼、搜索、收取。筛选芯片不做。收取仍拉全部来源。

## 后果

`digestTrends` 仍在 `core/trending` 里,这版 UI 不用。点开热点仍可写笔记、打开来源。
