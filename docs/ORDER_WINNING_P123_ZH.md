# 拿订单优先三件 · P1 / P2 / P3（PitchPro）

> Asia/Shanghai · 面向 Flow A：聊方案 → 选设计 → 叙事长图 → 产品提案 → 场景视频 → 出素材 → 跟进

## P1 — 聊方案硬门禁

- **何时**：右侧点「确认简报，进入选设计」→ `POST /api/pitchpro/projects/:id/brief` → `confirmBrief`
- **必须**：`constraints` 内齐备 `priceBand` / `moq` / `leadTime`
  - 具体数字或区间，**或**显式写 `本次暂无`（亦认：暂无 / 暂缓 / deferred）
  - 禁止用 TBD / 待补充 / 未定 / 待共创确认 蒙混
- **来源**：BRIEF 结构化字段；对话启发式抽取；系统提示词 HARD GATE 追问
- **UI**：简报卡展示三项状态；缺项时琥珀色提示；服务端仍硬拦并返回中文错误

## P2 — 提案吃真资料

- 企业资料库上传（txt/md/csv/json + 粗抽 PDF 文本）写入 `textPreview`
- 生成/刷新提案大纲时：`buildFactoryMaterialsNoteFromAssets` → `factoryMaterialsNote` → 画册「工厂交付」资料库引用
- MVP：列出文件名 + 可摘录正文；完整 OCR/表格解析可后续加强

## P3 — ZIP 整包

- 出素材「下载 ZIP 整包」→ `GET /api/pitchpro/projects/:id/export?format=zip`（需登录）
- 包内：`01-manifest/`（markdown + MANIFEST.json + delivery-facts.json）、`02-proposal/` PDF、`03-concepts/`、`04-long-images/`、`05-video/`（若有）、`06-outreach/`
- 缺件写入 `MANIFEST.json.missing`，不阻断整包下载

## 验收

1. 无价格/MOQ/交期（也无「本次暂无」）时确认简报失败并见中文说明  
2. 上传报价 txt 后重生素材/提案，交付章出现资料引用  
3. 出素材可下一份 ZIP，含清单与已生成文件  
