# 叙事长图 · 品牌生活方式详情长图提示词（PitchPro 实现）

> 2026-10-29 Asia/Shanghai · 落地于 Flow A「叙事长图」步 · P01  
> 淘宝式竖版品牌详情长图：讲**该品牌**人群、向往身份、生活世界与产品如何融入。  
> **不是** 国家默认咖啡／厨房／客厅／办公室模板；**不是** 冲突／痛点 → 解决方案戏剧弧。  
> 下游对接 [VIDEO_PROMPT_ENGINEER_ZH.md](./VIDEO_PROMPT_ENGINEER_ZH.md)。

## 角色

左聊「呈品 · 叙事师」对齐 **品牌生活世界详情长图会讲什么**；确认后 Seedream 按用户给定的 **全球品牌产品延伸生活方式叙事长图** 模板出两张竖版详情长图。

核心：用画面展示制造商产品成为客户品牌旗下新品后，如何自然进入该品牌消费者**真实且向往的生活世界**。

## 两张长图 ↔ 叙事阶段

| 方案 | imagePart | 画面重心 |
|---|---|---|
| A（variant 1） | **A** | 品牌人群、向往生活、社交活动、环境与品牌精神；产品自然融入 |
| B（variant 2） | **B** | 延续 A 的品牌世界；产品实际参与生活；积极收束 |

两张共享 **系列一致性锁定**：产品外观（概念参考图）、品牌主辅色、人物关系（仅改情绪／姿态）、同一品牌生活世界（允许换地点／景别）。相机语言**按品牌调性与指定场景选定后系列锁定**（不固定所有品牌同一 Sony 85mm）。

## 动态输入（写入 Seedream）

客户品牌名称 · 品牌定位与调性 · 目标人群 · 向往身份 · 品牌生活世界 · **本张图指定场景** · 社交关系与生活活动 · 制造商产品资料 · 产品参考图锁定 · 产品使用与融合方式 · 目标市场 · **当地文化与人物规范（非场景）** · 本土化文案及语言 · 品牌视觉 · 系列一致性 · imagePart=A|B

字段优先来自 PDP_JSON 扩展（`lifestyleWorld` / `selectedScenes` / `socialDynamics` / `aspirationalIdentity` / `productRole` / `targetAudience`），其次叙事正文标签段落，再次设计方向／摘要。**禁止回退到国家咖啡厨房默认。**

## 场景硬规则

- 严格采用已确认的品牌生活世界与本张指定场景  
- 根据人群真实生活、社交关系、兴趣活动、向往目的地和产品角色构建  
- **禁止**国家默认生活模板；**禁止**仅根据行业机械决定场景  
- 居家／咖啡／办公等仅当**品牌依据明确**时允许  

`resolveMarketCulture` 只提供：区域键、着装文化、气候光线、图上语种示例、是否禁 CN 审美。其 `lifestyleSpaces` / `rituals` 字段现为**人物与社交文化规范说明**，**不得**当作可粘贴的场景列表。

## 硬性规则（摘要）

- 具体名词；产品外观锁定参考图；≥2 产品微瑕 + 人物微瑕  
- 图上文案：`resolveOnImageLanguage`；非 CN 禁中文与 CN 默认审美  
- 禁止冲突／痛点戏剧；禁止摆拍强行手持；禁止外观漂移／虚构功能  
- 竖版约 1:3；高水平商业摄影；不固定所有品牌同一镜头滤镜  

## 代码入口

- `buildPdpLongImagePrompt` — `src/modules/pitchpro/service.ts`（品牌生活世界模板 → Seedream）  
- `resolveBrandLifestyleForPrompt` — `src/modules/pitchpro/pdp-copy.ts`（从叙事／PDP_JSON 解析生活世界字段）  
- `buildChatSystemPrompt(stage=pdp)` — 左聊叙事师：强制聊清人群／向往／生活世界／场景／社交／产品融入  
- `buildPdpNarrativeIntro` — 首次叙事稿引导  
- `resolveMarketCulture` — 仅人物／语言／光线规范（非场景模板）  
- `confirmNarrative` — 确认后异步出两张长图  

## 与视频工程师联动

| 锁定项 | 叙事生图 | 场景视频 |
|---|---|---|
| 产品外观 | 概念参考图 + designTitle | 同 + 长图参考 |
| 品牌色 | designDirection | 同 |
| 场景 | 品牌生活世界／叙事确认 | 同（禁止国家默认居家咖啡厨房办公室） |
| 相机套件 | 按品牌选定后系列锁定 | Alexa Mini + Cooke（动态） |
| 语种／人文 | `resolveOnImageLanguage` / `resolveMarketCulture`（人物规范） | 同 |

链路：品牌生活世界对齐 → **生活方式详情长图** → 场景视频。
