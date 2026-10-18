# TODO

> 更新于 2026-10-17。主链路（识别 → 组句 → 语音）已用合成图形跑通。
> P0（图片标注 + 导出分享图 + 场景关联）代码已完成，待部署与实测。
> 新增 P0：多语言（英/日/韩/法/西/德）+ 难度改名（入门/进阶/高级）。
> 本轮新增：语音缓存、去掉生成按钮、老师人设、物品分类、本地识别记录、本地单词本。
> 虚拟支付：主体为个人、尚未开通；一次性 30 天会员方案待开通后实施。

## P0 · 学习体验（本轮）

> 代码已完成；本地流程（自动组句、历史、单词本、TTS 缓存）与部署后的 category/老师人设均已验证。

### A. 语音缓存
- [x] `utils/speech.js` 播放前先查 `USER_DATA_PATH/tts-<hash>.mp3`；命中直接播放，不调 `tts`
- [x] hash 使用 `lang + voice + text`（voice 从 `common/languages.js` 取）
- [x] 未命中才调用 `tts`，成功后落盘；文件损坏/缺失时回退
- [x] 第二次播放不发起合成请求（已验证缓存文件数不再增加）

### B. 组句交互
- [x] 结果页自动生成句子
- [x] 去掉「生成句子」按钮，保留「换一句」入口
- [x] 自动生成失败时提供重试入口
- [x] 组句 prompt 改为语言老师人设（耐心、鼓励、按难度教学）
- [x] 部署 compose 并验证输出（返回完整句子）

### C. 单词分类
- [x] 新增 `common/categories.js` 固定枚举（动物/食物/水果蔬菜/家具家居/交通工具/自然/人物/衣物/颜色形状/文具玩具/电子产品/建筑地点/其他）
- [x] `recognize` prompt 返回 `category`；服务端校验，非法归「其他」
- [x] 结果页单词卡片显示分类标签
- [x] 历史/单词本复用分类（分享图仍以单词标签为主）
- [x] 部署 recognize 并验证 category 输出（`square/circle` → `颜色形状`）

### D. 识别记录（本地）
- [x] `utils/history.js`：最近 10 条（总量），FIFO
- [x] 图片复制到 `USER_DATA_PATH/history/`，避免临时路径失效
- [x] 新增 `pages/history/history`：缩略图、时间、语言、句子
- [x] 结果页保存记录、历史点击还原；不重复写记录（已验证）
- [x] 首页「识别记录」入口
- [ ] 实测 10 条上限与旧图片清理

### E. 单词本（本地）
- [x] 结果页单词右侧星标，点击即时收藏
- [x] `utils/wordbook.js`：按 `lang + word` 去重；字段 word/translation/category/lang/level/addedAt
- [x] 已收藏状态显示
- [x] 新增 `pages/wordbook/wordbook`：按语言/分类分组、删除
- [x] 首页「单词本」入口
- [x] 实测星标收藏、单词本分组与删除

## P0 · 组合接口 analyze

- [x] 新增 `cloudfunctions/analyze/`：一次视觉请求返回 `words + scene + sentence`
- [x] 同步 `levels.js` / `languages.js` / `categories.js` 到 analyze
- [x] 前端 `config.useCombinedAnalyze` + `utils/cloud.analyze` + 首页调用
- [x] 句子为空或 `usedWords` 不足时回退 `compose`
- [x] 部署 analyze（首次部署竞态后重跑成功）
- [x] 在控制台把 analyze 超时设为 **30s**
- [x] 给 analyze 配 `TOKENHUB_API_KEY` / `TOKENHUB_BASE_URL` / `TOKENHUB_COMBINED_MODEL`
- [x] 组合接口实测：256×256 3.7s、1600×2000 4.9s、ja 3.1s；words/scene/sentence 正常
- [x] UI 流程：结果页直接有句子；「换一句」走 compose，历史同步更新
- [ ] 真实照片测试：延迟、句子质量、分类/bbox

