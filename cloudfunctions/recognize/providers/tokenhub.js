const https = require('https');
const { CATEGORIES, normalizeCategory } = require('../categories');

function getConfig() {
  const apiKey = process.env.TOKENHUB_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 TOKENHUB_API_KEY');
  }
  return {
    apiKey,
    baseUrl: (process.env.TOKENHUB_BASE_URL || 'https://tokenhub.tencentmaas.com/v1').replace(/\/+$/, ''),
    model: process.env.TOKENHUB_VISION_MODEL || 'hy-vision-2.0-instruct',
  };
}

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = JSON.stringify(body);
    const request = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: Object.assign(
          {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          headers
        ),
      },
      (response) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (err) {
            parsed = null;
          }
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }
          const error = parsed && parsed.error;
          const message =
            (error && (error.message || error.code)) ||
            (parsed && parsed.message) ||
            data.slice(0, 200);
          reject(new Error(`TokenHub ${response.statusCode}: ${message}`));
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(timeoutMs || 15000, () => {
      request.destroy(new Error('TokenHub 请求超时'));
    });
    request.write(payload);
    request.end();
  });
}

function detectMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return 'image/gif';
  }
  return 'image/jpeg';
}

function buildPrompt(levelConfig, langConfig) {
  const levelName = levelConfig.name || '入门';
  const langName = (langConfig && langConfig.name) || '英语';
  return [
    `你是一位语言老师，请识别图片中清晰、可辨认的物体，并给出适合学习者的${langName}单词。`,
    `目标难度：${levelName}。`,
    `返回 ${levelConfig.minWords} 到 ${levelConfig.maxWords} 个物体。`,
    '要求：',
    `1. 每个单词必须是常见、可教学的${langName}名词或名词短语；不要单独返回颜色、大小等形容词；`,
    '2. 给出简洁准确的中文释义；',
    '3. confidence 为 0 到 1 之间的数字；',
    '4. 为每个物体给出归一化边界框 bbox：x/y 为左上角，w/h 为宽高，取值 0 到 1，尽量贴紧物体；不确定时省略 bbox；',
    `5. 为每个物体给出 category，必须从以下分类中选择一个：${CATEGORIES.join(' / ')}；`,
    '6. scene 用一句简短中文描述图片内容和物体之间的位置、颜色或数量关系，只描述真实可见内容，不要编造；',
    '7. 只输出 JSON 对象，不要输出解释或 Markdown 代码块。',
    '格式示例：',
    '{"scene":"一个红色正方形在左边，一个蓝色圆形在右边。","words":[{"word":"square","translation":"正方形","confidence":0.98,"category":"颜色形状","bbox":{"x":0.1,"y":0.15,"w":0.35,"h":0.4}}]}',
  ].join('\n');
}

function stripCodeFence(text) {
  return String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function clamp01(value) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return null;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeBbox(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  let x;
  let y;
  let w;
  let h;

  if (typeof raw.w === 'number' && typeof raw.h === 'number') {
    if (raw.x > 1.2 || raw.y > 1.2 || raw.w > 1.2 || raw.h > 1.2) {
      return null;
    }
    x = clamp01(raw.x);
    y = clamp01(raw.y);
    w = clamp01(raw.w);
    h = clamp01(raw.h);
  } else if (typeof raw.x2 === 'number' && typeof raw.y2 === 'number') {
    if (raw.x1 > 1.2 || raw.y1 > 1.2 || raw.x2 > 1.2 || raw.y2 > 1.2) {
      return null;
    }
    const x1 = clamp01(raw.x1);
    const y1 = clamp01(raw.y1);
    const x2 = clamp01(raw.x2);
    const y2 = clamp01(raw.y2);
    if (x1 === null || y1 === null || x2 === null || y2 === null) {
      return null;
    }
    x = Math.min(x1, x2);
    y = Math.min(y1, y2);
    w = Math.abs(x2 - x1);
    h = Math.abs(y2 - y1);
  } else if (
    Array.isArray(raw) &&
    raw.length === 4 &&
    raw.every((value) => typeof value === 'number') &&
    raw.every((value) => value >= 0 && value <= 1.2)
  ) {
    x = clamp01(raw[0]);
    y = clamp01(raw[1]);
    w = clamp01(raw[2]);
    h = clamp01(raw[3]);
  } else {
    return null;
  }

  if (x === null || y === null || w === null || h === null) {
    return null;
  }
  if (x + w > 1) {
    w = 1 - x;
  }
  if (y + h > 1) {
    h = 1 - y;
  }
  if (w < 0.04 || h < 0.04) {
    return null;
  }

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    w: Number(w.toFixed(4)),
    h: Number(h.toFixed(4)),
  };
}

function normalizeScene(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function bboxIoU(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (!intersection) {
    return 0;
  }
  const union = a.w * a.h + b.w * b.h - intersection;
  return union > 0 ? intersection / union : 0;
}

function normalizeResult(content, levelConfig) {
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch (err) {
    throw new Error('识别结果不是合法 JSON');
  }

  const list = Array.isArray(parsed) ? parsed : parsed && parsed.words;
  if (!Array.isArray(list)) {
    throw new Error('识别结果缺少单词列表');
  }

  const seen = {};
  const words = [];
  list.forEach((item) => {
    if (!item || typeof item.word !== 'string') {
      return;
    }
    const word = item.word.trim();
    const key = word.toLowerCase();
    if (!word || seen[key]) {
      return;
    }
    seen[key] = true;
    const entry = {
      word,
      translation: typeof item.translation === 'string' ? item.translation.trim() : '',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
      level: levelConfig.id,
      category: normalizeCategory(item.category),
    };
    const bbox = normalizeBbox(item.bbox);
    if (bbox) {
      entry.bbox = bbox;
      const duplicateIndex = words.findIndex(
        (existing) => existing.bbox && bboxIoU(existing.bbox, bbox) > 0.8
      );
      if (duplicateIndex !== -1) {
        if (entry.confidence > words[duplicateIndex].confidence) {
          words[duplicateIndex] = entry;
        }
        return;
      }
    }
    words.push(entry);
  });

  if (!words.length) {
    throw new Error('没有识别到可用单词');
  }

  return {
    words: words.slice(0, levelConfig.maxWords || 8),
    scene: normalizeScene(parsed && parsed.scene),
  };
}

async function recognize(imageBuffer, opts) {
  const levelConfig =
    (opts && opts.levelConfig) || { id: 'primary', name: '入门', minWords: 2, maxWords: 8 };
  const langConfig = (opts && opts.langConfig) || { id: 'en', name: '英语' };
  if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) {
    throw new Error('图片内容为空');
  }

  const config = getConfig();
  const mimeType = detectMimeType(imageBuffer);
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const body = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: buildPrompt(levelConfig, langConfig) },
        ],
      },
    ],
    stream: false,
  };

  if (/deepseek/i.test(config.model)) {
    body.thinking = { type: 'disabled' };
  }

  const response = await postJson(
    `${config.baseUrl}/chat/completions`,
    { Authorization: `Bearer ${config.apiKey}` },
    body,
    15000
  );

  const choice = response && response.choices && response.choices[0];
  if (!choice || !choice.message) {
    throw new Error('TokenHub 未返回识别结果');
  }
  if (choice.finish_reason === 'content_filter') {
    throw new Error('图片内容未通过安全审核');
  }

  return normalizeResult(choice.message.content, levelConfig);
}

module.exports = { recognize };
