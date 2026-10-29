# 单张概念图改图（ChatGPT 式工具条）

已上线 P01：https://pitchpro.p01.ccwu.cc

## UX

- 左侧聊天概念图悬停：底部深色胶囊工具条（握把 + 图标/中文）
  - **放大** / **按说明改** / **移除背景** / **重生这张**
  - **标注** / **擦除** 灰显，tooltip「下期」
- 灯箱：同款工具条 + 底部改图说明输入框 +「按说明改这张」
- 右侧仍只做锁定/确认，不填改图表单

## API

`POST /api/pitchpro/projects/:id/designs/:designId/refine`

Body: `{ instruction?: string, mode?: 'edit' | 'regen' | 'remove-bg' }`

优先 Seedream **i2i**（`/images/generations` + `image` 参考原图）；失败则 **t2i** 按原方向单槽重生。只更新该 concept 的 `imageUrl`，保留 `locked`。聊天写入短说明 + 新图（`![title§designId](url)`）。

## 验证

1. 登录 `admin@pitchpro.p01.local`
2. 工作台进入已有概念图项目（或确认简报后生成）
3. 悬停左侧某张概念图 → 点「按说明改」→ 灯箱写说明 → 提交
4. 仅该张更新；聊天出现改图备注；若已锁定仍保持锁定
5. 「移除背景」「重生这张」各试一次

视频仍未接。
