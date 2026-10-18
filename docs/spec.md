# 需求规格说明书：拍照学外语小程序

## 1. 背景与目标
面向语言学习者，通过「一张图 → 目标语言单词 → 目标语言句子 → 语音」的链路，把日常场景变成语言学习素材。当前支持英语、日语、韩语、法语、西班牙语、德语。

核心目标：
- 用户拍/选一张图，AI 识别图中物体并给出对应目标语言单词、中文释义与物品分类。
- 用识别出的单词组成一句符合用户难度（入门/进阶/高级）的目标语言句子。
- 把句子转成对应语言的语音播放，支持跟读；重复播放走本地缓存。
- 结果以图片形式分享到微信（含原图、句子、小程序码）。
- 提供最近识别记录与本地单词本，方便复习。

非目标（本期不做）：账号体系与跨设备同步（识别记录/单词本先本地存储）、社区/UGC、排行榜、错题本、自动续费订阅（虚拟支付开通前只规划一次性会员）。

## 2. 目标用户与场景
| 难度 | 场景 |
|---|---|
| 入门 | 看图认单词，句子短、词汇简单 |
| 进阶 | 用单词组句，练习一般语法结构 |
| 高级 | 更复杂句式与更丰富词汇，用于写作/口语素材 |

家长可代为操作：孩子说“拍这个”，家长拍照分享结果。

## 3. 核心用户流程
1. 进入首页，选择语言（英语/日语/韩语/法语/西班牙语/德语）与难度（入门/进阶/高级），默认记忆上次选择。
2. 拍照或从相册选图。
3. 上传图片 → 等待识别（有 loading 与失败重试）。
4. 逐词查看识别结果：目标语言单词 + 中文释义 + 难度标注；结果页展示原图与 bbox 标注。
5. 识别完成后自动生成目标语言句子（可点「换一句」重新生成），展示中文翻译。
6. 点击播放按钮 → 播放句子语音；支持重复播放（第二次走本地缓存，不再请求合成）。
7. 点击分享 → 导出带原图、句子、小程序码的分享图片。
8. 可在结果页把单词收藏到单词本，或在首页查看最近识别记录与单词本。
9. 普通用户每天免费识别 3 张；超出后引导开通会员（虚拟支付开通后启用）。

## 4. 功能需求

### FR-1 图片输入
- 支持 `wx.chooseMedia` 拍照与相册选图。
- 单次一张图；限制大小（建议压缩后 < 1MB）。
- 上传到云存储后，仅把 `fileID` 交给云函数。

### FR-2 物体识别与单词标注
- 输入：图片 + 难度 + 目标语言 `lang`。
- 返回结构：`{ scene, words: [{ word, translation, confidence, level, category, bbox? }] }`；`word` 为目标语言，`translation` 为中文。
- `category` 为固定分类枚举：动物 / 食物 / 水果蔬菜 / 家具家居 / 交通工具 / 自然 / 人物 / 衣物 / 颜色形状 / 文具玩具 / 电子产品 / 建筑地点 / 其他；非法值归「其他」。
- `bbox` 为归一化坐标 0–1（x/y 左上角，w/h 宽高）；无法定位时省略。
- `scene` 用一句简短中文描述图中物体、颜色、位置或数量关系。
- 过滤低置信度结果，限制返回数量（建议 3–8 个）。
- 每个单词标注难度等级；单词去重（同一物体合并）。

### FR-3 组句
- 识别完成后由结果页**自动生成**句子；保留「换一句」入口用于重新生成。
- 输入：识别出的单词列表 + 难度等级 + 目标语言 `lang` + 可选场景 `scene`。
- 输出：`{ sentence, translation, usedWords[] }`；`sentence` 为目标语言，`translation` 为中文。
- 句子必须包含至少 N 个识别词（入门 2、进阶 3、高级 3+）。
- 有 `scene` 时，句子需与图片内容一致，可描述颜色、位置或关系。
- prompt 采用**语言老师人设**：耐心、鼓励学生，按当前难度教学，句子自然、适合朗读。
- 语法正确、语义通顺；不同难度对应不同句式复杂度与词汇范围。

