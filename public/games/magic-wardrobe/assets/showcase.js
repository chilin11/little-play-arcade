import { CATALOG, CATEGORY_LABELS, PALETTE, SAMPLE_LOOKS, createLookSVG, createItemPreview } from './catalog.js';
for (const color of Object.values(PALETTE)) {
  const swatch = document.createElement('span');
  swatch.style.background = color;
  document.querySelector('#palette').append(swatch);
}
for (const look of SAMPLE_LOOKS) {
  const card = document.createElement('figure');
  card.className = 'look-card';
  const caption = document.createElement('figcaption');
  caption.textContent = look.label;
  card.append(createLookSVG(look, { label:look.label }),caption);
  document.querySelector('#looks').append(card);
}
for (const [category, items] of Object.entries(CATALOG)) {
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.id = `category-${category}`;
  heading.textContent = CATEGORY_LABELS[category];
  section.setAttribute('aria-labelledby',heading.id);
  const grid = document.createElement('div');
  grid.className = 'items';
  for (const item of items) {
    const card = document.createElement('figure');
    card.className = 'item';
    card.dataset.item = item.id;
    const caption = document.createElement('figcaption');
    caption.textContent = item.label;
    const code = document.createElement('code');
    code.textContent = item.id;
    card.append(createItemPreview(item.id),caption,code);
    grid.append(card);
  }
  section.append(heading,grid);
  document.querySelector('#catalog').append(section);
}
