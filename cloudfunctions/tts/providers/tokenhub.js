const https = require('https');

function getConfig() {
  const apiKey = process.env.TOKENHUB_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 TOKENHUB_API_KEY');
  }
  return {
    apiKey,
    baseUrl: (process.env.TOKENHUB_BASE_URL || 'https://tokenhub.tencentmaas.com/v1').replace(/\/+$/, ''),
    model: process.env.TOKENHUB_TTS_MODEL || 'minimax-speech-2.8-turbo',
    voice: process.env.TOKENHUB_TTS_VOICE || 'minimax_55e81114-ce7e-4ca1',
    speed: Number(process.env.TOKENHUB_TTS_SPEED || 1),
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

async function synthesize(text, opts) {
  if (!text || typeof text !== 'string') {
    throw new Error('文本为空');
  }

  const config = getConfig();
  const voiceId = (opts && opts.voice) || config.voice;

  const response = await postJson(
    `${config.baseUrl}/wand/minimax-tts/sync_tts`,
    { Authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      text,
      voice_setting: {
        voice_id: voiceId,
        speed: config.speed,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
      subtitle_enable: false,
      output_format: 'hex',
    },
    15000
  );

  const baseResp = response && response.base_resp;
  if (baseResp && baseResp.status_code !== 0) {
    throw new Error(`TokenHub TTS ${baseResp.status_code}: ${baseResp.status_msg || '合成失败'}`);
  }

  const audioHex = response && response.data && response.data.audio;
  if (!audioHex) {
    throw new Error('TokenHub TTS 未返回音频');
  }

  const buffer = Buffer.from(audioHex, 'hex');
  if (!buffer.length) {
    throw new Error('TokenHub TTS 音频为空');
  }

  const extra = response.extra_info || {};
  return {
    audioBase64: buffer.toString('base64'),
    mime: 'audio/mpeg',
    size: buffer.length,
    durationMs: typeof extra.audio_length === 'number' ? extra.audio_length : 0,
  };
}

module.exports = { synthesize };
