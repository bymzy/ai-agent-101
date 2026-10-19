# 看图学外语小程序

拍照/选图 → AI 识别物体并标注目标语言单词 → 组成句子 → 合成语音播放。按入门/进阶/高级分难度，支持英语/日语/韩语/法语/西班牙语/德语；结果页展示原图与单词标注，并可导出一张带原图、句子和小程序码的分享图。

技术栈：原生微信小程序 + 微信云开发。识别、组句、语音合成都通过云函数调用腾讯云 TokenHub。详见 `docs/spec.md`。

## 目录结构

```
miniprogram/            小程序前端
  common/levels.js      难度配置（入门/进阶/高级）
  common/languages.js   语言配置（en/ja/ko/fr/es/de + TTS voice）
  common/categories.js  物品分类枚举
  utils/cloud.js        云函数调用封装
  utils/image.js        图片方向归一化 / 压缩 / 云存储下载
  utils/speech.js       TTS 封装（缓存优先 + 播放）
  utils/history.js      本地识别记录（10 条）
  utils/wordbook.js     本地单词本
  utils/share-image.js  分享图 Canvas 绘制与导出
  utils/mock.js         本地调试用 mock（useLocalMock）
  pages/history/        识别记录页
  pages/wordbook/       单词本页
cloudfunctions/         云函数
  recognize/            图片识别（scene + words + category + bbox）
  compose/              组句（使用 scene + 老师人设）
  tts/                  语音合成（TokenHub MiniMax）
  analyze/              组合接口：一次视觉请求返回 words + scene + sentence
scripts/sync-levels.js  把 levels.js / languages.js / categories.js 同步到各云函数目录
docs/spec.md            需求规格
todo.md                 待办
```

## 当前配置

- AppID：`wx232c37e00f6becb5`
- 云开发环境：`cloud1-d1gvxyrae03955eec`（已写入 `miniprogram/config.js`）
- `useLocalMock`：默认 `false`，即走真实云函数

## 支持语言

| 语言 | id | 默认音色 |
|---|---|---|
| 英语 | `en` | `English_Graceful_Lady` |
| 日语 | `ja` | `Japanese_KindLady` |
| 韩语 | `ko` | `Korean_SweetGirl` |
| 法语 | `fr` | `French_Female_News Anchor` |
| 西班牙语 | `es` | `Spanish_SereneWoman` |
| 德语 | `de` | `German_FriendlyMan` |

## TokenHub 环境变量

### recognize / compose
```
AI_PROVIDER          = tokenhub
TOKENHUB_API_KEY     = <TokenHub API Key>
TOKENHUB_BASE_URL    = https://tokenhub.tencentmaas.com/v1
TOKENHUB_VISION_MODEL= hy-vision-2.0-instruct
TOKENHUB_TEXT_MODEL  = hy3
```

### tts
```
TOKENHUB_API_KEY     = <同一个 TokenHub API Key>
TOKENHUB_BASE_URL    = https://tokenhub.tencentmaas.com/v1
TOKENHUB_TTS_MODEL   = minimax-speech-2.8-turbo
TOKENHUB_TTS_VOICE   = minimax_55e81114-ce7e-4ca1
TOKENHUB_TTS_SPEED   = 1
```

### analyze
```
TOKENHUB_API_KEY       = <同一个 TokenHub API Key>
TOKENHUB_BASE_URL      = https://tokenhub.tencentmaas.com/v1
TOKENHUB_COMBINED_MODEL= deepseek/deepseek-flash
```

- 各语言音色集中在 `miniprogram/common/languages.js` 并由 `npm run sync:levels` 同步到云函数；`TOKENHUB_TTS_VOICE` 只作为兜底。
- 当前音色：英 `English_Graceful_Lady`、日 `Japanese_KindLady`、韩 `Korean_SweetGirl`、法 `French_Female_News Anchor`、西 `Spanish_SereneWoman`、德 `German_FriendlyMan`。

- API Key 在 https://console.cloud.tencent.com/tokenhub/apikey 创建（地域选广州），并在模型广场开通所用模型。
- 语音合成还需在「在线推理 → 语音模型」开启对应模型的后付费。
- Key 只放云函数环境变量，绝不能写进 `miniprogram/`。
- `recognize` / `compose` / `tts` 超时约 20s；`analyze` 设为 **30s**。
- 广州与新加坡站点的 API Key 不互通，Base URL 与 Key 必须同站点。

## 部署

```bash
wechatide -c opencode cloud_fn_deploy --appid wx232c37e00f6becb5 \
  --env cloud1-d1gvxyrae03955eec \
  --path cloudfunctions/recognize --remote-npm-install

wechatide -c opencode cloud_fn_deploy --appid wx232c37e00f6becb5 \
  --env cloud1-d1gvxyrae03955eec \
  --path cloudfunctions/compose --remote-npm-install

wechatide -c opencode cloud_fn_deploy --appid wx232c37e00f6becb5 \
  --env cloud1-d1gvxyrae03955eec \
  --path cloudfunctions/tts --remote-npm-install

wechatide -c opencode cloud_fn_deploy --appid wx232c37e00f6becb5 \
  --env cloud1-d1gvxyrae03955eec \
  --path cloudfunctions/analyze --remote-npm-install
```

部署是写操作，会弹确认框。也可在 IDE 里右键「上传并部署：云端安装依赖」。

## 识别与标注

