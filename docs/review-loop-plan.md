# 复习闭环 v1 实现计划（闪卡复习 / 跟读 / 场景回忆 / 音标+打卡）

> 状态：已评审待实施（2026-10-19）。需求已同步至 docs/spec.md 与 todo.md。

## Context

「拍照学外语」现有闭环：拍照 → 识别 → 组句 → 语音 → 收藏/分享，完成「输入 + 理解」，但缺「记忆 + 输出」：单词收藏后无复习机制（遗忘曲线）、全程被动输入（无主动回忆）、无口语输出练习、无进度反馈。新增四项需求：

1. **单词复习闪卡**（间隔重复 + 三种测验模式 + 错词待强化）
2. **跟读练习**（结果页录音，与原音对比；不做 AI 评分——留作会员权益 P2）
3. **场景回忆复习**（历史图片隐藏 bbox，点击揭晓，自评记得/不记得）
4. **音标/假名标注**（云函数返回 phonetic 字段 + 全端展示）+ **学习打卡统计**（每日目标/连续天数/累计）

原则：纯本地为主、零新增云函数（phonetic 是唯一云改动）、复用现有工具（speech.js TTS 缓存、history/wordbook 数据）、K12 合规（录音不上传不外传）。

## 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 场景回忆页面 | 新建独立页 `pages/recall/recall` | 复用 result 页需在 onLoad 加 reveal 状态并绕开 history.save/generateSentence 副作用，独立页零副作用 |
| 回忆→闪卡联动 | 单向窄联动：不记得的词若在单词本 → `review.registerFail(lang, word)` | 一条函数调用，不为未收藏词建状态 |
| 音频冲突 | speech.js 加 `playLocal(filePath)`，继续用唯一共享 InnerAudioContext | `play()` 已先 `context.stop()`，互斥免费获得 |
| Leitner | 5 盒，间隔 `[0,1,2,4,7,14]` 天；答错 → box 0 + `lapsed`（待强化） | 不上 SM-2 复杂度 |
| 复习会话 | 3 轮模式各过一遍：看词选义 → 看义忆词 → 听音选词；每轮打乱到期词，上限 30 题 | 模式主导循环，实现简单 |
| 打卡 UI | 首页统计条，不新建页面 | 3 个数字用一条 `.section` 足够 |
| phonetic | 可选字段，空则省略；服务端 trim + 50 字截断 | 旧记录/无 phonetic 时 `wx:if` 不渲染，天然兼容 |

## Phase A — phonetic 端到端（先做，独立可测）

**云函数（仅此两处云改动）：**
- [../cloudfunctions/recognize/providers/tokenhub.js](../cloudfunctions/recognize/providers/tokenhub.js)：
  - `buildPrompt()`（96-114 行）：新增要求（中文）「为每个单词给出 phonetic 发音标注：英语/法语/西班牙语/德语用国际音标（IPA），日语用平假名，韩语用罗马音；不确定时省略该字段」，示例（112 行）加 `"phonetic":"/skweə(r)/"`。
  - `normalizeResult()` 词条构建处（243-249 行）：`const phonetic = typeof item.phonetic === 'string' ? item.phonetic.trim().slice(0, 50) : ''; if (phonetic) entry.phonetic = phonetic;`
- [../cloudfunctions/analyze/providers/tokenhub.js](../cloudfunctions/analyze/providers/tokenhub.js)：镜像改动（prompt 99-123 行、示例 121 行、`normalizeWords()` 241-247 行）。
- 无需改 `recognize/index.js` / `analyze/index.js`（words 原样透传）。

**Mock 数据（让 `useLocalMock: true` 可验证展示）：**
- [../cloudfunctions/recognize/providers/mock.js](../cloudfunctions/recognize/providers/mock.js)：词元组加第三位音标（如 `['cat', '猫', '/kæt/']`），输出映射 `phonetic`。
- [../miniprogram/utils/mock.js](../miniprogram/utils/mock.js)：`WORDS_BY_LEVEL` 加 `phonetic`（这是前端 mock 实际数据源）。

