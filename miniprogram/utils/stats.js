const KEY = 'stats';
const GOAL = 5;
const MAX_DAYS = 90;

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function dateKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function load() {
  const raw = wx.getStorageSync(KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { totalAnswered: 0, totalCorrect: 0, days: {} };
  }
  return {
    totalAnswered: typeof raw.totalAnswered === 'number' ? raw.totalAnswered : 0,
    totalCorrect: typeof raw.totalCorrect === 'number' ? raw.totalCorrect : 0,
    days:
      raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days) ? raw.days : {},
  };
}

function save(data) {
  wx.setStorageSync(KEY, data);
}

function pruneDays(days) {
  const keys = Object.keys(days).sort();
  while (keys.length > MAX_DAYS) {
    delete days[keys.shift()];
  }
}

function record(correct) {
  const data = load();
  const key = dateKey();
  const day = data.days[key] || { answered: 0, correct: 0 };
  day.answered += 1;
  if (correct) {
    day.correct += 1;
  }
  data.days[key] = day;
  data.totalAnswered += 1;
  if (correct) {
    data.totalCorrect += 1;
  }
  pruneDays(data.days);
  save(data);
  return data;
}

function computeStreak(days) {
  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = days[dateKey(cursor)];
  if (!today || today.answered < GOAL) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 366; i += 1) {
    const day = days[dateKey(cursor)];
    if (!day || day.answered < GOAL) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getSummary() {
  const data = load();
  const today = data.days[dateKey()] || { answered: 0, correct: 0 };
  return {
    todayAnswered: today.answered,
    todayCorrect: today.correct,
    goal: GOAL,
    todayDone: today.answered >= GOAL,
    streak: computeStreak(data.days),
    totalAnswered: data.totalAnswered,
    totalCorrect: data.totalCorrect,
  };
}

module.exports = {
  record,
  getSummary,
  GOAL,
};
