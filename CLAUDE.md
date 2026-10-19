# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

「拍照学外语」: a native WeChat Mini Program (WXML/WXSS/JS, no Taro/uni-app) backed by WeChat Cloud Development. Flow: choose/photo → normalize and upload image → cloud function calls Tencent Cloud TokenHub → target-language words + Chinese translations + optional phonetic + normalized bbox + scene + sentence → result page renders bbox overlays, plays TTS, records sentence shadowing, exports a share image, and persists local history/wordbook. Learning loop: wordbook flashcards (Leitner), scene recall from history images, and a daily goal/streak strip. Six languages (`en/ja/ko/fr/es/de`), three levels (`primary`/`junior`/`senior`, displayed as 入门/进阶/高级).

No frontend build step, no test suite, no linter. Open the repo root in WeChat DevTools; `project.config.json` defines `miniprogramRoot` and `cloudfunctionRoot`.

Detailed constraints and decision log: `AGENTS.md`. Deployment and env vars: `README.md`. Requirements: `docs/spec.md`.

## Commands

- `npm run sync:levels` — copies `miniprogram/common/{levels,languages,categories}.js` into the cloud function directories. **Run after editing any of these shared configs**; never hand-edit the copies under `cloudfunctions/`.
- Deploy one cloud function (or use the IDE's right-click "上传并部署：云端安装依赖"):
  ```bash
  wechatide -c opencode cloud_fn_deploy --appid wx232c37e00f6becb5 \
    --env cloud1-d1gvxyrae03955eec \
    --path cloudfunctions/<fn> --remote-npm-install
  ```
  Deployment is a write operation that prompts for confirmation. CLI deploy does not apply `config.json` permissions.
- Local UI-only preview: set `useLocalMock: true` in `miniprogram/config.js`; `recognize`/`compose` then use `miniprogram/utils/mock.js`, but TTS still calls the `tts` cloud function and fails without a cloud environment.
- `useCombinedAnalyze` in `miniprogram/config.js` (default `true`) switches between the combined `analyze` call and the two-step `recognize` + `compose` flow.

There are no automated tests to run.

## Architecture

### Request flow

`pages/index/index.js`: `wx.chooseMedia` → `utils/image.normalizeImage` (EXIF rotation + longest side ≤1280) → `wx.cloud.uploadFile` → pass `fileID` (never base64) to a cloud function → store `pendingResult` → navigate to `pages/result/result`.

- Default: `analyze` returns `{words, scene, sentence, translation, usedWords}` from one vision request.
- If `sentence` is empty or `usedWords` is below the level's `minWords`, the result page falls back to `compose`; 「换一句」 also calls `compose` without re-uploading the image.
- With `useCombinedAnalyze: false`: `recognize`, then `compose`.

### Cloud functions (`cloudfunctions/`)

Each function is a separate Node package with its own `package.json`; install dependencies inside that directory, not at the repo root.

- `recognize` — `cloud.downloadFile(fileID)` → provider `recognize(buffer, opts)` → validates/dedupes words, normalizes bbox to 0–1, truncates `scene` to 300 chars.
- `compose` — dedupes words and requires ≥2; retries once with a stricter prompt when `usedWords < levelConfig.minWords`.
- `tts` — provider `synthesize(text, opts)`; text limited to 500 chars; returns base64 audio.
- `analyze` — combined recognition + sentence in one vision call; provider timeout 20s (set the cloud function timeout to 30s).

All functions return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. The client wrapper is `miniprogram/utils/cloud.js`.

### Provider adapter

`cloudfunctions/<fn>/providers/` isolates vendor code. `recognize`/`compose` select via `AI_PROVIDER` (`mock` is the code default, `tokenhub` is production); `tts` and `analyze` are TokenHub-only.

- TokenHub is OpenAI-compatible: `POST {TOKENHUB_BASE_URL}/chat/completions` with `Authorization: Bearer <key>`. TTS uses `POST /wand/minimax-tts/sync_tts`.
- Models: `TOKENHUB_VISION_MODEL` (recognize), `TOKENHUB_TEXT_MODEL` (compose), `TOKENHUB_TTS_MODEL` (tts), `TOKENHUB_COMBINED_MODEL` (analyze, falls back to the vision model).
- When the model name matches `/deepseek/i`, `recognize`/`analyze` add `thinking: {type:'disabled'}`; `compose` always disables thinking.
- Timeouts: 15s for recognize/compose/tts, 20s for analyze.

### Learning loop pages (`miniprogram/pages/`)

- `pages/review` — flashcard quiz from the wordbook. Three modes (`word2meaning` / `meaning2word` / `listen2meaning`), session built from `review.getDueIds()` (falls back to all words for practice), capped at 30 questions. Wrong answers mark the word `lapsed` (待强化).
- `pages/recall` — scene recall from a history record: bbox labels hidden, tap the object area or 「揭晓」 to reveal, self-grade 记得/不记得. A failed word that is already in the wordbook is marked lapsed via `review.registerFail`.
- `pages/result` — 跟读 records the sentence (`utils/recorder.js`, transient temp file, 60s cap) and toggles playback between original TTS and the recording.

### Review/stats utils

- `utils/review.js` — storage key `reviewState`, keyed by wordbook id (`lang:word`). 5 Leitner boxes, intervals `[0,1,2,4,7,14]` days; wrong answer resets to box 0 with `lapsed: true`. `getDueIds()` also prunes states for deleted wordbook entries.
- `utils/stats.js` — storage key `stats`, device-local date keys, daily goal 5, streak counts consecutive goal days, keeps 90 days. Both quiz answers and recall self-grades call `stats.record(correct)`; 跟读 does not count.

### Shared config sync

`miniprogram/common/levels.js`, `languages.js`, and `categories.js` are the single source of truth. `scripts/sync-levels.js` copies them to:

- `levels.js` → recognize, compose, analyze
- `languages.js` → recognize, compose, tts, analyze
- `categories.js` → recognize, analyze

Providers import these as `../categories` etc. (the copies at the function root). Edits to the copies under `cloudfunctions/` will be overwritten.

## Cross-cutting invariants

- API keys live only in cloud function environment variables, never under `miniprogram/` (the client can be decompiled). TokenHub accepts only an API key via `Authorization: Bearer` — not SecretId/SecretKey; Guangzhou and Singapore keys/Base URLs are not interchangeable.
- Normalize image orientation before upload: `<image>` honors EXIF but Canvas does not, and bbox overlay/share-image coordinates all assume the same normalized image.
- `bbox` is normalized 0–1 relative to the uploaded image; the result page renders it with percentage-positioned overlays. Words without a bbox are still shown in the list.
- TTS cache-first: `utils/speech.js` is the only playback entry point; it checks `USER_DATA_PATH/tts-<hash>.mp3` (hash of `lang|voice|text`) before calling `tts`, and writes the file on a miss.
- Per-language TTS voices live in `common/languages.js`; `TOKENHUB_TTS_VOICE` is only a fallback.
- Local persistence keys: `pendingResult`, `history` (max 10 records; images copied to `USER_DATA_PATH/history/`), `wordbook` (deduped by `lang + word`), `reviewState` (Leitner state), `stats` (daily counts/streak). `USER_DATA_PATH` is ~10MB, so caches need care. Recordings are temp-only and never persisted.
- `phonetic` is optional on every word (`recognize`/`analyze` return it as IPA for en/fr/es/de, 假名 for ja, 罗马音 for ko; omit when unsure). The server trims to 50 chars and omits the field when empty; clients must render with `wx:if`. `history.save` passes it through automatically; `wordbook.add` persists it explicitly.
- All audio playback goes through `utils/speech.js` (`speak`, `playLocal`), which owns a single shared `InnerAudioContext`; starting one source stops the other. Do not create extra audio contexts (the recording comparison depends on this).
- Share image: hidden Canvas 2D at 1080×1350 (keep exports <1365), static QR asset `miniprogram/assets/wxacode.png`. Do not add a cloud function or `getUnlimited` for the QR code.
- Do not reintroduce the 「微信同声传译」 plugin (`WechatSI`); it has been delisted.
- Route AI calls through cloud functions to bypass `wx.request` domain allowlisting.
- `session.json` and `competitor.md` are unrelated artifacts, not part of the app.
