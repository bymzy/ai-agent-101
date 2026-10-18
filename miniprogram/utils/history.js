const KEY = 'history';
const MAX = 10;
const DIR = `${wx.env.USER_DATA_PATH}/history`;

function getFs() {
  return wx.getFileSystemManager();
}

function ensureDir() {
  try {
    getFs().accessSync(DIR);
  } catch (err) {
    try {
      getFs().mkdirSync(DIR, true);
    } catch (e) {
      // 目录已存在或无权限时忽略，后续复制会走降级
    }
  }
}

function load() {
  const list = wx.getStorageSync(KEY);
  return Array.isArray(list) ? list : [];
}

function removeImage(record) {
  if (!record || !record.imagePath) {
    return;
  }
  if (record.imagePath.indexOf(DIR) !== 0) {
    return;
  }
  try {
    getFs().unlinkSync(record.imagePath);
  } catch (err) {
    // 文件可能已不存在
  }
}

function save(record) {
  if (!record || !record.id) {
    return null;
  }

  ensureDir();
  const list = load();
  const index = list.findIndex((item) => item.id === record.id);
  const previous = index !== -1 ? list[index] : null;
  let imagePath = record.imagePath || (previous && previous.imagePath) || '';

  if (imagePath && imagePath.indexOf(DIR) !== 0) {
    const dest = `${DIR}/${record.id}.jpg`;
    try {
      getFs().copyFileSync(imagePath, dest);
      imagePath = dest;
    } catch (err) {
      if (previous && previous.imagePath && previous.imagePath.indexOf(DIR) === 0) {
        imagePath = previous.imagePath;
      } else {
        imagePath = record.imagePath;
      }
    }
  }

  const item = Object.assign({}, record, {
    imagePath,
    createdAt: record.createdAt || Date.now(),
    updatedAt: Date.now(),
  });

  item.words = (item.words || []).map((word) => {
    const copy = Object.assign({}, word);
    delete copy.boxStyle;
    return copy;
  });

  if (index !== -1) {
    list.splice(index, 1);
  }
  list.unshift(item);

  while (list.length > MAX) {
    removeImage(list.pop());
  }

  wx.setStorageSync(KEY, list);
  return item;
}

function update(id, patch) {
  if (!id) {
    return null;
  }
  const list = load();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }
  list[index] = Object.assign({}, list[index], patch, { updatedAt: Date.now() });
  wx.setStorageSync(KEY, list);
  return list[index];
}

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  load,
  save,
  update,
  createId,
  MAX,
};