## P1 · 每日额度与会员（阻塞：虚拟支付未开通）

**已确认**
- 主体：个人；虚拟支付尚未开通。
- 方案：一次性 30 天会员（不做自动续费）；价格/商品等开通后再定。
- 普通用户每天 3 张，会员不限。

- [ ] 开通虚拟支付（个人主体路径），配置 offerId / appKey / 商品
- [ ] `quota` 云函数：openid + 自然日（中国时区）计数；会员跳过
- [ ] `pay` 云函数：生成 signData / paySig / signature（需 AppSecret 换 session_key）
- [ ] `payNotify` 云函数：处理 `xpay_goods_deliver_notify` / `query_order`
- [ ] 云数据库 `usage` / `subscriptions` / `orders`（集合名加前缀，避免与同环境项目冲突）
- [ ] 付费墙页面 `pages/pay`
- [ ] 每日限额与会员状态前端展示
- [ ] iOS/Android 支付差异与 Apple 规则

## P0 · 多语言 + 难度改名

**目标**
- 难度展示改为「入门 / 进阶 / 高级」。
- 支持语言：英语、日语、韩语、法语、西班牙语、德语（`en` / `ja` / `ko` / `fr` / `es` / `de`）。
- 识别、组句、语音、分享图都按当前语言工作。

### A. 难度改名
- [x] `common/levels.js` 的 `name` 改为 入门 / 进阶 / 高级（id 保留 `primary` / `junior` / `senior`）
- [x] 云函数 prompt 使用 `levelConfig.name`
- [x] 首页 / 结果页 / spec / AGENTS / README 文案同步

### B. 语言配置
- [x] 新增 `common/languages.js`：`en` / `ja` / `ko` / `fr` / `es` / `de`
- [x] 扩展 `scripts/sync-levels.js`，把 `languages.js` 同步到 recognize / compose / tts
- [x] 首页语言选择器 + `app.globalData.lang` + storage
- [x] 结果页显示当前语言

### C. 识别 / 组句
- [x] `recognize` 入参增加 `lang`；prompt 输出目标语言单词 + 中文释义
- [x] `compose` 入参增加 `lang`；prompt 输出目标语言句子 + 中文翻译
- [x] `utils/cloud.js` 传递 `lang`
- [x] 保持 bbox 去重与 scene 逻辑

### D. TTS 多语言
- [x] `tts` 入参增加 `lang`；按语言选 voice
- [x] `speech.speak(text, { lang })`
- [x] 各语言 `voice_id` 实测
- [x] 六种语言均有可用音色，无需降级

### E. voice_id 测试结果
- [x] 默认 `minimax_55e81114-ce7e-4ca1` 六种语言均可合成
- [x] 可用原生音色：
  - 英：`English_Graceful_Lady`、`English_Trustworth_Man`
  - 日：`Japanese_IntellectualSenior`、`Japanese_KindLady`
  - 韩：`Korean_SweetGirl`、`Korean_CheerfulBoyfriend`
  - 法：`French_Female_News Anchor`（`French_Male_News Anchor` 不存在）
  - 西：`Spanish_SereneWoman`、`Spanish_MaturePartner`
  - 德：`German_FriendlyMan`（`German_ConfidentWoman` 不存在）
- [x] 已写入 `languages.js`：英 `English_Graceful_Lady` / 日 `Japanese_KindLady` / 韩 `Korean_SweetGirl` / 法 `French_Female_News Anchor` / 西 `Spanish_SereneWoman` / 德 `German_FriendlyMan`
- [ ] 真机试听各语言发音质量

### F. 分享图与文档
- [x] 分享图句子用目标语言、翻译用中文
- [x] 页面文案按语言调整（`{{langName}}句子`）
- [x] README / AGENTS / spec 同步
- [x] 六种语言各跑一次：识别 → 组句 → 语音
- [x] 韩语识别返回颜色词的问题：已加强 prompt 并验证（返回 정사각형 / 원）
- [ ] 真机试听六种语言发音质量