### FR-4 语音合成
- 由云函数 `tts` 调用 TokenHub MiniMax 同步语音合成完成（`POST /v1/wand/minimax-tts/sync_tts`）。
- 入参：句子文本 + 目标语言 `lang` + 可选 `voice`；模型默认 `minimax-speech-2.8-turbo`，音色按 `common/languages.js` 的语言映射选择，`TOKENHUB_TTS_VOICE` 仅兜底。
- TokenHub 返回 hex 音频，云函数转 base64 下发；前端写入 `wx.env.USER_DATA_PATH/tts-<hash>.mp3` 并用 `InnerAudioContext` 播放。
- **缓存优先**：播放前先按 `hash(lang + voice + text)` 检查本地文件；命中直接播放，不再请求 `tts`。未命中才调用云函数并落盘。
- 封装为前端 `utils/speech.js` 的 `speak(text, { lang })`，作为唯一播放入口。
- 不使用「微信同声传译」插件（已下架）。

### FR-5 分享
- 主路径：在结果页导出**分享图片**，图片包含原图（带 bbox/单词标签）、目标语言句子、中文翻译和小程序码；通过 `wx.showShareImageMenu` 分享。
- 小程序码使用内置静态资源 `miniprogram/assets/wxacode.png`（从微信公众平台下载），扫码打开首页；不按图片生成、不调用 `getUnlimited`。
- 保留 `onShareAppMessage` 卡片分享作为兜底，路径携带 `level`/`words`/`sentence`/`scene`。
- 分享图不含音频；接收方打开小程序后可重新识别或播放。

### FR-6 难度分级
- 三档：`primary` / `junior` / `senior`。
- 影响：词表范围、组句语法复杂度、语速。
- 配置集中在一份数据定义，前端与云函数共用，禁止两边各维护一份。

### FR-7 识别记录
- 本地保存最近 **10 条**识别记录（总量 10 条，FIFO）。
- 每条包含：时间、语言、难度、图片本地副本、words（含 category/bbox）、scene、sentence、translation。
- 图片复制到 `USER_DATA_PATH/history/`，避免临时路径失效。
- 首页提供「识别记录」入口；列表展示缩略图、时间、语言与句子；点击可还原结果页。
- 本期不跨设备同步。

### FR-8 单词本
- 结果页每个单词右侧提供「收藏」星标，点击**即时收藏**（无需多选）。
- 本地保存，按 `lang + word` 去重；字段：word、translation、category、lang、level、addedAt。
- 已收藏的词显示已收藏状态。
- 首页提供「单词本」入口；列表按语言/分类分组，可删除。
- 本期不跨设备同步。

### FR-9 每日额度与会员（虚拟支付开通后启用）
- 普通用户每天最多识别 **3 张**照片；按 openid + 自然日（中国时区）计数，服务端校验。
- 超出后显示付费墙，引导开通「**一次性 30 天会员**」；会员期内不限张数。
- 当前主体为**个人**，虚拟支付尚未开通；**本期只记录需求，不实现支付**。
- 计划：`quota` 云函数（用量/会员校验）、`pay` 云函数（订单签名）、`payNotify` 云函数（发货通知）；云数据库 `usage`/`subscriptions`/`orders`。
- 价格、商品 ID、会员权益细节等虚拟支付开通后再定。

## 5. 页面设计
| 页面 | 路径 | 职责 |
|---|---|---|
| 首页 | `pages/index` | 选语言/难度、拍照/选图入口、识别记录/单词本入口 |
| 结果页 | `pages/result` | 展示原图与单词标注、单词列表、句子、播放、收藏、导出分享图 |
| 识别记录 | `pages/history` | 最近 10 条识别记录 |
| 单词本 | `pages/wordbook` | 收藏的单词，按语言/分类分组 |
| 会员/付费墙 | `pages/pay` | 额度用尽后的引导（虚拟支付开通后） |
| 分享落地页 | 复用 `pages/result` | 带参数还原结果 |

## 6. 接口契约（云函数）
统一返回 `{ ok: boolean, data?: any, error?: { code, message } }`。

