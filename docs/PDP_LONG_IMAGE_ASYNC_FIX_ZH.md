# 详情长图：确认叙事 → 分步双图

## 根因
1. 原 `confirmNarrative` 在 Worker 请求内同步等 Seedream 双图；即使用 `waitUntil` 后台跑，本环境也未可靠完成，D1 长期停在 `generating`/`narrative`，左右无长图。
2. 确认 CTA 不够显眼（仅顶栏 Chip）；用户常在聊天说「按这版做」而未真正触发生成；loading 依赖本地 state，感知弱。

## 修复（已部署 P01）
- 点「确认这版叙事」→ 立刻 `status=generating` + 左聊提示，按钮/左右栏显示「长图生成中…」
- 前端分步调用 `advance-long-images`：每次只生 **1** 张 Seedream（~25–30s），两次后 `ready`，写入 `PDP_LONG_IMAGES` 与左聊双图
- 叙事师消息下方增加醒目按钮「确认这版叙事」；顶栏 Chip；聊天口令（确认这版/生成长图等）同样触发

## 验收（2026-10-28）
Lock Fix Smoke 项目：confirm → tick1 (1/2) → tick2 ready，两张 TOS URL 已入库。