**风险**
- 各语言音色质量需真机试听；部分音色可能带口音。
- Canvas 对复杂文字排印有限；先覆盖拉丁 + 日韩。


## P0 · 图片标注 + 导出分享图

**已确认方案**
- 物体标注：近似框 + 单词标签。
- 小程序码：扫码打开首页。
- 同时实现「图片关联组句」：`recognize` 返回 `scene`，`compose` 使用 `scene`。

### A. 识别返回场景与 bbox
- [x] `recognize` prompt 返回 `{ scene, words }`；每个 word 可带归一化 `bbox`
- [x] prompt 要求只描述真实可见内容、框尽量贴紧、不确定时省略
- [x] `recognize/providers/tokenhub.js` 解析对象/数组/裸数组；校验并钳制 bbox；`scene` 截断 300 字
- [x] `recognize/index.js` 出参增加 `scene`，并透传 bbox
- [x] 部署 `recognize` 并验证 bbox 准确度（合成图 bbox 与物体位置一致；bbox 去重已验证）

### B. 组句使用场景
- [x] `compose/index.js` 接收并校验可选 `scene`
- [x] `compose/providers/tokenhub.js` prompt 注入 `图片场景：${scene}`
- [x] 保留去重、严格重试、`thinking: disabled`
- [x] `miniprogram/utils/cloud.js` 改为 `compose(words, level, scene)`
- [x] 部署 `compose` 并验证句子贴合图片（返回 `The square is red and the circle is blue.`）

### C. 结果页展示图片与标注
- [x] `pages/index/index.js` 保存 `fileID` / `imagePath` / `scene`
- [x] 新增 `utils/image.js`：读方向、旋转归一化、长边压到约 1280px
- [x] 上传 / 展示 / 导出统一使用归一化后的图片
- [x] `pages/result/result.wxml` 新增图片区 + 百分比 bbox + 单词标签
- [x] 无 bbox 的词不画框，仍显示在下方列表；无本地图时隐藏图片区
- [x] `result.wxss` 增加图片容器、bbox、标签样式
- [ ] 真机验证竖拍照片的 EXIF 方向与 bbox 对齐

### D. 导出分享图
- [x] 新增 `utils/share-image.js`：Canvas 绘制、英文按词换行、中文按字换行
- [x] 结果页放隐藏 Canvas 2D，输出 1080×1350
- [x] 布局：原图 + 标注 + 目标语言句子 + 中文翻译 + 小程序码
- [x] `wx.canvasToTempFilePath` → `wx.showShareImageMenu`
- [x] 分享按钮改为 `bindtap="shareImage"`；无句子/无图时禁用
- [x] 保留右上角卡片分享作为兜底，路径携带 `scene`
- [x] 分享图/小程序码失败时的降级提示
- [ ] 模拟器/真机实测 `wx.showShareImageMenu` 与分享图效果

### E. 小程序码（静态）
- [x] 使用内置静态资源 `miniprogram/assets/wxacode.png`（从公众平台下载）
- [x] 移除 `cloudfunctions/wxacode/` 与客户端 `getWxacode()` 调用
- [x] 分享图直接读取静态资源（已生成约 80KB 分享图）
- [ ] 扫描静态码验证打开小程序首页
- [ ] 静态码指向线上版本；开发版扫码可能无法进入当前开发版

### F. 文档与测试
- [x] 同步 README / AGENTS / docs/spec
- [x] 合成图测试：bbox、标签、scene、组句、分享图（256×256 与 1600×2000 竖图；分享图已生成 75KB，含小程序码）
- [ ] 竖拍真实照片测试：EXIF、bbox、分享图不旋转
- [ ] 无 bbox / 无小程序码的降级路径

