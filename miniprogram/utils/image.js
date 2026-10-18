const MAX_SIDE = 1280;

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({ src, success: resolve, fail: reject });
  });
}

function loadCanvasImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

function normalizeImage(src, page, selector) {
  return getImageInfo(src).then((info) => {
    const rawWidth = info.width;
    const rawHeight = info.height;
    const orientation = info.orientation || 1;
    const rotated = orientation === 6 || orientation === 8;
    const uprightWidth = rotated ? rawHeight : rawWidth;
    const uprightHeight = rotated ? rawWidth : rawHeight;
    const scale = Math.min(1, MAX_SIDE / Math.max(uprightWidth, uprightHeight));
    const targetWidth = Math.round(uprightWidth * scale);
    const targetHeight = Math.round(uprightHeight * scale);

    if (orientation === 1 && scale === 1) {
      return { path: src, width: rawWidth, height: rawHeight };
    }

    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(page)
        .select(selector)
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node;
          if (!canvas) {
            reject(new Error('找不到图片处理画布'));
            return;
          }

          const ctx = canvas.getContext('2d');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          loadCanvasImage(canvas, src)
            .then((image) => {
              ctx.save();
              if (orientation === 3) {
                ctx.translate(targetWidth, targetHeight);
                ctx.rotate(Math.PI);
              } else if (orientation === 6) {
                ctx.translate(targetWidth, 0);
                ctx.rotate(Math.PI / 2);
              } else if (orientation === 8) {
                ctx.translate(0, targetHeight);
                ctx.rotate(-Math.PI / 2);
              }

              const drawWidth = rotated ? targetHeight : targetWidth;
              const drawHeight = rotated ? targetWidth : targetHeight;
              ctx.drawImage(image, 0, 0, drawWidth, drawHeight);
              ctx.restore();

              wx.canvasToTempFilePath(
                {
                  canvas,
                  x: 0,
                  y: 0,
                  width: targetWidth,
                  height: targetHeight,
                  destWidth: targetWidth,
                  destHeight: targetHeight,
                  fileType: 'jpg',
                  quality: 0.9,
                  success: (out) => resolve({ path: out.tempFilePath, width: targetWidth, height: targetHeight }),
                  fail: reject,
                },
                page
              );
            })
            .catch(reject);
        });
    });
  });
}

function downloadCloudFile(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID,
      success: (res) => resolve(res.tempFilePath),
      fail: reject,
    });
  });
}

function fileExists(path) {
  try {
    wx.getFileSystemManager().accessSync(path);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  normalizeImage,
  downloadCloudFile,
  fileExists,
};
