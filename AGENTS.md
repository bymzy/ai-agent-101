# AGENTS.md

## 项目目标
微信小程序：拍照/选图 → AI 识别图中物体并标注目标语言单词 → 用这些单词组成一句目标语言句子 → 转成语音播放。按入门/进阶/高级分难度，支持英语/日语/韩语/法语/西班牙语/德语；结果页展示原图与单词标注，并支持导出分享图、识别记录与单词本。学习闭环：单词本闪卡复习（Leitner 间隔重复）、识别记录场景回忆、结果页跟读录音、首页打卡统计；识别词附带音标/假名/罗马音。

## 当前状态
已搭建可运行骨架（原生小程序 + 3 个云函数）。识别/组句/语音合成都已接入**腾讯云 TokenHub**（`tokenhub` provider，OpenAI 兼容接口 + API Key）；支持六种语言，难度为入门/进阶/高级。结果页展示原图与 bbox 标注，并支持导出带静态小程序码的分享图。本轮 P0 已实现：TTS 缓存优先、结果页自动组句（保留「换一句」）、语言老师人设、单词分类、本地识别记录（10 条）、本地单词本（星标收藏）。
未配置 `TOKENHUB_API_KEY` 时会失败；识别/组句可临时切回 `mock`。`miniprogram/config.js` 的 `useLocalMock` 默认为 `false`（走云函数）；只想看 UI 时改为 `true`（此时 TTS 仍会因走云函数而失败）。

## 已定技术选型（勿擅自更改）
- 原生微信小程序（WXML/WXSS/JS），**不用** Taro / uni-app，因此没有前端构建步骤。
- AI 视觉识别、组句、语音合成全部放在**微信云开发云函数**里，客户端只通过 `wx.cloud.callFunction` 调用。
- TTS 用云函数 `tts` 调 TokenHub MiniMax 同步语音合成；前端 `utils/speech.js` 的 `speak(text)` 负责调用、落盘缓存与播放。
- **不要再用「微信同声传译」插件**：该插件已在微信服务市场下架，无法新增；`app.json` 不应再声明 `plugins.WechatSI`。
- 识别/组句/语音均已接入**腾讯云 TokenHub**：`Authorization: Bearer <API KEY>`，不用 SecretId/SecretKey、不用腾讯云 SDK。必须封装在云函数内的适配层（`providers/`），`AI_PROVIDER` 切换识别/组句实现，保留 `mock` 兜底。
- 结果页图片标注用 WXML 百分比覆盖层；分享图用隐藏 Canvas 2D 合成，通过 `wx.showShareImageMenu` 分享；分享图右下角使用**内置静态小程序码** `miniprogram/assets/wxacode.png`（扫码打开首页），不要按图片调用 `getUnlimited`。
- 可选**组合接口** `analyze`：一次视觉请求返回 `words + scene + sentence`；小程序用 `config.useCombinedAnalyze` 控制，默认开启。`compose` 仍用于「换一句」，不重新发图。

## 目录约定
```
miniprogram/        # 小程序前端
  common/levels.js  # 难度（入门/进阶/高级）
  common/languages.js # 语言与 TTS 音色（en/ja/ko/fr/es/de）
  common/categories.js # 物品分类枚举
  utils/image.js    # 图片方向归一化 / 压缩 / 云存储下载
  utils/speech.js   # TTS 缓存优先 + 播放（含 playLocal，单一音频上下文）
  utils/recorder.js # 跟读录音（60s、临时文件、不持久化）
  utils/history.js  # 本地识别记录（10 条）
  utils/wordbook.js # 本地单词本
  utils/review.js   # 闪卡 Leitner 状态（reviewState）
  utils/stats.js    # 打卡统计（stats，每日目标 5 词）
  utils/share-image.js # 分享图 Canvas 绘制
  pages/history/    # 识别记录页
  pages/wordbook/   # 单词本页（复习入口、待强化标记）
  pages/review/     # 单词闪卡（看词选义 / 看义忆词 / 听音选词）
  pages/recall/     # 场景回忆（历史图片隐藏标注，点击揭晓并自评）
cloudfunctions/     # 云函数根目录，必须写入 project.config.json 的 cloudfunctionRoot
  recognize/        # 图片识别（scene + words + category + bbox）
  compose/          # 组句（使用 scene + 老师人设）
  tts/              # 语音合成（TokenHub MiniMax，按语言选音色）
  analyze/          # 组合接口：一次视觉请求返回 words + scene + sentence
```
每个云函数目录**各自**有 `package.json`，依赖需在该目录内 `npm install`，不是在仓库根目录。
`common/levels.js`、`common/languages.js`、`common/categories.js` 通过 `npm run sync:levels` 同步到对应云函数，**不要手工维护云函数里的副本**。