- `recognize` 返回 `{ scene, words }`；按当前 `lang` 输出目标语言单词 + 中文释义 + 物品分类（`category`）；每个单词可带归一化 `bbox`（0–1，左上角原点）。
- 结果页用 `<image mode="widthFix">` 展示原图，按百分比叠加框和单词标签。
- 上传前在客户端做方向归一化与长边压缩（约 1280px），确保识别、展示、导出使用同一张图。
- 无 `bbox` 的词不画框，仍显示在单词列表。

## 组句与学习工具

- 结果页自动调用 `compose`，保留「换一句」；组句使用语言老师人设，结合 `scene` 生成完整句子。
- 识别记录：本地保存最近 **10 条**，结果页自动写入；首页「识别记录」查看，点击还原结果页。
- 单词本：结果页单词右侧星标即时收藏；首页「单词本」按语言/分类分组，可删除。
- 历史图片复制到 `USER_DATA_PATH/history/`；`USER_DATA_PATH` 约 10MB，需注意图片/音频缓存总量。

## 组合接口（analyze）

- `config.useCombinedAnalyze` 默认 `true`：首页一次调用 `analyze`，同一次视觉请求返回 `words + scene + sentence`。
- 句子为空或未满足当前难度的 `minWords` 时，`analyze` 返回空 sentence，结果页自动回退 `compose`。
- 「换一句」仍走 `compose`（文本），不重新发图。
- `analyze` 云函数超时建议 **30s**（provider 20s）。

## 分享图

- 结果页用隐藏 Canvas 2D 合成 **1080×1350** 图片：原图 + 标注 + 目标语言句子 + 中文翻译 + 小程序码。
- 通过 `wx.showShareImageMenu` 分享；小程序码使用内置静态资源 `miniprogram/assets/wxacode.png`（扫码打开首页），不再按图片生成。
- 静态码从微信公众平台「设置 → 基本设置 → 小程序码与线下物料」下载，替换该文件即可。
- Canvas 不套用 EXIF，所以必须在识别前归一化图片方向，否则分享图会旋转/错位。

## 语音合成

- 云函数 `tts` 调 TokenHub `POST /v1/wand/minimax-tts/sync_tts`，按 `lang` 选择音色，返回 hex 音频，云函数转 base64 下发。
- 播放前先按 `lang+voice+text` 查 `USER_DATA_PATH/tts-<hash>.mp3`；命中直接播放，**不再请求合成**；未命中才调用并落盘。
- 结果页进入后静默预生成句子音频（不自动播放）；点击单词卡片可听该词发音。单词、句子、跟读录音共用单一音频上下文，快速连点只播最后一个。
- 不使用「微信同声传译」插件（已下架）。

## 本地预览（无云环境时）

把 `miniprogram/config.js` 的 `useLocalMock` 改为 `true`，识别/组句走 `miniprogram/utils/mock.js`；`tts` 仍需要云函数，本地 mock 模式下语音会失败。

## 厂商适配层

- 每个云函数 `providers/` 下按厂商分文件，导出统一接口：
  - `recognize(imageBuffer, { level, levelConfig, langConfig }) -> { scene, words: [{ word, translation, confidence, level, category, bbox? }] }`
  - `compose(words, { level, levelConfig, scene, langConfig }) -> { sentence, translation, usedWords }`
  - `synthesize(text, { voice }) -> { audioBase64, mime, size, durationMs }`
- `AI_PROVIDER` 选择识别/组句实现，当前支持 `mock`、`tokenhub`。

## 已核对的上游事实

- TokenHub 兼容 OpenAI Chat Completions：`POST {baseUrl}/chat/completions`，`Authorization: Bearer <API KEY>`。
- 图片用 Base64：`{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,..."}}`。
- 视觉模型：`hy-vision-2.0-instruct`（快）；可选 `hunyuan-t1-vision-20250916`（英文更强、较慢）。
- 文本模型：`hy3`（默认开启深度思考，组句请求已显式关闭）；也可换 `deepseek/deepseek-flash`、`glm-5.3-flash` 等。
- 备选模型：DeepSeek-V4.1-Flash（`deepseek/deepseek-flash`）同时支持图片理解与文本生成；已实测可同时用于识别/组句（en/ja），切换只需改 `TOKENHUB_VISION_MODEL` / `TOKENHUB_TEXT_MODEL`。
- DeepSeek 视觉默认开启思考；`recognize` 在模型名含 `deepseek` 时已显式加 `thinking: {type:'disabled'}`，避免真实图片超过 provider 的 15s 超时。
- TTS：`POST {baseUrl}/wand/minimax-tts/sync_tts`，模型 `minimax-speech-2.8-turbo` / `minimax-speech-2.8-hd`。
- 小程序码：使用内置静态图片 `miniprogram/assets/wxacode.png`，无需云函数或 openapi 权限。

## 已知风险 / 待办

完整清单见 `todo.md`。当前主要遗留：bbox 精度与 EXIF 真机验证、真实照片与图片分享实测、隐私声明。

- 识别记录/单词本本期存本地，不跨设备；`USER_DATA_PATH` 约 10MB，注意历史图片与 TTS 缓存总量。
- 组合接口 `analyze` 输出更长，可能比两段式慢；超时先调 30s，必要时把 `useCombinedAnalyze` 设为 `false` 回退两段式。
- 静态小程序码指向**线上已发布版本**；开发版扫码可能无法进入当前开发版。

- 需在 TokenHub 控制台开通所选模型（含语音模型），否则返回 `402`。
- 语音 `voice_id` 需换成适合英文教学的系统音色（可在 TokenHub 语音模型控制台查看）。
- 分享图在 Android 上尺寸过大易 crash，已限制 1080×1350。
