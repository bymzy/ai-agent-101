const https = require('https');

function getConfig() {
  const apiKey = process.env.TOKENHUB_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 TOKENHUB_API_KEY');
  }
  return {
    apiKey,
    baseUrl: (process.env.TOKENHUB_BASE_URL || 'https://tokenhub.tencentmaas.com/v1').replace(/\/+$/, ''),
    model: process.env.TOKENHUB_TEXT_MODEL || 'hy3',
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

function buildPrompt(words, levelConfig, scene, strict, langConfig) {
  const levelName = levelConfig.name || '入门';
  const langName = (langConfig && langConfig.name) || '英语';
  const lines = [
    `你是一位耐心、鼓励学生的${langName}老师，正在教${levelName}水平的学生。`,
    `请用给定的${langName}单词组成一句自然、语法正确的${langName}句子，句子要适合学生朗读。`,
    `目标难度：${levelName}。`,
  ];
  if (scene) {
    lines.push(`图片场景：${scene}。`);
    lines.push('句子必须与图片场景一致，可以描述物体的颜色、位置或相互关系。');
  }
  lines.push(
    `给定单词：${words.join(', ')}。`,
    '要求：',
    `1. 必须使用至少 ${levelConfig.minWords} 个不同的给定单词（按逗号分隔的项计数），少于 ${levelConfig.minWords} 个视为不合格；`,
    `2. 句子总词数不超过 ${levelConfig.maxWords}；`,
    '3. 必须是一句完整的句子，包含主语和谓语，不能只输出短语或名词堆砌；',
    '4. 句子符合该难度学习者的水平；',
    '5. 提供准确的中文翻译；',
    '6. usedWords 列出实际用到的给定单词；',
    '7. 只输出 JSON 对象，不要输出解释或 Markdown 代码块。',
    '格式示例：{"sentence":"I can see a cat and a dog.","translation":"我能看到一只猫和一只狗。","usedWords":["cat","dog"]}'
  );
  if (strict) {
    lines.push('上一版没有用够单词。这次必须让句子同时包含多个给定项，不能只用一个。');
  }
  return lines.join('\n');
}

function stripCodeFence(text) {
  return String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function normalize(content, inputWords) {
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch (err) {
    throw new Error('组句结果不是合法 JSON');
  }

  const sentence = parsed && typeof parsed.sentence === 'string' ? parsed.sentence.trim() : '';
  if (!sentence) {
    throw new Error('组句结果为空');
  }

  const allowed = {};
  inputWords.forEach((word) => {
    allowed[String(word).toLowerCase()] = true;
  });

  const sentenceLower = sentence.toLowerCase();
  const usedWords = Array.isArray(parsed.usedWords)
    ? parsed.usedWords
        .filter((word) => typeof word === 'string')
        .map((word) => word.trim())
        .filter((word) => word && allowed[word.toLowerCase()])
        .filter((word) => sentenceLower.indexOf(word.toLowerCase()) !== -1)
    : [];

  return {
    sentence,
    translation: typeof parsed.translation === 'string' ? parsed.translation.trim() : '',
    usedWords,
  };
}

async function requestCompose(config, words, levelConfig, scene, strict, langConfig) {
  const response = await postJson(
    `${config.baseUrl}/chat/completions`,
    { Authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      messages: [
        { role: 'user', content: buildPrompt(words, levelConfig, scene, strict, langConfig) },
      ],
      thinking: { type: 'disabled' },
      temperature: 0.3,
      stream: false,
    },
    15000
  );

  const choice = response && response.choices && response.choices[0];
  if (!choice || !choice.message) {
    throw new Error('TokenHub 未返回组句结果');
  }
  if (choice.finish_reason === 'content_filter') {
    throw new Error('生成内容未通过安全审核');
  }

  return normalize(choice.message.content, words);
}

async function compose(words, opts) {
  const levelConfig =
    (opts && opts.levelConfig) || { id: 'primary', minWords: 2, maxWords: 8 };
  if (!Array.isArray(words) || words.length < 2) {
    throw new Error('至少需要 2 个单词');
  }

  const config = getConfig();
  const scene = (opts && opts.scene) || '';
  const langConfig = (opts && opts.langConfig) || { id: 'en', name: '英语' };
  let result = await requestCompose(config, words, levelConfig, scene, false, langConfig);
  if (result.usedWords.length < levelConfig.minWords) {
    result = await requestCompose(config, words, levelConfig, scene, true, langConfig);
  }
  if (result.usedWords.length < levelConfig.minWords) {
    throw new Error(`组句未使用足够的单词（至少 ${levelConfig.minWords} 个）`);
  }
  return result;
}

module.exports = { compose };