## 云开发关键约束（易踩坑）
- 密钥/AppSecret 只放云函数环境变量或云端配置，**绝不能**出现在 `miniprogram/` 代码里（会被反编译）。
- TokenHub 需要：`AI_PROVIDER=tokenhub`、`TOKENHUB_API_KEY`、`TOKENHUB_BASE_URL`、`TOKENHUB_VISION_MODEL`、`TOKENHUB_TEXT_MODEL`（recognize/compose）；`tts` 另需 `TOKENHUB_TTS_MODEL`、`TOKENHUB_TTS_VOICE`、`TOKENHUB_TTS_SPEED`；`analyze` 需 `TOKENHUB_API_KEY`、`TOKENHUB_BASE_URL`、`TOKENHUB_COMBINED_MODEL`（缺省回退 `TOKENHUB_VISION_MODEL`）。四个云函数都要配 `TOKENHUB_API_KEY` 与 `TOKENHUB_BASE_URL`。
- 各语言 TTS 音色在 `common/languages.js`（英 `English_Graceful_Lady`、日 `Japanese_KindLady`、韩 `Korean_SweetGirl`、法 `French_Female_News Anchor`、西 `Spanish_SereneWoman`、德 `German_FriendlyMan`）；`TOKENHUB_TTS_VOICE` 仅兜底。
- TokenHub 只认 API Key（`Authorization: Bearer`），**不要**用 `SecretId/SecretKey`；广州/新加坡 API Key 不互通。
- 模型可通过 `TOKENHUB_VISION_MODEL` / `TOKENHUB_TEXT_MODEL` 切换；已实测 DeepSeek-V4.1-Flash（`deepseek/deepseek-flash`）作为识别/组句备选，en/ja 正常。
- DeepSeek 视觉默认开启深度思考，真实图片容易超过 provider 的 15s 超时；`recognize` 已在模型名含 `deepseek` 时显式加 `thinking: {type:'disabled'}`。若仍超时，再把 provider 超时调到 25s、云函数调到 30s。
- `recognize`/`compose`/`tts` 超时约 20s；`analyze` 建议 **30s**（provider 20s）。
- 图片先 `wx.cloud.uploadFile` 到云存储，把 `fileID` 传给云函数；云函数用 `cloud.downloadFile` 取回。不要传 base64 大图。
- **上传前先归一化图片方向**：`<image>` 会套 EXIF，Canvas 不会；用 `utils/image.js` 旋转 + 长边压到约 1280px，保证展示、bbox、分享图坐标一致。
- 结果页 bbox 用百分比绝对定位；分享图用隐藏 Canvas 2D，导出尺寸控制在 1365 以内（当前 1080×1350）。
- 分享图的小程序码是**静态资源** `miniprogram/assets/wxacode.png`，从公众平台下载后替换；不要为此新增云函数或 openapi 权限。
- TTS 云函数把 TokenHub 返回的 hex 音频转 base64 下发；前端播放前先按 `lang+voice+text` 查 `USER_DATA_PATH/tts-<hash>.mp3`，命中直接播放、不调云函数；未命中才请求并落盘。云函数响应体需控制在约 1MB 内，文本限制 500 字。
- 识别记录/单词本本期存本地：`history` 最多 10 条，图片复制到 `USER_DATA_PATH/history/`；`wordbook` 按 `lang+word` 去重；`reviewState` 存 Leitner 状态、`stats` 存打卡统计。`USER_DATA_PATH` 约 10MB，需注意图片/音频缓存总量。
- 识别 prompt 返回固定 `category`（`common/categories.js`），非法值归「其他」；组句 prompt 使用语言老师人设。识别词可附带可选 `phonetic`（en/fr/es/de 用 IPA、ja 用平假名、ko 用罗马音），空则省略，前端必须 `wx:if` 渲染。
- 跟读录音只存临时文件、不上传不持久化；播放统一走 `utils/speech.js` 的共享 `InnerAudioContext`（`speak` / `playLocal` 互斥），不要新建音频上下文。麦克风需在公众平台隐私指引声明。
- 共享配置（`levels.js` / `languages.js` / `categories.js`）被同步到**云函数根目录**；`providers/*.js` 引用时用 `../categories`，不要写成 `./categories`。
- 走云函数可绕开 `wx.request` 的服务器域名白名单；若改为直连 HTTP，记得在小程序后台配置合法域名。
- 部署云函数用 IDE「上传并部署：云端安装依赖」，或 `wechatide cloud_fn_deploy --appid <appid> --env <env> --path <abs目录> --remote-npm-install`（写操作，需在 IDE 点确认）。CLI 部署不会应用 `config.json` 权限。
- 分享卡片用页面 `onShareAppMessage` 返回 `title`/`path`/`imageUrl`；分享图需是本地或云存储可访问资源。

## 分难度（入门/进阶/高级）
难度影响词表范围与组句复杂度。`common/levels.js` 是难度定义（入门/进阶/高级），`common/languages.js` 是语言与音色；两者通过 `npm run sync:levels` 同步到云函数，避免前后端漂移。

## 待办
完整清单见 `todo.md`。本轮 P0 已实现并完成本地/云端联调：
1. 组合接口 `analyze` 已部署并验证 en/ja；用真实照片复测延迟与质量。
2. 实测识别记录 10 条上限与旧图片清理（保存/还原/不重复已验证）。
3. 真机验证各语言 TTS 音色、EXIF 方向、Canvas 分享图、`wx.showShareImageMenu`。
4. 发布前配置 `wx.chooseMedia` 隐私声明与内容合规。
