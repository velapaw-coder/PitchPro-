# 呈品预发演示路径（Aura Home 一键案例）

线上：https://pitchpro.api2.ccwu.cc  
账号：已注册 Super Admin `xie861861@gmail.com`（密码不在本文档）

## 0. 登录

1. 打开 https://pitchpro.api2.ccwu.cc/sign-in  
2. 用 `xie861861@gmail.com` 登录  
3. 进入 https://pitchpro.api2.ccwu.cc/workbench  

期望：工作台空态或项目列表，无 Oops。

## 1. 一键示范（推荐先跑通）

1. 侧栏或空态点 **「一键示范项目」**  
2. 自动打开 **Aura Home** 项目，阶段在 **出素材**（简报已确认、视觉已锁、5 类素材齐）  

期望：右侧可见概念图 / 产品提案 / 详情页 / 视频 / 开发信 Tab；无空链接、无 `stub://` 地址。

### 出素材

1. 点各 Tab 浏览文案  
2. 点 **「导出整包」** 或 **「导出素材包 (Markdown)」** → 下载 `.md`  
3. 点 **「复制当前文案」** → 提示已复制  
4. 点 **「素材审核通过，进入做跟进」**

### 做跟进

1. 预览联系人（如 Aura Home Buyer）与备注  
2. Badge 显示 **Mock 模式**（未配 GHL）  
3. 点 **「确认同步到 GHL」**  

期望：提示 Mock 同步成功，历史列表多一条 `mode=mock`。

## 2. 手动四步（从零新建）

1. **新建项目** → 进入聊方案  
2. 侧栏打开 **企业资料库**，可加备注/上传（无 R2 时落本地/受限，不挡流程）  
3. **找品牌**：国家/赛道/关键词搜索，或贴官网 URL → 出卡片 → **用于本项目**  
4. 编辑简报字段 → **保存草稿** → **确认简报** → 进入选设计  
5. **选设计**：4 个概念 → **锁定视觉** → 自动进出资材并生成同源包  
6. 同 §1 导出 / 跟进 Mock  

## 3. 页脚与首页（无死链）

| 点击 | 期望 |
|---|---|
| 顶栏「呈品」/ pitchpro | 回首页 |
| 能力 / `#features` | 滚到四步能力区 |
| 工作台 | `/workbench` |
| 方案 /pricing | 定价页（购买需支付配置，可略） |
| 隐私 / 条款 | 有正文 |
| 设置 / 管理后台 | 需登录；管理员可进 `/admin` |

已去掉：文档 `/docs`（原 404）、占位 GitHub/X。

## 4. 仍为 stub / 待办（不影响点通）

- 对话/生图：规则回复 + 占位图，非真实大模型  
- PDF/视频：无真实文件；用 Markdown 导出代替  
- GHL：无密钥 → Mock 写库  
- R2：账号未开通 → 云上传待开通后再挂 `pitchpro-assets`  

## 5. 本地 API 冒烟结果（2026-10-24）

用本地 `admin@pitchpro.local` 已跑通：

`seed demo → designs×4 locked → deliverables×5 → export.md 200 → advance followup → GHL mock sync`  
以及 `create → confirm brief → regenerate designs → lock → advance → sync`。

线上同等 API 需登录 Cookie；本机无浏览器无法代填 `xie861861` 密码，请父代理用 computerUse 点通 UI。

## 6. 线上 UI 点通结果（2026-10-24，云电脑）

账号 `xie861861@gmail.com` 登录预发成功。

`一键示范 → Aura Home（出素材）→ 五 Tab 文案 → 导出 Markdown → 复制文案 → 进入做跟进 → Mock 同步成功`

页脚/导航：工作台、方案、隐私、条款、设置、管理后台均 200；无 `/docs`、无 GitHub/X 占位。

已知非阻断：设置页仍是引擎壳文案；对话为规则占位；PDF/视频/真 GHL/R2 未配。
