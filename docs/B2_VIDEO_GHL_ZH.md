# 第二批 · B2-1 视频预检 / 重试 · B2-2 跟进 / GHL（PitchPro）

> Asia/Shanghai · Flow A：… → 场景视频 → 出素材 → 做跟进  
> P01 https://pitchpro.p01.ccwu.cc

## B2-1 视频预检与重试 UX

- **何时**：进入场景视频左聊「呈品 · 视频」/ 右栏物料齐套；点「确认并生成视频」前
- **预检**：锁定概念图 + 叙事长图是否为**公网 HTTPS**（`https://`）
  - 主线 GK-video-3.5（MC-GK1.5官转）为图生视频，缺 HTTPS 参考图 → 提示将回退 MiniMax H3（RQ2）
  - 右栏琥珀色警告；左聊正文含预检行
- **成本提示（中文）**：常需重跑 **3–5** 次；默认约 **10s · 16:9 · 720p**；主线 GK-video-3.5（MC-GK1.5官转）/ 备用 MiniMax H3（RQ2）
- **失败**：左聊 `VIDEO_FAILED_MARKER` + 清晰说明 + **「重新生成视频」** CTA；提交失败也会写入失败气泡（不只靠轮询）

## B2-2 做跟进 / GHL

- **始终**提供可复制开发信（主题 / 正文 / 全文），语种跟 `resolveOnImageLanguage(project.country)`
- **有** `GHL_API_KEY` + `GHL_LOCATION_ID` → 徽章 **Live · 真实 GHL**，点「确认同步到 GHL」真推送
- **无**密钥 → 徽章 **预览 / Mock**（不假装 Live）；按钮「写入本地预览记录」；仍可复制开发信外发

## 验收

1. 场景视频步可见参考图预检 + 3–5 次重跑提示  
2. 故意缺 HTTPS 参考图时有回退警告；失败后左聊出现「重新生成视频」  
3. 跟进步始终能复制开发信；无 GHL 密钥时徽章为「预览 / Mock」而非 Live  
