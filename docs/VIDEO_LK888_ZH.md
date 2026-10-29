# 场景视频 · lk888（主线 GK-video-3.5／MC-GK1.5官转 · 备用 MiniMax H3／RQ2）

> 2026-10-28 Asia/Shanghai · P01 https://pitchpro.p01.ccwu.cc · Flow A

## 流程（确认门）

1. 产品提案 PDF 对齐后进入 **场景视频**
2. 左聊插入「呈品 · 视频」**5 段式提示词**（工程师规格；结合锁定概念 + 叙事长图 + 产品提案）
3. 可对话改写具体名词 / 分镜 / 声音；左聊/右栏会做 **HTTPS 参考图预检**（缺图则警告将回退 MiniMax）；并提示常需重跑 3–5 次；定稿后点 **「确认并生成视频」**；失败后左聊有 **重新生成视频** CTA
4. 提交 lk888 `POST /v1/media/generate`（主线 `gk-video-3.5`／MC-GK1.5官转；提交失败或缺参考图则一次回退 `minimax-h3`／RQ2）
5. 客户端每 ~8s 轮询 `poll-video` → `GET /v1/media/status?task_id=`；主线任务 `failed` 且尚未回退时再提一次备用模型
6. 成功后拉 `result_url` 落 R2，`fileUrl=/api/pitchpro/projects/:id/video`
7. 左聊打开/下载；右侧「视频」Tab 预览；可改大纲后再次确认覆盖

详见 `VIDEO_PROMPT_ENGINEER_ZH.md`。

**语种 / 人文锁定：** 画面字与旁白跟 `resolveOnImageLanguage(project.country)`；人物着装／光线跟 `resolveMarketCulture`；场景须来自品牌生活世界／叙事；非中国市场禁止中文。

## API 形状（实测）

### 提交

```
POST https://api.lk888.ai/v1/media/generate
Authorization: Bearer <key>
Content-Type: application/json

{
  "model": "gk-video-3.5",
  "prompt": "<flat engineer prompt>",
  "params": {
    "images": ["https://..."],   // gk 必填，数组即使只有 1 张
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "duration": "10"             // select 值用字符串亦可数字
  }
}
```

成功（异步）：

```json
{"code":200,"data":{"task_id":193830513,"task_ids":[193830513],"成功数量":1},"msg":"任务创建成功"}
```

偶发同步直返：`data.url` / `data[0].url`（代码以 `direct:<url>` 记任务）。

### 轮询

```
GET https://api.lk888.ai/v1/media/status?task_id=<id>
Authorization: Bearer <key>
```

```json
{
  "task_id": 193830513,
  "state": "pending|running|success|failed",
  "is_final": false,
  "progress": "0",
  "result_url": "",
  "result_urls": [],
  "error": "",
  "cost": 0.696
}
```

终态：`is_final===true`；成功取 `result_url`（或 `result_urls[0]`）下载。**不要**用中文 `status` / `status_group` 做业务判断。  
`/v1/media/tasks/{id}` 不存在（404）。

### 模型差异

| 模型 | API name | 展示名 | 线路 | 要点 |
|---|---|---|---|---|
| 主线 | `gk-video-3.5` | GK-video-3.5 | **MC-GK1.5官转** | **仅图生视频**；`images` 必填 1 张；时长 1–15；分辨率 `720p`/`480p` |
| 备用 | `minimax-h3` | MiniMax H3 | **RQ2** | 文生 / 首尾帧 / 参考生；时长 4–15；分辨率 `768P`/`1080P`/… |

本 Key 的 `GET /v1/models` 可见：`gk-video-3.5`、`minimax-h3`、`MiniMax-H3`。

## 默认参数（PitchPro）

| 项 | 值 |
|---|---|
| base | `https://api.lk888.ai` |
| model | `gk-video-3.5` |
| fallback | `minimax-h3` |
| duration | 10s |
| aspect_ratio | 16:9（横屏 · 720p HD） |
| resolution | 720p（主线）/ 768P（备用） |
| referenceImages | 锁定概念图优先作首帧；叙事长图可作备用参考 |

## 配置

Admin AI → Video Generation，或 D1 `config`：

- `video_api_key`（或 Workers secret `VIDEO_API_KEY` / `LK888_VIDEO_API_KEY`；兼容旧 `WUYEAI_API_KEY`）
- `video_base_url` = `https://api.lk888.ai`
- `video_model` = `gk-video-3.5`
- `video_model_fallback` = `minimax-h3`
- `video_duration` = `10`
- `video_ratio` = `16:9`
- `video_resolution` = `720p`（主线 GK；备用 MiniMax 代码侧默认 768P）

## 验收

1. 场景视频左聊「呈品 · 视频」+ 5 段式 +「确认并生成视频」
2. 点确认后生成中 → 完成后左聊/右栏可播可下
3. 无公网参考图时自动走 MiniMax H3；主线失败时自动回退一次
4. Admin 默认模型显示主线 gk-video-3.5（MC-GK1.5官转）/ 备用 minimax-h3（RQ2）；默认画幅 **16:9**、主线分辨率 **720p**
5. 成片后左聊可内联播放预览，并保留打开／下载

> 修复 `video-poll-resume-20261028`（Version `87a0c56b-a0dc-4bcc-b65c-cfa85bce8e0e`）：供应商已成功时，右栏会自动 resume `poll-video` 落 R2 并出预览/下载。详见 `VIDEO_POLL_RESUME_FIX_ZH.md`。
