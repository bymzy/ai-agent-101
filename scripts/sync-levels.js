const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shared = [
  { file: 'levels.js', functions: ['recognize', 'compose', 'analyze'] },
  { file: 'languages.js', functions: ['recognize', 'compose', 'tts', 'analyze'] },
  { file: 'categories.js', functions: ['recognize', 'analyze'] },
];

shared.forEach(({ file, functions }) => {
  const src = path.resolve(root, 'miniprogram/common', file);
  const content = fs.readFileSync(src, 'utf8');

  functions.forEach((fn) => {
    const dest = path.resolve(root, `cloudfunctions/${fn}/${file}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    console.log(`synced ${file} -> cloudfunctions/${fn}/${file}`);
  });
});