### `recognize`
- 入参：`{ fileID: string, level: 'primary'|'junior'|'senior', lang: 'en'|'ja'|'ko'|'fr'|'es'|'de' }`
- 出参：`{ scene: string, words: [{ word, translation, confidence, level, category, bbox?: { x, y, w, h } }] }`

### `compose`
- 入参：`{ words: string[], level, scene?: string, lang: 'en'|'ja'|'ko'|'fr'|'es'|'de' }`
- 出参：`{ sentence, translation, usedWords: string[] }`

### `analyze`（组合接口）
- 入参：`{ fileID: string, level, lang }`
- 出参：`{ words, scene, sentence, translation, usedWords }`
- 一次视觉请求同时完成识别与组句；`words` 结构同 `recognize`。
- 若句子为空或 `usedWords` 少于当前难度要求，`sentence`/`translation` 返回空，由结果页回退调用 `compose`。
- provider 超时 20s；云函数超时建议 **30s**。
- 小程序通过 `config.useCombinedAnalyze` 选择组合接口；关闭后走 `recognize` + `compose` 两段式。

### `tts`
- 入参：`{ text: string, lang: 'en'|'ja'|'ko'|'fr'|'es'|'de', voice?: string }`
- 出参：`{ audioBase64: string, mime: 'audio/mpeg', size: number, durationMs: number }`
- 文本限制 500 字；响应体需小于约 1MB。

### 本地存储（miniprogram）
- `pendingResult`：当前结果（fileID/imagePath/scene/words/sentence/translation/lang/level）。
- `history`：最近 10 条识别记录。
- `wordbook`：单词本，按 `lang + word` 去重。
- `tts-<hash>.mp3`：TTS 缓存，hash = `lang + voice + text`。

### 计划中（虚拟支付开通后，未实现）
- `quota`：`{ action: 'check' }` → `{ allowed, remaining, subscribed }`。
- `pay`：生成一次性 30 天会员订单的 `signData`/`paySig`/`signature`。
- `payNotify`：接收 `xpay_goods_deliver_notify`，写入/延长会员。

## 7. AI 适配层（厂商无关）
识别、组句与语音合成都在云函数内通过适配层调用具体厂商，业务代码不直接依赖厂商 SDK：
- `providers/` 下每个厂商一个实现，暴露统一方法（如 `recognize(imageBuffer, opts) -> { scene, words }`、`compose(words, opts) -> { sentence, translation, usedWords }`、`analyze(imageBuffer, opts) -> { words, scene, sentence, translation, usedWords }`、`synthesize(text, opts) -> { audioBase64, ... }`）。
- 厂商选择走环境变量/配置，便于替换与灰度。
- prompt、模型名、音色、超时、重试策略集中在适配层配置。
- 识别 prompt 返回固定 `category`；组句 prompt 使用「语言老师」人设，按难度教学。
- 前端统一走 `utils/speech.js` 的 `speak(text)` 调用 `tts` 云函数。

当前实现：腾讯云 TokenHub（`providers/tokenhub.js`），OpenAI 兼容接口 + `TOKENHUB_API_KEY`；视觉用 `hy-vision-2.0-instruct`、组句用 `hy3`、语音用 `minimax-speech-2.8-turbo`，均可通过环境变量覆盖。**DeepSeek-V4.1-Flash（`deepseek/deepseek-flash`）已实测可作为识别/组句备选**；DeepSeek 视觉默认开启思考，`recognize` 在模型名含 `deepseek` 时已显式关闭 `thinking`。支持 `en/ja/ko/fr/es/de` 六种语言；TTS 音色按 `common/languages.js` 映射。`AI_PROVIDER=tokenhub` 启用，识别/组句保留 `mock` 兜底。