**前端展示：**
- [../miniprogram/pages/result/result.wxml](../miniprogram/pages/result/result.wxml)：词卡 `.word` 与 `.word-translation` 之间插入 `<view wx:if="{{item.phonetic}}" class="word-phonetic">{{item.phonetic}}</view>`；result.wxss 加 `.word-phonetic`（灰色小字，`#a8adb5` 24rpx）。
- [../miniprogram/utils/wordbook.js](../miniprogram/utils/wordbook.js)：`add()`（23-31 行）加 `phonetic: entry.phonetic || ''`。
- [../miniprogram/pages/wordbook/wordbook.wxml](../miniprogram/pages/wordbook/wordbook.wxml)：词行加 phonetic 展示 + wordbook.wxss 样式。
- [../miniprogram/utils/history.js](../miniprogram/utils/history.js) **无需改动**（71-75 行 `Object.assign` 拷贝自动透传，已核实）。

## Phase B — 闪卡复习 + stats 工具（独立可测）

**新建 [../miniprogram/utils/review.js](../miniprogram/utils/review.js)**（模块模式仿 wordbook.js）：
- 存储键 `'reviewState'`：`{ "en:apple": { box, dueAt, lapsed, updatedAt } }`
- 接口：`loadState()/saveState()/getState(id)`（默认 `{box:0,dueAt:0,lapsed:false}`）、`record(id, correct)`（对：box=min(5,box+1)，dueAt=now+BOX_INTERVALS[box]×1天，lapsed=false；错：box=0，dueAt=now，lapsed=true）、`getDueIds()`（dueAt≤now 或无状态的单词本 id；顺带清理孤儿状态）、`getDueCount()`、`registerFail(lang, word)`（wordbook.isSaved 时 record(id,false)，否则 no-op）。依赖 `../utils/wordbook`（无循环依赖）。

**新建 [../miniprogram/utils/stats.js](../miniprogram/utils/stats.js)**：
- 存储键 `'stats'`：`{ totalAnswered, totalCorrect, days: { "2026-10-19": { answered, correct } } }`
- `record(correct)`（设备本地日期 YYYY-MM-DD，天表裁剪 90 天）、`getSummary()` → `{ todayAnswered, todayCorrect, goal: 5, streak, totalAnswered, totalCorrect }`
- streak：当天未达标则从昨天起算，连续 `answered >= 5` 的天数。

**新建页 [../miniprogram/pages/review/review](../miniprogram/pages/review/review)**（app.json 注册，标题「单词闪卡」）：
- 会话构建（onLoad + 再来一轮）：`due = review.getDueIds()`，空则用全部单词（额外练习照常记录）；3 模式轮询打乱，上限 30 题；每题从 wordbook 解析出 `{word, translation, phonetic, lang}`。
- 三种模式：**看词选义**（词+音标，4 选项=正确释义+同语言干扰项，点选后绿/红锁定，~900ms 自动下一题）；**看义忆词**（只显示中文，点「显示答案」揭晓词+音标，再自评记得/不记得）；**听音选词**（进题自动 `speech.speak(word,{lang})`，可重播，选项同看词选义；TTS 失败 toast「语音不可用」但不阻塞答题）。
- 干扰项不足 2 个时降级为揭晓+自评模式。单词本为空时显示空态 + 去单词本链接。
- 每题答完：`review.record(id, correct)` + `stats.record(correct)`。
- 结束页：答对 x/共 y、待强化词列表、「再来一轮」（错词 dueAt=now 会立即再出现）、「返回」。
- `onUnload/onHide` → `speech.stop()`。单词 TTS 复用现有 `tts-<hash>.mp3` 缓存，无新增持久文件。

**入口：**
- [../miniprogram/pages/index/index.wxml](../miniprogram/pages/index/index.wxml)（50-56 行 tools 行）加 `<navigator class="tool" url="/pages/review/review">单词闪卡</navigator>`。
- [../miniprogram/pages/wordbook/wordbook.wxml](../miniprogram/pages/wordbook/wordbook.wxml) 页头加「共 N 词 · M 个待复习 + 开始复习按钮」；wordbook.js `load()` 补 `dueCount` 与每词 `lapsed` 标记（待强化橙色小徽章），加 `openReview()` 跳转。

## Phase C — 跟读练习（结果页）

**speech.js**：加 `playLocal(filePath)` = 调内部 `play()`（先 stop 后播，与 TTS 自动互斥），导出更新。

**新建 [../miniprogram/utils/recorder.js](../miniprogram/utils/recorder.js)**（单例、Promise 化，仿 speech.js）：
- `getManager()` 懒创建 `wx.getRecorderManager()`（注册 onStart/onStop/onError 一次）；`start()` → `start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' })`，onStart resolve / onError reject；`stop()` → onStop resolve `{tempFilePath, duration}`（60s 上限自动触发 onStop，走同一处理）；`isRecording()`。
- 录音只存临时文件，**不落 USER_DATA_PATH、无持久化**。