**风险**
- `hy-vision-2.0-instruct` 的 bbox 可能不精准；先实测再决定是否换模型。
- Canvas 不套用 EXIF；方向归一化需真机复验。
- 静态小程序码指向线上版本，开发版扫码可能无法进入当前开发版。

## P1 · 模型备选（DeepSeek-V4.1-Flash）

- [x] 环境变量切换后 en/ja 识别 → 组句实测正常（en compose ~1.9s，ja ~2.4s）
- [x] 视觉/文本均已切到 `deepseek/deepseek-flash`，en/ja 实测通过
- [x] `recognize` 对 DeepSeek 显式加 `thinking: disabled`；1600×2000 大图 7.4s 通过
- [ ] 真实照片复测：是否仍超时、bbox/多语言质量对比 Hunyuan
- [x] 已实现 `analyze` 组合接口（一次视觉请求返回 words + scene + sentence）

## P1 · 质量与体验

- [ ] TTS 英文音色：默认 `minimax_55e81114-ce7e-4ca1`，确认是否适合英文教学；否则改 `TOKENHUB_TTS_VOICE`
- [ ] 真机试听 TTS（模拟器只能验证文件生成与播放状态）
- [ ] 用真实照片跑一次完整链路
- [ ] 实测微信图片分享与接收方打开效果
- [ ] 结果页是否展示 `scene` 摘要
- [ ] 卡片分享的 `imageUrl`（兜底路径）是否使用分享图

## P1 · 合规与发布

- [ ] 公众平台「用户隐私保护指引」声明：`wx.chooseMedia` → 「收集你选中的照片或视频信息」
- [ ] K12 场景的内容合规：对 AI 返回的单词/句子做敏感内容过滤
- [ ] 发布前检查：隐私接口、域名、三个云函数超时（均为 20s）
- [ ] TokenHub 用量/费用监控与简单频控

## P2 · 工程优化

- [ ] 识别结果按图片 hash 缓存，避免重复调用
- [ ] TTS 本地缓存清理：`USER_DATA_PATH` 约 10MB 上限，增加 LRU/定期清理
- [ ] 分享图按 `sentence + image` hash 缓存，避免重复绘制
- [ ] TokenHub 失败时的重试与用户提示
- [ ] 分享参数长度保护：`scene` + `sentence` 过长时截断或改用云端记录
- [ ] `useLocalMock: true` 时明确提示「TTS 仍走云函数，本地预览不可用」

## 已完成（避免重复）

- [x] 原生小程序骨架 + 首页 / 结果页
- [x] TokenHub `recognize` / `compose` / `tts` 三个云函数
- [x] 识别、组句、语音全链路联调通过（合成图形：`square,circle` → 句子 → 播放 `ended`）
- [x] 组句关闭深度思考（`thinking: disabled`），耗时约 2s
- [x] 识别词去重 + 组句严格重试，保证至少 2 个词
- [x] 移除已下架的「微信同声传译」插件依赖
- [x] 三个云函数超时调到 20s
- [x] `wx-miniprogram-dev` skill 增加 TokenHub / TTS 说明
- [x] 难度改名：入门 / 进阶 / 高级
- [x] 支持英语/日语/韩语/法语/西班牙语/德语 + 首页语言选择器
- [x] 各语言 `voice_id` 实测并写入 `common/languages.js`
- [x] 六种语言识别 → 组句 → 语音联调通过
- [x] 分享图改用内置静态小程序码，不再按图片生成
- [x] 拍照后进入结果页自动生成句子，无需再点「生成句子」
- [x] TTS 缓存优先：第二次播放不请求合成
- [x] 结果页「换一句」+ 失败重试 + 语言老师人设
- [x] 识别词返回固定分类（category），结果页显示
- [x] 本地识别记录（最近 10 条，图片持久化副本）
- [x] 本地单词本（星标即时收藏、按语言/分类分组、删除）
- [x] analyze 组合接口（一次视觉请求返回 words + scene + sentence）
