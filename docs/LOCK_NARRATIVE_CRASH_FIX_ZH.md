# 锁定视觉崩溃修复（叙事不出现）

已上线 P01：https://pitchpro.p01.ccwu.cc

## 根因

`lockDesignConcept` 把 `chatMessage` **原样**返回（DB 里 `attachments` 是 JSON **字符串** `"[]"`）。
`/messages` 列表会 `JSON.parse`，但 lock / refine / confirm-narrative 的返回没有。

左侧聊天渲染：

```ts
m.attachments?.length > 0 && m.attachments.map(...)
```

`"[]".length === 2` → 进入分支 → `.map is not a function` → React error boundary「出错了」。

锁本身已写入 DB，所以重登后右侧仍显示已锁定；若叙事插入在崩溃前完成会在列表里，若用户感知「不见了」多半是崩溃打断了 UI 推送，或旧会话从未成功 seed。

## 修复

1. `toApiChatMessage` / `safeParseAttachments`（`chat-serialize.ts`）统一序列化
2. lock / refine / confirmNarrative 返回已 parse 的 `attachments: []`
3. 聊天 pane 防御性 coerce + 外部事件 normalize
4. lock 成功后 ensurePdp / 叙事 seed 失败不再抛（保锁）
5. `ensureNarrativeChatMessage`：已锁但无「呈品 · 叙事师」时，GET `/pdp` 回填并推到左侧

## 验证

1. 登录 `admin@pitchpro.p01.local`
2. 工作台 → 选设计 → 锁定一张
3. **不应**出现「出错了」；左侧立刻出现叙事师生活方式故事；右侧「等待叙事」
4. 若旧项目已锁无叙事：打开详情步或刷新，左侧应自动补一条叙事
