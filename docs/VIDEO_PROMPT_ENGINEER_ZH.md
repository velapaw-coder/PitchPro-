# 场景视频 · 视频提示词工程师（PitchPro 实现）

> 2026-10-28 Asia/Shanghai · 落地于 Flow A「场景视频」步 · P01 https://pitchpro.p01.ccwu.cc

## 角色

左聊「呈品 · 视频」按 **B2B 外贸商业提案视频提示词工程师** 交付：可编辑的 **5 段式** Markdown 大纲，再压平为 lk888 / GK-video-3.5（失败回退 MiniMax H3） 生成提示词。

视频类型：**共创产品的生活方式品牌短片**（海外 B2B / 品牌决策人），不是电影化短剧，也不是「系统上传 PDF」元演示。

## 输入物料

| 来源 | 用途 |
|---|---|
| 锁定概念（title / direction / summary + 主视觉） | 产品外观一致性锚点 |
| 叙事长图文案（PDP，去 marker） | 生活方式 / 使用仪式场景 |
| 产品提案大纲（proposal，去 PDF storage marker） | Who / Why / How 商业动机 |
| 参考图 URL | 概念图 + 已选长图 → `referenceImages` |

## 左聊 5 段式结构

1. **【核心主题】** tag（画面类型 → 题材 → 受众 → 美学）
2. **【人物与设定】** 人物 / 产品道具（≥2 处微瑕）/ 场景
3. **【氛围与画质】** 摄影机+镜头 + 品牌色 + 主光（产品 85mm / 环境 32mm）
4. **【运镜规则】** 方式 / 角度 / 呼吸感微浮动
5. **【分镜】** 0-2s / 2-4s / 4-6s / 6-8s 业务动作 + **【声音】**
6. 附：负面提示词、一致性锁定、验证建议（GK-video-3.5 · ~10s 先验证，常需 3–5 次重跑）

语种策略：CN → 全中文大纲；English → 全英文大纲；其它语种 → 英文结构标签 + 旁白/画面字/分镜动作示例用当地语言（`resolveOnImageLanguage`）。人文规范：`resolveMarketCulture` 仅提供人物着装／光线／语种示例（非场景模板）；场景须来自品牌生活世界／叙事；禁止国家默认咖啡／厨房／客厅／办公室；非 CN 禁止中国大陆默认审美与中文画面字。

## 代码入口

- `buildVideoOutlineMd` / `buildWuyeVideoPrompt` — `src/modules/pitchpro/service.ts`
- `ensureVideoChatMessage` — 进入场景视频时插入/刷新 5 段式大纲
- `confirmVideo` — 压平提示词并提交 lk888
- `buildChatSystemPrompt(stage=video)` — 对话改写时保持工程师规则

## 硬性规则（摘要）

- 具体名词，禁空泛「高端商务感」
- 必须写摄影机+镜头、呼吸感、声音、≥2 产品微瑕
- 负面：logo 变形、乱码、产品漂移、坏手、游戏 CG、抖动
- 不出现真实第三方商标名，只写视觉特征
- 画面/旁白语种与当地人文锁定（非 CN 禁中文与 CN 默认审美）

## 与叙事生图工程师联动

上游长图提示词见 [NARRATIVE_IMAGE_PROMPT_ENGINEER_ZH.md](./NARRATIVE_IMAGE_PROMPT_ENGINEER_ZH.md)。视频侧应沿用同一产品外观、品牌色与市场语种/人文锁定；静帧相机套件（Sony A7R5）与动态套件（Alexa Mini + Cooke）可不同，但产品与色调不得漂移。