## 8. 非功能需求
- 性能：识别端到端目标 < 5s；组句 < 5s；TTS < 5s；分享图生成 < 3s。
- 成本：限制图片尺寸（长边约 1280）与识别词数；对云函数调用做简单频控；TTS 文本限制 500 字。
- 安全：密钥只存云函数环境变量；不信任客户端入参，服务端校验 `fileID`、文本长度、bbox 范围。
- 隐私：图片仅用于本次识别与用户主动发起的分享图生成；不长期保留原始图片。分享图在设备本地合成。
- 本地存储：`history` 最多 10 条，图片压缩后保存；`wordbook` 按语言+单词去重；`USER_DATA_PATH` 约 10MB，TTS 缓存需要清理策略。
- 额度：虚拟支付未开通前不启用服务端配额；开通后按 openid 每日 3 次，会员期内不限。
- 合规：AI 生成内容需符合 K12 场景，做敏感词/不当内容过滤。
- 依赖：TTS 依赖 TokenHub 语音模型已开通且各语言音色可用；识别/组句依赖对应模型已开通。

## 9. 验收标准
- 六种语言（en/ja/ko/fr/es/de）各完成一次：识别 → 组句 → 语音。
- 给定一张含常见物体的图，返回 ≥3 个正确的目标语言单词、一句场景描述和可用的 bbox。
- 结果页展示原图，识别词以框/标签标注；无 bbox 的词至少出现在单词列表中。
- 生成的句子语法正确、包含识别词，并与场景描述一致。
- 句子语音由 `tts` 云函数按当前语言合成、在设备本地缓存并正常播放；第二次播放不再发起合成请求。
- 结果页自动生成句子；「换一句」可重新生成。
- 每个识别词显示物品分类；分类值在固定枚举内。
- 最近 10 条识别记录可在本地保存并查看；点击可还原结果页。
- 结果页可即时收藏单词；单词本可查看/删除，按语言+单词去重。
- 分享图为一张包含原图、标注、目标语言句子、中文翻译和小程序码的图片；扫码能打开小程序。
- 前端代码中不出现任何 AI 厂商密钥。

## 10. 外部依赖与配置
- TokenHub：API Key（广州或新加坡站点，与 Base URL 一致）；需在控制台开通视觉、文本、语音模型；语音模型需在「在线推理 → 语音模型」开启后付费。
- 小程序码：使用内置静态资源 `miniprogram/assets/wxacode.png`（从公众平台下载），无需云函数或 openapi 权限。
- 语言/音色：`common/languages.js`（`en/ja/ko/fr/es/de`），通过 `npm run sync:levels` 同步到 recognize/compose/tts。
- 分类枚举：`common/categories.js`（与 levels/languages 同级），同步到 recognize。
- 本地存储：识别记录与单词本存 `wx.setStorageSync` + `USER_DATA_PATH`，本期不跨设备。
- 虚拟支付：当前主体为**个人**，虚拟支付尚未开通；一次性 30 天会员方案待开通后再实施（价格/商品/权益待定）。
- 云开发环境：`project.config.json` 需配置 `appid` 与 `cloudfunctionRoot`。
- 云函数依赖各自的 `package.json`，部署走开发者工具「上传并部署：云端安装依赖」；`recognize`/`compose`/`tts` 超时约 20s，`analyze` 建议 **30s**（provider 20s）。
- Canvas 导出尺寸控制在 1365 以内（分享图 1080×1350）；Canvas 不套用 EXIF，图片需在识别前归一化方向。
- **不要使用「微信同声传译」插件**：该插件已在微信服务市场下架，无法新增。

## 11. 待定问题
- 视觉模型 bbox 精度需实测；效果差时考虑 `youtu-vita` 或编号图例。
- EXIF 方向归一化在真机上的可靠性需验证（`getImageInfo` / Canvas 旋转）。
- 各语言 TTS 音色质量需真机试听；部分音色可能带口音。
- 多语言 prompt（日/韩/法/西/德）的识别与组句质量需抽测。
- TokenHub 视觉/文本/语音模型名称与账号可用配额（用 `TOKENHUB_*_MODEL` 覆盖）。
- 虚拟支付（个人主体）的开通路径、商品配置、价格与会员权益待定。
- 自动续费订阅（P2）需等发布满 90 天、DAU 达标后再评估。
- 孩子独立使用 vs 家长操作，是否需要家长身份。
