const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const content = String(text || '').trim();
  if (!content) {
    return [];
  }

  const lines = [];
  if (content.indexOf(' ') !== -1) {
    const words = content.split(/\s+/);
    let line = '';
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        return;
      }
      if (line) {
        lines.push(line);
      }
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        return;
      }
      let chunk = '';
      for (let i = 0; i < word.length; i += 1) {
        const next = chunk + word[i];
        if (ctx.measureText(next).width <= maxWidth) {
          chunk = next;
        } else {
          if (chunk) {
            lines.push(chunk);
          }
          chunk = word[i];
        }
      }
      line = chunk;
    });
    if (line) {
      lines.push(line);
    }
    return lines;
  }

  let line = '';
  for (let i = 0; i < content.length; i += 1) {
    const next = line + content[i];
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) {
        lines.push(line);
      }
      line = content[i];
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function drawTextBlock(ctx, text, options) {
  const { x, y, maxWidth, font, color, lineHeight, maxLines } = options;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let lines = wrapText(ctx, text, maxWidth);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[lines.length - 1] || '';
    while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawLabels(ctx, words, rect) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  words.forEach((item) => {
    if (!item.bbox) {
      return;
    }
    const bbox = item.bbox;
    const x = rect.x + bbox.x * rect.w;
    const y = rect.y + bbox.y * rect.h;
    const width = bbox.w * rect.w;
    const height = bbox.h * rect.h;

    ctx.strokeStyle = '#07c160';
    ctx.lineWidth = 4;
    roundRectPath(ctx, x, y, width, height, 10);
    ctx.stroke();

    ctx.font = 'bold 26px sans-serif';
    const textWidth = ctx.measureText(item.word).width;
    const labelHeight = 38;
    const labelWidth = Math.min(textWidth + 20, rect.x + rect.w - x);
    ctx.fillStyle = '#07c160';
    ctx.fillRect(x, y, labelWidth, labelHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(item.word, x + 10, y + labelHeight / 2);
  });

  ctx.textBaseline = 'top';
}

function render(options) {
  const {
    canvas,
    page,
    imagePath,
    imageWidth,
    imageHeight,
    words,
    sentence,
    translation,
    codePath,
  } = options;

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f6f8';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  return Promise.all([
    loadImage(canvas, imagePath),
    codePath ? loadImage(canvas, codePath).catch(() => null) : Promise.resolve(null),
  ]).then(([photo, code]) => {
    const pad = 56;
    const contentWidth = CANVAS_WIDTH - pad * 2;

    const srcWidth = imageWidth || photo.width || 1;
    const srcHeight = imageHeight || photo.height || 1;
    const maxPhotoHeight = 680;
    const scale = Math.min(contentWidth / srcWidth, maxPhotoHeight / srcHeight);
    const drawWidth = Math.round(srcWidth * scale);
    const drawHeight = Math.round(srcHeight * scale);
    const photoX = pad + Math.round((contentWidth - drawWidth) / 2);
    const photoY = pad;

    ctx.save();
    roundRectPath(ctx, photoX, photoY, drawWidth, drawHeight, 24);
    ctx.clip();
    ctx.drawImage(photo, photoX, photoY, drawWidth, drawHeight);
    ctx.restore();

    drawLabels(ctx, words || [], {
      x: photoX,
      y: photoY,
      w: drawWidth,
      h: drawHeight,
    });

    let cursorY = photoY + drawHeight + 44;
    cursorY = drawTextBlock(ctx, sentence, {
      x: pad,
      y: cursorY,
      maxWidth: contentWidth,
      font: 'bold 44px sans-serif',
      color: '#1f2329',
      lineHeight: 60,
      maxLines: 3,
    });
    cursorY += 10;
    drawTextBlock(ctx, translation, {
      x: pad,
      y: cursorY,
      maxWidth: contentWidth,
      font: '30px sans-serif',
      color: '#8a9099',
      lineHeight: 44,
      maxLines: 2,
    });

    const codeSize = 180;
    const codeX = CANVAS_WIDTH - pad - codeSize;
    const codeY = CANVAS_HEIGHT - pad - codeSize;
    if (code) {
      ctx.drawImage(code, codeX, codeY, codeSize, codeSize);
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#8a9099';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('扫码拍照学外语', CANVAS_WIDTH - pad, codeY - 34);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#07c160';
    ctx.fillText('拍照学外语', pad, CANVAS_HEIGHT - pad - 36);

    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath(
        {
          canvas,
          x: 0,
          y: 0,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          destWidth: CANVAS_WIDTH,
          destHeight: CANVAS_HEIGHT,
          fileType: 'jpg',
          quality: 0.92,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        },
        page
      );
    });
  });
}

module.exports = {
  render,
};
