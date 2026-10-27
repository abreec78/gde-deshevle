const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Execute the actual inline application script. This harness tests rendered
// output and event handlers; it does not emulate layout or service workers.
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const categories = [...html.match(/<select id="category"[\s\S]*?<\/select>/)[0]
  .matchAll(/<option(?:\s[^>]*)?>(.*?)<\/option>/g)].map(match => match[1]);

function boot({ storage = new Map(), blocked = false } = {}) {
  const nodes = Object.fromEntries(['q', 'category', 'sort', 'favorites', 'count', 'grid']
    .map(id => [id, {
      value: id === 'sort' ? 'default' : '', textContent: '', innerHTML: '',
      addEventListener(event, handler) { this[event] = handler; },
    }]));
  const context = vm.createContext({
    document: { getElementById: id => nodes[id] }, navigator: {},
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); storage.set(key, value); },
    },
  });
  vm.runInContext(script, context);
  return {
    nodes, storage,
    input(id, value) { nodes[id].value = value; nodes[id].input(); },
    toggle(id) { vm.runInContext(`toggle(${Number(id)})`, context); },
    favorites() { nodes.favorites.onclick(); },
    names() { return [...nodes.grid.innerHTML.matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]); },
    prices() { return [...nodes.grid.innerHTML.matchAll(/class="price">([^<]+)/g)]
      .map(m => Number(m[1].replace(/\D/g, ''))); },
  };
}

test('initial catalog: six products and explicit demo warning', () => {
  const app = boot();
  assert.equal(app.names().length, 6);
  assert.equal(app.nodes.count.textContent, '6 товаров');
  assert.match(html, /Цены ниже вымышленные/);
  assert.equal((app.nodes.grid.innerHTML.match(/button disabled/g) || []).length, 6);
});

test('search trims spaces, ignores case, and supports empty/no results', () => {
  const app = boot();
  app.input('q', ' SsD ');
  assert.deepEqual(app.names(), ['SSD 1 ТБ']);
  assert.equal(app.nodes.count.textContent, '1 товар');
  app.input('q', 'НАУШНИКИ');
  assert.deepEqual(app.names(), ['Беспроводные наушники']);
  app.input('q', '<no-such-product>');
  assert.deepEqual(app.names(), []);
  assert.match(app.nodes.grid.innerHTML, /Ничего не найдено/);
  app.input('q', '   ');
  assert.equal(app.names().length, 6);
});

const expectedCategories = {
  'Электроника': ['Беспроводные наушники', 'Смартфон 128 ГБ'],
  'Для дома': ['Робот-пылесос', 'Электрочайник'],
  'Компьютеры': ['SSD 1 ТБ', 'Клавиатура'],
  'Бытовая техника': [], 'Красота и здоровье': [], 'Одежда и обувь': [],
  'Детские товары': [], 'Спорт и отдых': [], 'Автотовары': [],
  'Строительство и ремонт': [], 'Зоотовары': [], 'Продукты': [],
};

test('category control contains all twelve distinct categories', () => {
  assert.equal(categories.length, 13);
  assert.deepEqual(categories.slice(1), Object.keys(expectedCategories));
});

for (const [category, expected] of Object.entries(expectedCategories)) {
  test(`category: ${category}`, () => {
    const app = boot();
    app.input('category', category);
    assert.deepEqual(app.names(), expected);
    assert.equal(app.nodes.count.textContent, expected.length ? '2 товара' : '0 товаров');
    app.input('category', '');
    assert.equal(app.names().length, 6);
  });
}

test('every offer displays product price + known shipping; unknown is not zero', () => {
  const app = boot();
  assert.deepEqual(app.prices(), [4840, 2240, 13240, 15240, 1540, 2740]);
  for (const article of app.nodes.grid.innerHTML.split('<article').slice(1)) {
    const offers = [...article.matchAll(/Товар: ([^<]+)<br>Доставка: ([^<]+)<br>Итого: ([^<]+)/g)];
    assert.equal(offers.length, 3);
    const number = value => Number(value.replace(/\D/g, ''));
    assert.equal(number(offers[0][2]), 0);
    assert.equal(number(offers[1][2]), 390);
    for (const offer of offers.slice(0, 2)) {
      assert.equal(number(offer[1]) + number(offer[2]), number(offer[3]));
    }
    assert.equal(offers[2][2], 'уточняется');
    assert.equal(offers[2][3], 'неизвестно');
  }
});

test('sorting uses delivered prices in both directions and restores default', () => {
  const app = boot();
  app.input('sort', 'asc');
  assert.deepEqual(app.prices(), [1540, 2240, 2740, 4840, 13240, 15240]);
  app.input('sort', 'desc');
  assert.deepEqual(app.prices(), [15240, 13240, 4840, 2740, 2240, 1540]);
  app.input('sort', 'default');
  assert.deepEqual(app.prices(), [4840, 2240, 13240, 15240, 1540, 2740]);
});

test('favorites add, remove, filter, and survive a new page context', () => {
  const app = boot();
  app.toggle(1); app.toggle(5);
  assert.deepEqual(JSON.parse(app.storage.get('favorites')), [1, 5]);
  const reload = boot({ storage: app.storage });
  reload.favorites();
  assert.deepEqual(reload.names(), ['SSD 1 ТБ', 'Клавиатура']);
  reload.toggle(1);
  assert.deepEqual(reload.names(), ['Клавиатура']);
  reload.toggle(5);
  assert.deepEqual(reload.names(), []);
  reload.favorites();
  assert.equal(reload.names().length, 6);
});

test('search, category, sort and favorites compose correctly', () => {
  const app = boot();
  app.toggle(1); app.toggle(5); app.toggle(2);
  app.favorites();
  app.input('category', 'Компьютеры');
  app.input('sort', 'asc');
  assert.deepEqual(app.names(), ['Клавиатура', 'SSD 1 ТБ']);
  app.input('q', 'ssd');
  assert.deepEqual(app.names(), ['SSD 1 ТБ']);
  app.input('category', 'Электроника');
  assert.deepEqual(app.names(), []);
});

for (const saved of ['{bad', '{}', 'null', '"string"', '[1,"2",null,{},2.5]']) {
  test(`stored favorites tolerate malformed/type-mismatched data: ${saved}`, () => {
    const app = boot({ storage: new Map([['favorites', saved]]) });
    app.favorites();
    assert.deepEqual(app.names(), saved.startsWith('[1,') ? ['SSD 1 ТБ'] : []);
  });
}

test('blocked storage still allows in-memory favorites without crashing', () => {
  const app = boot({ blocked: true });
  app.toggle(1); app.favorites();
  assert.deepEqual(app.names(), ['SSD 1 ТБ']);
  assert.deepEqual(boot({ blocked: true }).names().length, 6);
});
