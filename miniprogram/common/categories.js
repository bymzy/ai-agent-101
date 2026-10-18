const CATEGORIES = [
  '动物',
  '食物',
  '水果蔬菜',
  '家具家居',
  '交通工具',
  '自然',
  '人物',
  '衣物',
  '颜色形状',
  '文具玩具',
  '电子产品',
  '建筑地点',
  '其他',
];

const DEFAULT_CATEGORY = '其他';

const ALIASES = {
  animal: '动物',
  animals: '动物',
  food: '食物',
  fruit: '水果蔬菜',
  vegetable: '水果蔬菜',
  furniture: '家具家居',
  home: '家具家居',
  household: '家具家居',
  vehicle: '交通工具',
  vehicles: '交通工具',
  transport: '交通工具',
  transportation: '交通工具',
  nature: '自然',
  person: '人物',
  people: '人物',
  clothing: '衣物',
  clothes: '衣物',
  color: '颜色形状',
  colors: '颜色形状',
  shape: '颜色形状',
  shapes: '颜色形状',
  colorshape: '颜色形状',
  colorshapes: '颜色形状',
  fruitvegetables: '水果蔬菜',
  fruitsvegetables: '水果蔬菜',
  furniturehome: '家具家居',
  stationerytoys: '文具玩具',
  electronicproducts: '电子产品',
  buildingsplaces: '建筑地点',
  stationery: '文具玩具',
  toy: '文具玩具',
  toys: '文具玩具',
  electronic: '电子产品',
  electronics: '电子产品',
  building: '建筑地点',
  buildings: '建筑地点',
  place: '建筑地点',
  location: '建筑地点',
  other: '其他',
};

function normalizeCategory(value) {
  if (typeof value !== 'string') {
    return DEFAULT_CATEGORY;
  }
  const text = value.trim();
  if (!text) {
    return DEFAULT_CATEGORY;
  }
  if (CATEGORIES.indexOf(text) !== -1) {
    return text;
  }
  const compact = text.replace(/[\s/、,，]/g, '');
  if (CATEGORIES.indexOf(compact) !== -1) {
    return compact;
  }
  return ALIASES[text.toLowerCase()] || DEFAULT_CATEGORY;
}

module.exports = {
  CATEGORIES,
  DEFAULT_CATEGORY,
  normalizeCategory,
};
