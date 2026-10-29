> **已切换：** 生产视频走 lk888，见 `VIDEO_LK888_ZH.md`。本文保留 wuyeai/ss-2.0 历史说明。

# 场景视频 · wuyeai（ss-2.0-720p-v1）

> 2026-10-28 Asia/Shanghai · P01 https://pitchpro.p01.ccwu.cc · Flow A

## 流程（确认门）

1. 产品提案 PDF 对齐后进入 **场景视频**
2. 左聊插入「呈品 · 视频」**5 段式提示词**（工程师规格；结合锁定概念 + 叙事长图 + 产品提案）
3. 可对话改写具体名词 / 分镜 / 声音；定稿后点 **「确认并生成视频」**
4. 提交 wuyeai `POST /v1/videos`（提示词已含摄影机/镜头、呼吸感、微瑕、负面约束）
5. 客户端每 ~8s 轮询 `poll-video`；完成后落 R2，`fileUrl=/api/pitchpro/projects/:id/video`
6. 左聊打开/下载；右侧「视频」Tab 预览；可改大纲后再次确认覆盖

详见 `VIDEO_PROMPT_ENGINEER_ZH.md`。

**语种 / 人文锁定：** 画面字与旁白跟 `resolveOnImageLanguage(project.country)`；人物着装／光线跟 `resolveMarketCulture`；场景须来自品牌生活世界／叙事（禁止国家默认咖啡厨房办公室；非默认中国审美）；非中国市场禁止中文画面字/旁白。

## 默认参数

| 项 | 值 |
|---|---|
| model | `ss-2.0-720p-v1` |
| duration | 10s（ss 仅 5/10/15；方向验证优先，常需 3–5 次重跑） |
| ratio | 16:9 |
| resolution | 720p |
| referenceImages | 锁定概念图 + 已选叙事长图（公网 URL，最多 9） |

默认不传首尾帧 / 参考视频 / 参考音频（ss-2.0-720p-v1 不支持参考视频与音频）。

## 配置

Admin AI → Video Generation，或 D1 `config`：

- `video_api_key`
- `video_base_url` = `https://www.wuyeai.cn/v1`
- `video_model` = `ss-2.0-720p-v1`（代码默认；Admin 覆盖优先于代码）
- `video_duration` = `10`（仅 5/10/15）
- `video_ratio` = `16:9`（PitchPro 现默认；本文件为旧 wuyeai 说明，现网见 VIDEO_LK888_ZH.md）

也可 Workers secret `WUYEAI_API_KEY`（运行时回退）。

## API

| 调用 | 作用 |
|---|---|
| `POST .../deliverables` `confirm-video` | 提交任务 |
| `POST .../deliverables` `poll-video` | 轮询并在完成时落库 |
| `GET .../video` | 鉴权预览/下载 |

## 验收

1. 场景视频左聊出现「呈品 · 视频」+ **5 段式**提示词 +「确认并生成视频」
2. 大纲含核心主题 / 人物与设定 / 氛围与画质（摄影机+镜头）/ 运镜 / 分镜 / 声音 / 负面与验证建议
3. 点确认后生成中 → 完成后左聊/右栏可播可下
4. 对话改写后仍输出完整 5 段式；再确认可重新生成
