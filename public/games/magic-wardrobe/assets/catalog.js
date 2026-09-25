// Visual metadata only: no game state, storage, orders, or interaction rules.
export const SPRITE_URL = new URL('./wardrobe-sprite.svg', import.meta.url).href;
const rows = (prefix, crop, items) => items.map(([key, label, box]) => ({ id: `${prefix}-${key}`, label, crop: box || crop }));
export const CATALOG = {
  characters: rows('character', '65 15 190 370', [['rabbit','小兔米娅'],['cat','小猫露露'],['bear','小熊阿栗'],['deer','小鹿星芽']]),
  tops: rows('top', '78 162 164 120', [['tshirt','晴天短袖'],['puff','杏花泡泡袖'],['shirt','奶油白衬衫'],['sailor','海魂条纹衫'],['knit','麦穗针织衫'],['hoodie','湖畔连帽卫衣'],['jacket','秋日短夹克'],['vest','菱格针织背心']]),
  bottoms: rows('bottom', '85 245 150 115', [['pleated','森林百褶裙'],['tutu','云朵蓬蓬裙'],['denim-shorts','卷边牛仔短裤'],['wide','麦田阔腿裤'],['overalls','探险背带裤','100 180 120 178'],['bloomers','杏桃灯笼裤'],['straight','学院直筒裤'],['sport','薄荷运动短裤']]),
  dresses: rows('dress', '77 180 166 170', [['aline','晴日 A 字裙'],['starlight','星光纱裙'],['garden','花园层叠裙'],['academy','学院领带裙'],['festival','丰收节日裙'],['pinafore','花房背带裙']]),
  shoes: rows('shoe', '99 308 122 74', [['sneakers','森林运动鞋'],['boots','蜂蜜短靴'],['sandals','编带凉鞋'],['ballet','缎带芭蕾鞋'],['rainboots','湖水雨靴'],['canvas','紫云帆布鞋']]),
  hats: rows('hat', '76 18 168 122', [['none','不戴帽饰'],['beret','画家贝雷帽'],['sun','花边遮阳帽'],['beanie','麦穗针织帽'],['cap','薄荷棒球帽'],['wreath','林间花环']]),
  neck: rows('neck', '91 176 138 96', [['none','不戴颈饰'],['scarf','杏橙流苏围巾'],['shawl','薰衣草披肩'],['bowtie','蜜糖领结'],['silk','绿叶丝巾'],['snood','云蓝围脖']]),
  accessories: rows('acc', '100 183 140 125', [['none','不戴配饰'],['satchel','邮差斜挎包'],['backpack','森林背包','100 178 140 112'],['handbag','花房手提包','198 249 64 81'],['hairclip','杏花发夹','169 97 59 34'],['badge','小小徽章','166 207 36 47'],['glasses','圆角眼镜','100 111 120 44'],['bracelet','花朵手链','76 240 35 29']])
};
export const CATEGORY_LABELS = { characters: '四位森林朋友', tops: '上衣 · 8 件', bottoms: '下装 · 8 件', dresses: '连衣裙 · 6 件', shoes: '鞋子 · 6 双', hats: '帽饰 · 5 件 + 无', neck: '颈饰 · 5 件 + 无', accessories: '配饰 · 7 件 + 无' };
export const PALETTE = { forest:'#91a893', apricot:'#e9b6a1', lavender:'#b6a4c7', honey:'#e8bd69', lake:'#81b5a8', cream:'#fffdf7', denim:'#86a8c4' };
const NS = 'http://www.w3.org/2000/svg';
function node(name, attributes = {}) {
  const el = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}
