# 产品提案 · 左聊大纲 → 确认生成带图画册 PDF

> 2026-10-28 Asia/Shanghai · P01 https://pitchpro.p01.ccwu.cc

## 流程（确认门）

1. 右侧确认详情页 → stage=`assets` → 生成素材包（提案先为 **Markdown 大纲**，`fileUrl` 空）
2. 左聊插入「呈品 · 提案」大纲（**品牌市场语种**，与 `resolveOnImageLanguage` 一致）
3. 用户可在左侧对话修改大纲
4. 点 **「确认并生成 PDF」** → `confirmProposalPdf`：
   - 取最新提案大纲（聊天优先）
   - `pdf-lib` 生成 **带图画册 PDF**：封面主张 + Who / Why now / How 正文 + **锁定概念图** + **叙事长图**（已选优先，可选备选）
   - 存 R2 / 本地，`fileUrl=/api/pitchpro/projects/:id/proposal-pdf`
   - 左聊追加 PDF 链接消息；可再次修改后重新确认覆盖
5. 右栏「产品提案」Tab 可打开 / 下载；「导出整包」Markdown 含提案与图片 URL 元数据（视频候补）

## API

| 调用 | 作用 |
|---|---|
| `POST .../pdp` `confirm` | 进出资材 + 左聊大纲（**不**锁 PDF） |
| `POST .../deliverables` `confirm-proposal` | 生成/覆盖带图画册 PDF，返回 `chatMessage` + `fileUrl` |
| `GET .../proposal-pdf` | 鉴权下载/预览 PDF |

## 出素材 Tab

| Tab id | 展示 |
|---|---|
| `pdp` | **叙事长图**（生活方式详情长图预览/打开，非电商网页） |
| `proposal` | 大纲 + PDF 链接 |

## 验收

1. 确认详情页后左聊出现市场语大纲 +「确认并生成 PDF」
2. 点按钮后左聊出现 PDF 链接，右栏提案 Tab 可打开 PDF；PDF 内含概念图与叙事长图
3. 出素材「叙事长图」Tab 可见已确认长图预览
4. 改大纲再点一次，PDF 更新
