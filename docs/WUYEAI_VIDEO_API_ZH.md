# wuyeai.cn 对接文档

Base URL : https://www.wuyeai.cn
SDK 地址 : https://www.wuyeai.cn/v1
鉴权     : Authorization: Bearer sk-your-api-key

本站为标准 OpenAI 兼容接口。换模型只改
model
的值，接口路径、字段名、鉴权方式都不变。当前提供
视频生成
（Seedance / Minimax-H3 / Man 系列）与
图片生成
（GPT-Image / DALL·E）两类任务模型；另有大语言模型（Claude / GPT 系列）走标准
/v1/chat/completions
，不在本页范围。

本页的视频 / 图片模型都不是聊天模型：
请勿用
/v1/chat/completions
调用（固定失败，会看到类似
No available channel for model … under group svip
的上游报错）。视频用
POST /v1/videos
，图片用
/v1/images/generations
或
/v1/images/edits
。
Base URL
https://www.wuyeai.cn
SDK 填
https://www.wuyeai.cn/v1
鉴权
Authorization: Bearer sk-...

```
Base URL : https://www.wuyeai.cn
SDK 地址 : https://www.wuyeai.cn/v1
鉴权     : Authorization: Bearer sk-your-api-key
```

API Key 在哪拿：
控制台 →
令牌
（
https://www.wuyeai.cn/keys
）→ 新建令牌。注意区分两个东西：
令牌（sk-开头）
用于调用本页所有
/v1/*
接口；
账号密码
只用于登录控制台后台。创建令牌时请选择对应分组：
default
（视频模型）、
生图
（图片模型）。

## 接口总览

| 类型 | 接口 |
| --- | --- |
| 查询模型 | GET /v1/models |
| 视频提交 | POST /v1/videos |
| 视频查询 | GET /v1/videos/{task_id} |
| 视频下载 | GET /v1/videos/{task_id}/content |
| 文生图（出图） | POST /v1/images/generations |
| 图生图 / 图片编辑（参考图） | POST /v1/images/edits |

本页仅包含当前已上线的模型与接口；新模型接入后，以
GET /v1/models
实际返回为准。

## 查询模型

```
curl "https://www.wuyeai.cn/v1/models" \
  -H "Authorization: Bearer sk-your-api-key"
```

当前上线模型（
仅示例，实际以接口返回为准
）：

| 模型 ID | 类型 | 计费 | 时长（秒） | 分辨率 | 参考图 | 参考视频 | 参考音频 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| doubao-seedance2.0 | 视频 | ¥2.6 / 次 | 5 / 10 / 15 | 720p（必传） | 9 张 | 不支持 | 不支持 |
| doubao-seedance2.0mini | 视频 | ¥1.7 / 次 | 5 / 10 / 15 | 720p（必传） | 9 张 | 不支持 | 不支持 |
| ss-2.0-720p-v1 | 视频 | ¥2.6 / 次 | 5 / 10 / 15 | 720p（固定） | 9 张 | 不支持 | 不支持 |
| Minimax-H3-768p-803 | 视频 | ¥1.2 / 次 | 1–15（逐秒可选） | 768p（固定） | 9 张（至少 1 张） | 不支持 | 3 个 |
| Minimax-H3-768p-913 | 视频 | ¥0.9 / 次 | 15（固定） | 768p（固定） | 9 张 | 1 条 | 3 个 |
| Seedance 2.0-720p-933满血 | 视频 | ¥4.2 / 次 | 4–15（逐秒可选） | 720p（固定） | 9 张 | 3 条 | 3 个 |
| Seedance 2.0-720p-933满血稳定 | 视频 | ¥6 / 次 | 5–15（逐秒可选） | 720p（固定） | 9 张 | 3 条 | 3 个 |
| seedance-2.0-fast | 视频 | ¥3 / 次 | 5 / 10 / 15 | 720p（固定） | 9 张 | 不支持 | 不支持 |
| Seedance 2.5-1080p | 视频 | ¥3.2 / 次 | 5–30（逐秒可选） | 1080p（固定） | 9 张 | 不支持 | 3 个 |
| seedance-2.0-Dola | 视频 | ¥1.0 / 次 | 15（固定） | 720p（可选） | 9 张 | 不支持 | 不支持 |
| Minimax-H3-720p | 视频 | ¥0.3 / 次 | 4 / 6 / 8 / 15 / 20 / 30（默认 8） | 720p（可选） | 8 张 ※ | 3 条 | 3 个 |
| gpt-image-2.5-flare | 图片 | ¥0.04 / 次 | — | — | — | — | — |
| gpt-image-2.5-sunburst | 图片 | ¥0.04 / 次 | — | — | — | — | — |

表中「—」表示未标注上限，以模型实际返回为准；「不支持」表示传入该字段会被直接拒绝。※
Minimax-H3-720p
参考图上限随时长：4 / 6 / 8 秒 ≤8 张；15 秒 ≤7 张；20 / 30 秒 ≤9 张；15 / 20 / 30 秒为模板档，画幅按横竖屏锁定（15 秒 1344×768 / 768×1344；20 / 30 秒 1184×672 / 672×1184）。

本次调整要点：
Seedance 2.5-1080p
（智影线，上游已迁至新站）时长
5–30 秒逐秒可选
、1080p、参考图 9 / 音频 3、
不支持参考视频
；素材
支持公网 URL，也支持 multipart 文件直传
（网页画布可直接拖图）；上游带提示词增强审核，个别题材会被拒（
PROMPT_ENHANCEMENT_CONTENT_REJECTED
），换个措辞重试即可。
Seedance 2.5-1080p
（智影线）是站内唯一的
1080p
档：时长
5–30 秒逐秒
、画幅 6 种、参考图 9 / 音频 3，
不支持参考视频
，按次计费（选时长不加价）。
Minimax-H3-768p-803
（autodl 线）是
图生视频
模型：时长
1–15 秒逐秒
、分辨率固定
768p
、画幅仅
16:9 / 9:16
，参考图 9（
必须至少 1 张
）/ 音频 3、
不支持参考视频
，¥1.2 按次计费。
Minimax-H3-768p-913
（king-queen 线）是
全参考
档：时长固定
15 秒
、分辨率固定
768p
、画幅仅
16:9 / 9:16
，参考图
9
/ 参考视频
1
/ 参考音频
3
（图 + 视频 + 音频合计 ≤ 13 项），
参考视频与音频的合计时长要小于 15 秒
，¥0.9 按次计费。
Seedance 2.0-720p-933满血
（黑马Z站线）时长
4–15 秒逐秒
、固定
720p
、画幅仅
16:9 / 9:16
，参考图 9 / 参考视频 3 / 参考音频 3，¥4.2 按次计费；同线的
Seedance 2.0-720p-933满血稳定
规格相同但时长下限为
5 秒
，¥6 按次计费。这两条都
不支持首尾帧
（传入会被拒）
seedance-2.0-fast
（黑马线，上游 sd-2.0-900）只吃参考图：时长
5 / 10 / 15 秒三档
、720p、参考图 9、
不支持参考视频与音频
，¥3 按次。

Dola 线使用提示：
seedance-2.0-Dola
（固定 15 秒）
只支持 16:9 / 9:16
；提示词
不要写秒数
（别写「15秒」），请用
「镜头1」「镜头2」代替时间轴
，否则内容容易乱；提示词 ≤ 5000 字符；
卡脸
——
人脸请改用彩铅风格
（彩铅可过）。

列表按你的令牌分组过滤：
令牌属于哪个分组，就只返回该分组可用的模型；模型 ID 直接从这里复制最稳妥。当前
default 分组 = 视频模型
、
生图 分组 = 图片模型
；在未配置该模型的分组调用会报
No available channel for model … under group …
。

## 视频生成

视频是
异步任务
，流程固定三步：
提交拿任务 ID → 每 5~10 秒轮询状态 → completed 后下载
。

### 1. 提交任务

```
curl "https://www.wuyeai.cn/v1/videos" \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Seedance 2.0-720p-933满血",
    "prompt": "让 @图1 的人物穿上 @图2 的衣服，走进 @图3 的场景；运镜与配音分别参考所传的视频、音频素材",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "referenceImages": [
      "https://example.com/person.jpg",
      "https://example.com/clothes.jpg",
      "https://example.com/scene.jpg"
    ],
    "referenceVideos": ["https://example.com/camera-move.mp4"],
    "referenceAudios": [
      "https://example.com/voice.mp3",
      "https://example.com/bgm.mp3"
    ]
  }'
```

### 请求字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| model | string | 是 | 视频模型 ID（以 GET /v1/models 为准）：doubao-seedance2.0 / doubao-seedance2.0mini / ss-2.0-720p-v1 / Minimax-H3-768p-803 / Seedance 2.5-1080p / seedance-2.0-Dola / Minimax-H3-720p / Minimax-H3-768p-913 / Seedance 2.0-720p-933满血 / Seedance 2.0-720p-933满血稳定 / seedance-2.0-fast |
| prompt | string | 是 | 视频提示词 |
| duration | integer | 是 | 时长秒数（整数）。doubao-seedance2.0 / doubao-seedance2.0mini 取 5 / 10 / 15；ss-2.0-720p-v1 取 5 / 10 / 15；seedance-2.0-Dola 固定 15；Seedance 2.5-1080p 为 5–30；Minimax-H3-768p-803 为 1–15；Minimax-H3-720p 取 4 / 6 / 8 / 15 / 20 / 30，不传默认 8；Minimax-H3-768p-913 固定 15（传其他值会被拒）；Seedance 2.0-720p-933满血 为 4–15，Seedance 2.0-720p-933满血稳定 为 5–15；seedance-2.0-fast 取 5 / 10 / 15 |
| resolution | string | 部分必传 | 分辨率：doubao-seedance2.0 / doubao-seedance2.0mini 必须传 720p；seedance-2.0-Dola / Minimax-H3-720p 为 720p（可选，填了必须是 720p）；Seedance 2.5-1080p 固定 1080p（只接受 1080p）；Minimax-H3-768p-803 / Minimax-H3-768p-913 固定 768p（只接受 768p）；Seedance 2.0-720p-933满血 / -933满血稳定 / seedance-2.0-fast 固定 720p |
| ratio | string | 否 | 画幅。Minimax-H3-720p 只区分横屏 16:9 与竖屏 9:16（15 / 20 / 30 秒档按横竖屏锁定）；ss-2.0-720p-v1 仅 16:9 / 9:16（其他画幅会被拒绝）；1:1 / 4:3 / 3:4 / 21:9；Seedance 2.5-1080p 支持 16:9 / 9:16 / 1:1 / 4:3 / 3:4 / 21:9 / 4:3 / 3:4 / 21:9；seedance-2.0-Dola 仅 16:9 / 9:16；Minimax-H3-768p-803 / Minimax-H3-768p-913 / Seedance 2.0-720p-933满血 / -933满血稳定 / seedance-2.0-fast 仅 16:9 / 9:16（其他画幅会按横/竖自动归位）；不传由模型决定 |
| referenceImages | string[] | 否 | 参考图，公网 http(s) URL 数组。各模型上限见上表（doubao-seedance2.0 / doubao-seedance2.0mini 最多 9 张；Minimax-H3-768p-803 至少 1 张、最多 9 张，纯文生会被拒绝；Minimax-H3-768p-913 / Seedance 2.0-720p-933满血 / -933满血稳定 / seedance-2.0-fast 最多 9 张） |
| referenceVideos | string[] | 否 | 参考视频，公网 http(s) URL 数组。支持情况见上表：doubao-seedance2.0 / doubao-seedance2.0mini 不支持；Minimax-H3-720p（3 条）/ Minimax-H3-768p-913（1 条）/ Seedance 2.0-720p-933满血、-933满血稳定（各 3 条）支持；Seedance 2.5-1080p 不支持；seedance-2.0-fast 同样不支持 |
| referenceAudios | string[] | 否 | 参考音频，公网 http(s) URL 数组。各模型上限见上表（doubao-seedance2.0 / doubao-seedance2.0mini 不支持；Minimax-H3-720p / Seedance 2.0-720p-933满血 / -933满血稳定 各 3 个；seedance-2.0-fast 不支持） |
| first_frame_image | string | 否 | 首帧图，公网 URL。和参考图是两套东西，见下。注意：seedance-2.0-Dola / Minimax-H3-720p / Seedance 2.0-720p-933满血 / -933满血稳定 / seedance-2.0-fast 不支持首尾帧，传入会被拒绝 |
| last_frame_image | string | 否 | 尾帧图，公网 URL。和参考图是两套东西，见下 |

兼容字段：
seconds
（与
duration
等价，本站会规范化后转发；两者同时传时必须一致）。为避免歧义，推荐统一使用
duration
。

只发上表里的字段，不要发旧字段名 / 别名。
参考素材一律用驼峰：
referenceImages
/
referenceVideos
/
referenceAudios
。以下名字会被
直接拒绝
（多数会报出正确写法）：
reference_images
、
reference_image_urls
、
reference_videos
、
reference_audios
、
duration_seconds
、
aspect_ratio
、
images
、
image_urls
、
size
、
generate_audio
。上表之外的任何字段同样会被整单拒绝 —— 本站对字段做严格校验，宁可报错也
不会静默丢弃
你的参数。

### @图N 与首尾帧（最容易踩的一条）

适用范围：
下面的
@图N
强校验适用于
Dola 系列
（
seedance-2.0-Dola
）。其它视频模型（
Minimax-H3
各通道、
Seedance 2.0
各线）无此强制要求——提示词里正常描述素材内容即可，是否用
@图N
引用不影响提交。首尾帧请优先按「首帧放参考图第 1 张、尾帧放第 2 张」处理，独立的首尾帧字段各模型支持情况不一致。
规则：提示词里的
@图1
、
@图2
… 只对应
referenceImages
数组；首尾帧（
first_frame_image
/
last_frame_image
）不算数组项。
两套写法不要混用。

| 你发的字段 | 提示词里写 | 结果 |
| --- | --- | --- |
| referenceImages: [图1, 图2] | @图1 @图2 | 通过（推荐） |
| referenceImages: [图1, 图2] | 只写 @图1 | 提交失败：数组第 2 项没有对应的 @图2 |
| first_frame_image + last_frame_image | @图1 @图2 | 提交失败：提示词里的 @图N 没有对应的参考素材 |
| first_frame_image + last_frame_image | 不写 @图N | 提交能过；能否出片以模型为准，出不了片就改用参考图写法 |

- 一一对应，宁多勿少
：给了 N 张图，提示词里就要写到
@图N
。
- 想要"首帧 → 尾帧"的效果，最稳的写法是
把首帧图放第 1 张、尾帧图放第 2 张
，走
referenceImages
+
@图1 @图2
。
- 字段名必须一字不差：写成
first_image
/
last_image
不会当首尾帧处理，会直接报错。
- 有些模型
必须
给参考图，只发文字提示词会被拒绝，报「参考图缺失」。
- 参考图 / 参考音频数量超上限会被直接拒绝（如
referenceImages supports at most 30 items
）。
只有首帧 / 尾帧两张图时，推荐这样写：
首帧放第 1 张、尾帧放第 2 张
，走
referenceImages
（通用做法，所有视频模型都吃）：

```
{
  "model": "Seedance 2.0-720p-933满血",
  "prompt": "首图人物走向尾图场景，镜头缓慢推近",
  "duration": 5,
  "ratio": "16:9",
  "resolution": "720p",
  "referenceImages": [
    "https://example.com/first.jpg",
    "https://example.com/last.jpg"
  ]
}
```

### 上传本地素材（multipart/form-data）

本地文件走 multipart，
字段名和 JSON 完全一样（驼峰）
：

```
curl "https://www.wuyeai.cn/v1/videos" \
  -H "Authorization: Bearer sk-your-api-key" \
  -F "model=Seedance 2.0-720p-933满血" \
  -F "prompt=让 @图1 的人物穿上 @图2 的衣服，走进 @图3 的场景" \
  -F "duration=5" \
  -F "ratio=16:9" \
  -F "resolution=720p" \
  -F "referenceImages=@person.jpg" \
  -F "referenceImages=@clothes.jpg" \
  -F "referenceImages=@scene.jpg" \
  -F "referenceVideos=@camera-move.mp4" \
  -F "referenceAudios=@voice.mp3" \
  -F "referenceAudios=@bgm.mp3"
```

同一个字段重复出现就是多个素材：上面 3 张图对应提示词里的
@图1 ~ @图3
，视频 / 音频同理。除 referenceImages / referenceVideos / referenceAudios 外，其它字段只能出现一次。

### 素材要求

- 必须是
公网可访问
的 http 或 https 地址，不能依赖登录状态、Cookie、内网地址或临时签名。
- Content-Type
必须与文件类型一致：图片
image/*
、视频
video/*
、音频
audio/*
；
不要统一返回
application/octet-stream
，会因无法识别类型被拒绝。
- 文件名扩展名要与内容一致（.jpg / .png / .mp4 / .mp3 / .wav）。
- 具体模型是否支持图片 / 视频 / 音频参考、以及允许的数量和大小，以该模型当前能力为准。
- 素材两种传法
：①
referenceImages
传公网 http(s) URL（最通用，推荐）；② 以
multipart/form-data
直接上传文件（网页画布走这条路）。部分模型只接受 URL，以
GET /v1/models
与具体报错为准。
提交成功返回：

```
{
  "id": "task_xxxxxxxx",
  "object": "video",
  "model": "Seedance 2.0-720p-933满血",
  "status": "queued",
  "progress": 0,
  "created_at": 1789591899
}
```

只提交一次。
提交成功只代表任务已创建，保存返回的
id
，然后轮询查询接口。
不要重复调用 POST /v1/videos
—— 本站按次计费，每调用一次就生成一次、扣一次费。

### 2. 轮询查询

```
curl "https://www.wuyeai.cn/v1/videos/task_xxxxxxxx" \
  -H "Authorization: Bearer sk-your-api-key"
```

每 5~10 秒查一次即可。查询是纯 GET：
不要带请求体，也不要再传 model、prompt 等生成字段
，系统会用
task_id
恢复任务对应的模型与渠道。查询必须使用
创建任务时的同一个令牌
。

| 状态 | 怎么处理 |
| --- | --- |
| queued | 排队中，继续查原任务，不要重新提交 |
| in_progress | 生成中，继续等待 |
| completed | 停止轮询，去下载视频 |
| failed | 停止轮询，看 error.message，改提示词或素材后新建任务 |

查询临时失败 ≠ 任务失败。
查询接口偶发返回
408 / 409 / 425 / 429 / 5xx
，只表示这一次查询没成功，保留
task_id
继续轮询即可；只有状态明确是
failed
才算失败。
任务完成时的响应示例：

```
{
  "id": "task_xxxxxxxx",
  "object": "video",
  "model": "Seedance 2.0-720p-933满血",
  "status": "completed",
  "progress": 100,
  "created_at": 1789591899,
  "completed_at": 1789592086
}
```

完成时响应可能还会带上额外的地址 / 元数据字段（例如
video_url
、
metadata.url
，以实际返回为准）；下载推荐统一使用下面的本站下载接口。

### 3. 下载视频

- 本站下载接口（推荐）
：
GET https://www.wuyeai.cn/v1/videos/{task_id}/content
，带同一个令牌即可下载，地址始终在本站域名下、支持 Range 断点续传，返回视频文件（video/mp4）。
- 响应里的地址字段（如有）
：查询响应中若返回
video_url
等地址，也可直接使用（以实际返回为准）。

```
curl "https://www.wuyeai.cn/v1/videos/task_xxxxxxxx/content" \
  -H "Authorization: Bearer sk-your-api-key" \
  --output video.mp4
```

任务未完成时下载会报
Task is not completed yet, current status: IN_PROGRESS
，等状态变为
completed
再下载。只使用接口返回的下载地址，不要自己拼路径。若显示
completed
但暂时取不到片，稍等几秒重试即可。

## 图片生成（文生图 / 图生图）

本站出图模型：
gpt-image-2.5-flare
、
gpt-image-2.5-sunburst
，均
¥0.04 / 次
。
这些模型位于「生图」分组
——请使用
该分组下的令牌
调用，否则会返回
No available channel for model … under group …
。不确定自己的令牌能用哪些模型，先调
GET /v1/models
查询。

```
curl "https://www.wuyeai.cn/v1/images/generations" \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2.5-flare",
    "prompt": "一只在雨天窗台上的橘猫",
    "n": 1,
    "size": "1024x1024"
  }'
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| model | string | 是 | 图片模型 ID |
| prompt | string | 是 | 图片描述 |
| n | integer | 否 | 生成张数，默认 1（正整数） |
| size | string | 否 | 尺寸，如 1024x1024 / 1024x1536 / 1536x1024，可用值以模型为准 |
| response_format | string | 否 | url 或 b64_json，以模型实际支持为准；返回内容原样透传 |

结果这样读：
从
data[0].url
或
data[0].b64_json
取图，客户端两种都兼容最稳。
注意：图片这条路的画幅字段是
size
，视频那条路是
ratio
，别搞混。
字段说明：
图片请求由本站直连上游透传；
size
建议按
宽x高
形式传（如
1024x1024
），参数支持范围以模型实际返回为准（上游不识别的参数可能被拒绝）。

### 图生图 / 图片编辑（参考图生成）

```
curl "https://www.wuyeai.cn/v1/images/edits" \
  -H "Authorization: Bearer sk-your-api-key" \
  -F "model=gpt-image-2.5-flare" \
  -F "prompt=保持主体不变，改成电影海报风格" \
  -F "image=@reference.png" \
  -F "size=1024x1024" \
  -F "n=1"
```

素材文件字段用
image
，
必须走 multipart 上传
，不能把本地路径写进 JSON；
编辑接口必须至少上传一张图
，否则会被上游以缺少图片为由拒绝。多图参考请按同一字段名重复传
-F "image=@a.png" -F "image=@b.png"
（可用性以模型为准）。文生图接口不接受文件上传——要传图请走
/v1/images/edits
。

## 计费

所有调用按
额度
计费。当前上线的视频 / 图片模型均为
按次计费
：每提交一次任务，按固定单价扣费一次；
轮询查询与下载视频不额外计费
。另有大语言模型（Claude / GPT 系列）按 token 计费，见
GET /v1/models
与定价页。

| 模型 | 计费方式 | 价格 |
| --- | --- | --- |
| doubao-seedance2.0 | 按次 | ¥2.6 / 次 |
| doubao-seedance2.0mini | 按次 | ¥1.7 / 次 |
| Minimax-H3-768p-803 | 按次 | ¥1.2 / 次 |
| Minimax-H3-768p-913 | 按次 | ¥0.9 / 次 |
| Seedance 2.0-720p-933满血 | 按次 | ¥4.2 / 次 |
| Seedance 2.0-720p-933满血稳定 | 按次 | ¥6 / 次 |
| seedance-2.0-fast | 按次 | ¥3 / 次 |
| Seedance 2.5-1080p | 按次 | ¥3.2 / 次 |
| seedance-2.0-Dola | 按次 | ¥1.0 / 次 |
| Minimax-H3-720p高配版 | 按次 | ¥0.8 / 次 |
| Minimax-H3-720p | 按次 | ¥0.3 / 次 |
| gpt-image-2.5-flare | 按次 | ¥0.04 / 次 |
| gpt-image-2.5-sunburst | 按次 | ¥0.04 / 次 |

视频按次计费：
单次价格固定，
与视频时长无关
—— 传 5 秒和传 30 秒扣的是同一个价。所以调试时先确认流程通了，再上正式参数即可。
重复提交会重复计费
（每调用一次 POST /v1/videos 就生成一次任务、扣一次费）。余额与消费明细在控制台「钱包 / 日志」里看。

## 常见错误

| 报错 | 原因与处理 |
| --- | --- |
| 401 无效的令牌 | 用的不是 sk- 开头的令牌，或令牌被禁用 / 过期。去控制台「令牌」重新建一个。 |
| 404 Invalid URL (GET /v1/…) | 请求路径写错，对照上面的接口总览改。 |
| No available channel for model … under group … | 该模型在你的令牌分组没有可用渠道。当前 default 分组=视频模型、生图 分组=图片模型；确认令牌所在分组。 |
| resolution is required for … and must be 720p (no silent default) | 视频模型必须显式传 resolution，本站固定 720p，不传会被拒绝。 |
| resolution must be 720p (got 1080p) | 分辨率只支持 720p，其它档位直接报错。 |
| duration is required for … / duration for … must be between 4 and 15 / 4 and 30 / 4 and 12 seconds (got …) | 时长必填且需在模型范围内（SD2.0 系列 4–12 秒；其余见上表）。 |
| seconds must be one of [4, 6, 8, 15, 20, 30] | Minimax-H3-720p 的时长只能取这几个档位。 |
| resolution for … is 720p (encoded in the model name); got 1080p | SD2.0 系列分辨率固定 720p（编码在模型名里），填了其它档位会报错；不填则不校验。 |
| … does not support reference videos (max_videos=0); remove referenceVideos | 该模型不支持参考视频（如 Seedance 2.5-1080p / seedance-2.0-fast），请移除 referenceVideos。 |
| model_temporarily_unavailable（系统异常，请重新提交） | 上游该模型线路短时不可用（自动恢复中），稍等片刻重新提交即可；如持续报错可换同类模型。 |
| field "reference_images" is not supported; use "referenceImages" instead | 用了旧字段名。按提示改成驼峰写法（视频素材字段见上表）。 |
| field "watermark" is not supported; supported fields: … | 请求里带了不支持的字段，被整单拒绝。删掉多余字段，只保留文档列出的字段。 |
| referenceImages supports at most 30 items for this model (got 31) | 参考图 / 参考音频数量超上限（见模型表），减少素材数量。 |
| referenceImages[0] must be a public http(s) URL (private address rejected): … | 素材 URL 要公网可访问、未过期、不依赖登录 / Cookie / 内网地址。 |
| prompt is required | 没传提示词。 |
| 图片参数错误（size / n 等） | 检查 size 是否为 宽x高 格式、n 是否为正整数；具体报错以实际返回为准。 |
| bad_response_status_code（上游返回 4xx） | 图片请求被上游拒绝（多为参数问题），按返回的错误信息调整后重试。 |
| 图片编辑缺少图片文件 | 图片编辑需 multipart 上传 image 文件。 |
| 文生图接口不接受文件上传 | 要传参考图请走 /v1/images/edits。 |
| 400 task_not_exist | 查询要用创建任务时的同一个令牌，或 task_id 写错。 |
| Task is not completed yet, current status: IN_PROGRESS | 任务未完成就调用了下载接口，等状态变为 completed 再下载。 |
| 素材下载失败 / 素材类型无效 | 素材 URL 要公网可访问；Content-Type 必须与文件一致（image/* / video/* / audio/*），不要返回 application/octet-stream。 |
| 查询时返回 408 / 409 / 425 / 429 / 5xx | 只是这一次查询失败，不代表任务失败；保留 task_id 继续轮询。 |
| 第 N 张参考图片无法访问，请确认图片链接是否可公开访问后重试 | 上游下载素材失败：多为链接临时过期、需要登录 / 防盗链、图床屏蔽机房 IP 或 URL 写错。换稳定图床的公网直链后重试。 |
| file uploads are not supported for this model; use public http(s) URLs in referenceImages | 该模型只接受公网 URL 素材，不支持 multipart 文件直传；请先把本地文件传到公网图床再以 URL 传入。 |
| duration for seedance2.0 must be one of 5 / 10 / 15 seconds … | seedance2.0 时长只能取 5 / 10 / 15 秒。 |
| duration for … must be between 4 and 15 seconds … | Seedance 2.0-720p-933满血 / Minimax-H3-768p 系列的时长范围是 4–15 秒。 |
| invalid_assets: 提交参数或参考素材无效，请检查文件格式、数量和时长 | 素材不符合牛来pro 要求：最常见是参考视频 / 参考音频合计超过 15 秒（请裁剪）；也可能是素材格式或数量问题。如用了参考视频，先剪到 15 秒以内再重试。 |
| No available channel for model … under group svip（调用 /v1/chat/completions 时出现） | 视频 / 图片模型不是 chat 模型，不能走 /v1/chat/completions；请改用 POST /v1/videos（视频）或 /v1/images/*（图片）。（svip 为上游转发分组名，此类报错来自上游） |
| 余额不足 | 账号额度用完了，去控制台充值或兑换。 |

文档版本 2026-10-28（v6.3：智影上游迁至新站
zhiyingai.cc.cd
（旧域名暂停生成），下架
Seedance 2.0-720p
（上游模型已移除）；v6.2：下架
Minimax-H3-720p高配版
；v6.1：新增
ss-2.0-720p-v1
（¥2.6 / 5·10·15 秒 / 720p / 9 图 / 仅 16:9·9:16）；v6.0：恢复上架
Minimax-H3-720p高配版
（4–12 秒 / 5 图 / ¥0.8）；v5.9：新增
doubao-seedance2.0
（¥2.6）与
doubao-seedance2.0mini
（¥1.7），5/10/15 秒、720p、9 图；v5.8：永久下架
doubao-seedance-2.0-mini
、
man-2.0mini-720p
、
sd2.0-fast-803-720p
、
sd2.0-mini-503-720p
；v5.7：暂时下线
Minimax-H3-720p高配版
（恢复后重新上架）；v5.6：下线
grok-Imagine1.5-720p
；v5.5：新增
seedance-2.0-fast
（5/10/15 秒，¥3）；v5.4：新增
Seedance 2.0-720p-933满血
（4–15 秒 / ¥4.2）与
Seedance 2.0-720p-933满血稳定
（5–15 秒 / ¥6），均 720p、9 图 3 视 3 音、仅 16:9·9:16；v5.3：新增
Minimax-H3-768p-913
（768p / 固定 15 秒 / 9 图 + 1 视频 + 3 音频 / 仅 16:9·9:16 / ¥0.9 按次）；v5.2：新增
Minimax-H3-768p-803
（768p / 1–15 秒 / 图生视频 / 仅 16:9·9:16）；v5.1：下线
Seedance 2.0-720p930
；下线模型不再列入本表）· 模型与价格以控制台实时配置为准。
