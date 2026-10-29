# 场景视频 · 后台已成片前台无预览修复

> 2026-10-28 Asia/Shanghai · P01 https://pitchpro.p01.ccwu.cc · 版本标记 `video-poll-resume-20261028`

## 现象

lk888 / 供应商后台任务已 **success**，工作台右栏仍停在「生成中」，左聊无 `VIDEO_READY` 打开/下载。

## 根因（非「传送慢」本身）

1. **确认后客户端轮询会停**：`onConfirmVideo` 原先约 40×8s（~5.3 分钟）后硬抛错；用户刷新/离开后 **没有恢复轮询**。供应商晚一点成功时，PitchPro **从未** `poll-video` → 下载 `result_url` → 落 R2 → 写 `fileUrl` / `VIDEO_READY_MARKER`。
2. **成功判定偏窄**：轮询只信英文 `state`；`result_urls` / 嵌套 URL、以及偶发中文状态未充分兜底时，即使后台已有成片 URL 也一直当「进行中」。
3. **成片下载/落库失败会打断闭环**：Worker 拉 CDN 或写 R2 超时会让整次 poll 抛错，前端停轮询；交付物仍 `generating`，但无人再试。

右栏预览依赖 `deliverable.fileUrl`（`/api/pitchpro/projects/:id/video`）；左聊下载依赖 `VIDEO_READY_MARKER`。二者都只在 **poll 成功落库之后** 出现，与供应商后台是否已成功不是同一件事。

## 修复

1. `lk888-video.ts`：更宽的 `result_url` 提取；有 HTTPS 成片 URL 即视为 completed；中文成功/失败标签防御映射（仍优先 `state` + URL，不用 `status_group` 单独拍板）。
2. `pollVideoJob`：供应商已成功但下载/落库失败时 **保持 generating + taskId**，下次 poll 可重试落库。
3. `VideoPanel`：`status === 'generating'` 时 **自动每 ~8s resume poll**（覆盖超时/刷新）。
4. 确认循环加长到 ~90×8s，瞬时 poll 错误继续试；软超时不再硬失败，交给右栏 resume。

## 验收

1. 点「确认并生成视频」后即使超过 5 分钟，留在场景视频步应自动出现预览/下载。
2. 供应商后台已成功、工作台仍 generating：打开/刷新场景视频步，无需再提交，应自动同步成片。
3. 左聊出现打开/下载；右栏可播；`GET /api/pitchpro/projects/:id/video` 200。
