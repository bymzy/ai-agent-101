const LEVELS = {
  primary: {
    id: 'primary',
    name: '入门',
    minWords: 2,
    maxWords: 8,
  },
  junior: {
    id: 'junior',
    name: '进阶',
    minWords: 3,
    maxWords: 14,
  },
  senior: {
    id: 'senior',
    name: '高级',
    minWords: 3,
    maxWords: 22,
  },
};

const LEVEL_IDS = Object.keys(LEVELS);
const DEFAULT_LEVEL = 'primary';

function getLevel(id) {
  return LEVELS[id] || LEVELS[DEFAULT_LEVEL];
}

module.exports = {
  LEVELS,
  LEVEL_IDS,
  DEFAULT_LEVEL,
  getLevel,
};