**[../miniprogram/pages/result/result.js](../miniprogram/pages/result/result.js) 集成：**
- 新 data：`recordState: 'idle'|'recording'|'recorded'`、`recordPath`、`recordSeconds`、`playingRecord`。
- `toggleRecord()`：idle → `speech.stop()` + `recorder.start()`（errMsg 含 auth/deny → modal「需要麦克风权限」+ `wx.openSetting`）；recording → 清计时器 + `recorder.stop()` → `recordState='recorded'`。
- `playMyRecord()`：`speech.playLocal(recordPath)` 切换播放/停止；`playOriginal()` 复用 `playSentence()`；`discardRecord()` 重置。
- 防护：`playSentence()` 在 recording 状态直接 return；`onUnload` 若在录音则 `recorder.stop()`（释放麦克风）+ `speech.stop()`。

**result.wxml**（`.actions` 行 43-51 行）：加「跟读/停止录音」按钮 + 录音中提示（{{recordSeconds}}s）+ 录制完成面板（播放原音 / 播放我的录音 / 重新录制）。样式复用 `.secondary-btn`，补 `.record-hint`/`.record-panel`。

app.json 无需权限字段。合规：todo.md 增加「公众平台隐私指引声明麦克风（scope.record，用于跟读练习）」。

## Phase D — 场景回忆（独立页）

**新建页 [../miniprogram/pages/recall/recall](../miniprogram/pages/recall/recall)**（app.json 注册，标题「场景回忆」）：
- `onLoad(options.id)` → `history.load()` 找记录；无记录 toast 返回；`imagePath` 失效（fileExists 检查）显示「图片已失效」。
- 词条装饰：`boxStyle`（百分比定位，复制 result.js 的 pct 逻辑）+ `revealed/graded` 标记；无 bbox 词只能经「揭晓」出现。
- `onImageTap(e)`：用 `e.detail.x/y` 与图片显示尺寸/存储尺寸（imageWidth/imageHeight）换算相对坐标，找最近**未揭晓** bbox 揭晓；无未揭晓 bbox 词则按列表序揭晓无 bbox 词。
- `revealNext()`（揭晓按钮）：按列表序揭晓下一个；已揭晓词在图片上显示标签。
- `grade(记得/不记得)`：`stats.record(remembered)`；不记得 → `review.registerFail(record.lang, word.word)`；全部评完 → 总结「记得 x · 不记得 y」+「再练一次」（重置标记）/「完成」（navigateBack）。
- 未揭晓的 bbox 不画可见框（保持挑战性），点击定位靠坐标计算。

**入口：**
- [../miniprogram/pages/history/history.wxml](../miniprogram/pages/history/history.wxml)：每条记录加「回忆」`catchtap="openRecall"`（catchtap 避免同时触发还原）；history.js `openRecall(e)` → `navigateTo /pages/recall/recall?id=xxx`。
- [../miniprogram/pages/index/index.wxml](../miniprogram/pages/index/index.wxml) tools 行加「场景回忆」`bindtap` 项；index.js `openRecall()` → 取 `history.load()[0]` 跳转，无记录 toast。

回忆页自身不写 storage（评分只更新 reviewState/stats，不动 pendingResult）。

## Phase E — 打卡统计条（首页）

- [../miniprogram/pages/index/index.js](../miniprogram/pages/index/index.js)：`onShow()` → `setData({ summary: stats.getSummary() })`；新增 `openReview()`（单词本空则 toast）。
- [../miniprogram/pages/index/index.wxml](../miniprogram/pages/index/index.wxml)：学习工具区之后加 `.section` 统计条：今日复习 x/5 · 连续打卡 N 天 · 累计 M 词，整条 bindtap 进复习页；index.wxss 加 `.stats-row/.stats-cell`（flex，仿 `.tools`）。
- 计分事件：闪卡答题（Phase B）+ 回忆自评（Phase D）。跟读不计入（无评分，避免刷目标）。

## Phase F — 文档、部署、验证

**部署（唯一云改动）：** `wechatide -c opencode cloud_fn_deploy ... --path cloudfunctions/recognize` 与 `.../analyze`（命令见 CLAUDE.md）。无需 `npm run sync:levels`（languages.js 未动，phonetic 规则写死在 prompt）。

