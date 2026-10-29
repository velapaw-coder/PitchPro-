# 详情长图生成中的加载提示

点「确认这版叙事」后 Seedream 双长图约需 1–2 分钟，需明确进度，避免用户以为无响应。

## 行为
- 左侧：立刻出现用户气泡；助手气泡「正在按叙事生成两张详情长图…（约 1–2 分钟）」；按钮禁用并显示「长图生成中…」
- 右侧：spinner + ETA 进度条文案
- 概念重生：同样左右提示「约 1–2 分钟」
- 单张 refine：沿用图上「正在改这张…」

## 事件
- `pitchpro:long-images-generating` / `emitLongImagesGenerating`
- `pitchpro:designs-generating` / `emitDesignsGenerating`