function layer(id, slot, colors = {}) {
  const use = node('use', { href: `${SPRITE_URL}#${id}`, width:320, height:400, 'data-layer':slot, 'data-item':id });
  const color = colors[slot];
  if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) use.style.setProperty('--cloth', color);
  return use;
}
const valid = (category, id) => CATALOG[category].some(item => item.id === id);
/** Returns a real SVG thumbnail; no text/emoji substitute for garments. */
export function createItemPreview(id) {
  const item = Object.values(CATALOG).flat().find(item => item.id === id);
  if (!item) throw new TypeError(`Unknown wardrobe asset: ${id}`);
  const svg = node('svg', { viewBox:item.crop, role:'img', 'aria-label':item.label, class:'wardrobe-item-preview' });
  if (id.endsWith('-none')) {
    // A neutral removal sign is reserved exclusively for the explicit “none” choice.
    svg.setAttribute('viewBox','0 0 100 100');
    svg.append(node('circle',{cx:50,cy:50,r:24,fill:'none',stroke:'#b7bfae','stroke-width':2}),node('path',{d:'M33 67 67 33',stroke:'#b7bfae','stroke-width':2}));
  } else {
    if (id === 'acc-backpack') svg.append(layer('acc-backpack-back','accessories'));
    svg.append(layer(id, 'preview'));
    if (id === 'bottom-overalls') svg.append(layer('bottom-overalls-front','bottom'));
  }
  return svg;
}
/** Pure visual composition. Pass stable full IDs; dress takes visual precedence.
 * work: {character,top,bottom,dress,shoes,hat,neck,accessory,colors?}
 * options: {scene?:boolean,label?:string}; returns SVGElement, not serialized HTML.
 */
export function createLookSVG(work = {}, { scene = true, label = '我的森林穿搭' } = {}) {
  const svg = node('svg',{viewBox:'0 0 320 400',role:'img','aria-label':label,class:'wardrobe-look'});
  const colors = work.colors || {};
  if (scene) svg.append(layer('scene-studio','scene'));
  const accessory = valid('accessories',work.accessory) ? work.accessory : 'acc-none';
  if (accessory === 'acc-backpack') svg.append(layer('acc-backpack-back','accessory',colors));
  svg.append(layer(valid('characters',work.character) ? work.character : 'character-rabbit','character'));
  if (valid('dresses',work.dress)) svg.append(layer(work.dress,'dress',colors));
  else {
    const bottom = valid('bottoms',work.bottom) ? work.bottom : 'bottom-pleated';
    svg.append(layer(bottom,'bottom',colors),layer(valid('tops',work.top) ? work.top : 'top-tshirt','top',colors));
    if (bottom === 'bottom-overalls') svg.append(layer('bottom-overalls-front','bottom',colors));
  }
  svg.append(layer(valid('shoes',work.shoes) ? work.shoes : 'shoe-sneakers','shoes',colors));
  svg.append(layer(valid('neck',work.neck) ? work.neck : 'neck-none','neck',colors));
  svg.append(layer(valid('hats',work.hat) ? work.hat : 'hat-none','hat',colors));
  svg.append(layer(accessory,'accessory',colors));
  return svg;
}
export const SAMPLE_LOOKS = [
  { label:'花园里的一封信',character:'character-rabbit',dress:'dress-garden',shoes:'shoe-ballet',hat:'hat-wreath',neck:'neck-none',accessory:'acc-satchel' },
  { label:'放学后的画室',character:'character-cat',top:'top-shirt',bottom:'bottom-pleated',shoes:'shoe-canvas',hat:'hat-beret',neck:'neck-bowtie',accessory:'acc-glasses' },
  { label:'去湖边探险',character:'character-bear',top:'top-tshirt',bottom:'bottom-overalls',shoes:'shoe-sneakers',hat:'hat-cap',neck:'neck-none',accessory:'acc-backpack' },
  { label:'星星的晚会',character:'character-deer',dress:'dress-starlight',shoes:'shoe-ballet',hat:'hat-none',neck:'neck-shawl',accessory:'acc-bracelet' },
  { label:'雨后的小路',character:'character-rabbit',top:'top-hoodie',bottom:'bottom-denim-shorts',shoes:'shoe-rainboots',hat:'hat-beanie',neck:'neck-scarf',accessory:'acc-none' },
  { label:'丰收节快乐',character:'character-bear',dress:'dress-festival',shoes:'shoe-boots',hat:'hat-none',neck:'neck-none',accessory:'acc-handbag' }
];