**文档：** todo.md 新增「P0 · 复习闭环」四小节清单 + 合规小节加麦克风隐私声明；docs/spec.md 补 FR-2 `phonetic?` 字段、新 FR-10~13（闪卡/跟读/场景回忆/打卡）、页面表加两个新页、本地存储表加 `reviewState`/`stats`；CLAUDE.md 架构段补新页面/utils/存储键/words 契约 phonetic/playLocal 单一音频上下文；AGENTS.md 目录约定同步。

## 边界情况

- 单词本空 → 复习页空态；首页开始复习 toast。
- 无到期词 → 用全部词（练习模式）。
- 干扰项不足 → 降级揭晓+自评。
- TTS 失败/mock 模式 → toast 不阻塞答题。
- 麦克风拒绝 → modal + openSetting；60s 自动 onStop 同手动路径；离开页面释放麦克风。
- 音频冲突 → 全部经单一 InnerAudioContext 互斥。
- 无 phonetic（旧记录/模型未返回）→ `wx:if` 不渲染；wordbook 存量条目 phonetic 为空串。
- reviewState 孤儿（单词已删）→ `getDueIds()` 惰性清理。
- streak 边界 → 当天未达标从昨天回溯；日期用设备本地时区。
- USER_DATA_PATH → 无新增持久文件（录音临时、单词 TTS 复用旧缓存）。

## 验证

**本地 mock（`useLocalMock: true`，测后还原）：**
1. 拍照 → 结果页词卡显示音标；收藏 2-3 词 → 单词本显示音标 + 待复习数。
2. 复习页三模式轮转；答错 → 单词本现「待强化」徽章；总结页再来一轮立即含错词；Storage 面板见 `reviewState`/`stats` 更新。
3. 场景回忆：历史记录 → 点图揭晓最近 bbox → 自评 → 总结；不记得的词（已收藏）变待强化。
4. 首页统计条数字随答题变化；mock 下听音选词走 TTS 失败兜底路径。
5. 空态：空单词本进复习页、空历史点场景回忆。

**模拟器：** app.json 页面注册与导航标题；结果页跟读状态机（无麦克风时验证权限拒绝 modal 路径）。

**云端实测（部署 recognize + analyze 后）：**
1. 真实照片 en 验证 `phonetic` 返回；抽查 ja（假名）/ko（罗马音）/fr/es/de（IPA）；无音标词不渲染。
2. `useCombinedAnalyze: false` 走 recognize 路径同样返回 phonetic。
3. 真机：录音 → 原音/我的录音互斥切换；60s 自动停止；录音中退出页面释放麦克风。
4. 回归：分享图、历史还原（旧记录无 phonetic 正常渲染）、换一句、单词本去重。

## 提交顺序

1. `feat(cloud): phonetic field in recognize/analyze prompts + parsing`（Phase A 云）
2. `feat(client): phonetic display + mock phonetic`（Phase A 前端）
3. `feat(review): flashcards, quiz modes, Leitner state, stats util`（Phase B）
4. `feat(result): sentence shadowing recorder + speech.playLocal`（Phase C）
5. `feat(recall): scene recall page + entries`（Phase D）
6. `feat(home): daily goal/streak strip`（Phase E）
7. `docs: spec/todo/CLAUDE/AGENTS for review loop`（Phase F）

## 关键文件

- [../miniprogram/app.json](../miniprogram/app.json) — 注册 2 个新页面
- [../miniprogram/utils/review.js](../miniprogram/utils/review.js)（新建）— Leitner 状态 + 到期词引擎，F1/F3/F4 核心
- [../miniprogram/utils/stats.js](../miniprogram/utils/stats.js)（新建）— 打卡统计
- [../miniprogram/utils/recorder.js](../miniprogram/utils/recorder.js)（新建）— 录音单例
- [../miniprogram/utils/speech.js](../miniprogram/utils/speech.js) — 加 `playLocal`
- [../miniprogram/pages/result/result.js](../miniprogram/pages/result/result.js) + wxml/wxss — 跟读 + 音标展示
- [../miniprogram/pages/review/review](../miniprogram/pages/review/review)（新建）— 闪卡页
- [../miniprogram/pages/recall/recall](../miniprogram/pages/recall/recall)（新建）— 场景回忆页
- [../cloudfunctions/analyze/providers/tokenhub.js](../cloudfunctions/analyze/providers/tokenhub.js) + [recognize 同路径](../cloudfunctions/recognize/providers/tokenhub.js) — phonetic prompt + 解析
