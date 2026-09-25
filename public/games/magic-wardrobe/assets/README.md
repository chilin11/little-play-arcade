# 林间小裁缝 / Magic Wardrobe visual kit

本地原创 SVG，面向 5–8 岁；纸张底、森林绿、杏橙、薰衣草、湖水蓝、蜜糖黄与牛仔蓝。延续 forest-post / memory-garden 的低饱和纸卡、细描边和圆角体系，服装增加领口、袖口、褶裥、袋盖、扣子、编织与绣花，不靠换色区分款式。

## 文件与边界

- `wardrobe-sprite.svg`：完整矢量源，无远程资源、字体、图片。直接打开 sprite 是空画布，必须引用 symbol。
- `catalog.js`：资产清单、中文标签、缩略图裁切、纯视觉组合函数；无订单、存储、得分或游戏事件。
- `showcase.html` / `showcase.js`：独立图鉴，显示封面、六套搭配与全部单品；从本地 HTTP 服务打开。
- `../../../assets/magic-wardrobe.svg`：600 × 350 自包含封面，不依赖 sprite；可直接用 img。
 - `index.html` / `style.css` / `game.js`：可玩的多分类换装游戏；主舞台、订单预览和作品册复用真实 SVG 组合，状态使用 v2 本地存储。

## 坐标与描边

所有 **symbol** 的 `viewBox="0 0 320 400"`。每个穿搭 use 必须明确 `width="320" height="400"`，否则在裁切预览中会被父 SVG 的 viewport 二次缩放。

| 锚点 | 坐标 |
| --- | --- |
| 身体中轴 | x=160 |
| 耳/角保留区域 | y=20–100；帽子只覆盖额头，保留耳尖 |
| 眼睛中心 | (137,130)、(183,130) |
| 颈口 | x=140–180，y=185–200 |
| 肩点 | (120,195)、(200,195) |
| 手腕 | (91,253)、(229,253) |
| 腰线 | x=122–198，y=254 |
| 裙摆 / 裤脚 | y=305–349 |
| 双鞋中心 / 鞋底 | x≈136、184；y=374 |

主体描边 2.2，内部缝线 1.2–1.8；圆连接、柔和物料色描边。无需 `vector-effect`，缩小时线宽自然随比例变化。角色共享身体基底，保留奶油色打底短裤；兔耳、猫耳尾、熊耳与鹿角斑点为独立原创轮廓。

## Symbol 清单（52 个可选项 = 4 角色 + 48 衣橱选项）

| 分类 | 数量 | 稳定 IDs |
| --- | --- | --- |
| 角色 | 4 | `character-rabbit`, `character-cat`, `character-bear`, `character-deer` |
| 上衣 | 8 | `top-tshirt`, `top-puff`, `top-shirt`, `top-sailor`, `top-knit`, `top-hoodie`, `top-jacket`, `top-vest` |
| 下装 | 8 | `bottom-pleated`, `bottom-tutu`, `bottom-denim-shorts`, `bottom-wide`, `bottom-overalls`, `bottom-bloomers`, `bottom-straight`, `bottom-sport` |
| 连衣裙 | 6 | `dress-aline`, `dress-starlight`, `dress-garden`, `dress-academy`, `dress-festival`, `dress-pinafore` |
| 鞋 | 6 | `shoe-sneakers`, `shoe-boots`, `shoe-sandals`, `shoe-ballet`, `shoe-rainboots`, `shoe-canvas` |
| 帽饰 | 6 = 5+无 | `hat-none`, `hat-beret`, `hat-sun`, `hat-beanie`, `hat-cap`, `hat-wreath` |
| 颈饰 | 6 = 5+无 | `neck-none`, `neck-scarf`, `neck-shawl`, `neck-bowtie`, `neck-silk`, `neck-snood` |
| 配饰 | 8 = 7+无 | `acc-none`, `acc-satchel`, `acc-backpack`, `acc-handbag`, `acc-hairclip`, `acc-badge`, `acc-glasses`, `acc-bracelet` |

辅助 symbol：`bottom-overalls-front`（背带裤胸片与肩带），`acc-backpack-back`（背包包体），`scene-studio`（试衣拱门、阴影、盆栽）。共 **55 symbol**；辅助不计入衣物数量。defs 内的 `motif-flower`, `motif-star`, `body-shape`, `face-details` 是内部 g，请连同 defs 一起保留。

## 从后到前的正确层级

1. `scene-studio`（可选）
2. `acc-backpack-back`（仅选背包时）
3. `character-*`（身体、手脚、耳、脸）
4. `bottom-*` **或** `dress-*`
5. `top-*`（有 dress 时不出现）
6. `bottom-overalls-front`（仅背带裤；必须在 top 之上，否则真正的背带会被上衣挡住）
7. `shoe-*`（雨靴可盖住裤脚，长裤以塞靴方式展示）
8. `neck-*`
9. `hat-*`
10. `acc-*`（前层包带、包、眼镜、发夹等）

 `createLookSVG` 已按此顺序组合。游戏会在 dress 与 top/bottom 之间互斥切换，按钮同步 `aria-pressed`；作品使用完整 symbol ID 持久化。一个配饰槽一次选一件；背包的前后两层同步处理。

## Fixer 最短接入

```js
import { CATALOG, createItemPreview, createLookSVG } from './assets/catalog.js';
const look = {
  character:'character-cat', top:'top-shirt', bottom:'bottom-pleated', dress:null,
  shoes:'shoe-canvas', hat:'hat-beret', neck:'neck-bowtie', accessory:'acc-glasses',
  colors:{ top:'#fffdf7', bottom:'#91a893' }
};
// 主舞台与作品册复用真实几何；作品册不再使用 emoji 或颜色条。
stage.replaceChildren(createLookSVG(look, {label:'小猫的学院穿搭'}));
workCard.append(createLookSVG(look, {scene:true, label:'已收藏的学院穿搭'}));
optionButton.append(createItemPreview('top-shirt'));
```

函数返回独立 `SVGElement`，使用 aria-label 而非重复 title ID。可安全多次调用。每层有 `data-layer="top|bottom|dress|shoes|hat|neck|accessory|character|scene"` 和 `data-item="完整symbol ID"`。无效 ID 使用默认穿搭；只有清单里的 ID 会进入 href。若只改一层，更新 use 的 `href` 即可；跨 dress / 分体或背带裤 / 背包切换，建议重建整个小 SVG，避免遗留辅助层。不要通过宿主 CSS 给所有 path 统一 fill。

### 不依赖 JS 的 compact 模板

以下路径相对游戏 index.html；主舞台和作品册仅 CSS 大小不同。

```html
<svg class="wardrobe-look" viewBox="0 0 320 400" role="img" aria-label="花园裙小兔作品">
  <use href="assets/wardrobe-sprite.svg#scene-studio" width="320" height="400"/>
  <use data-layer="character" href="assets/wardrobe-sprite.svg#character-rabbit" width="320" height="400"/>
  <use data-layer="dress" href="assets/wardrobe-sprite.svg#dress-garden" width="320" height="400"/>
  <use data-layer="shoes" href="assets/wardrobe-sprite.svg#shoe-ballet" width="320" height="400"/>
  <use data-layer="neck" href="assets/wardrobe-sprite.svg#neck-none" width="320" height="400"/>
  <use data-layer="hat" href="assets/wardrobe-sprite.svg#hat-wreath" width="320" height="400"/>
  <use data-layer="accessory" href="assets/wardrobe-sprite.svg#acc-satchel" width="320" height="400"/>
</svg>
```

```css
.wardrobe-look { display:block; width:100%; height:auto; max-width:100%; }
.work-card { min-width:0; }
.work-card .wardrobe-look { max-height:180px; }
.wardrobe-item-preview { display:block; width:100%; height:80px; overflow:hidden; }
```

### 单品卡片裁切

`CATALOG[category]` 每项为 `{id,label,crop}`。在外层 svg 上用 `viewBox=item.crop`，内部 use 仍固定 320×400。这样卡片是真实衣物细节放大，不含角色，不产生第二套缩略图维护成本。背带裤预览额外组合胸片；背包额外组合包体。“无”才显示柔和斜杠圆圈，其余均为真实衣物。配饰分别裁切到包、夹、眼镜或手链本体。

### 色彩与可移植性

- 场景纸底 `#f7f2e8`、纸卡 `#fffdf7`、文字森林绿 `#365247`。
- `PALETTE` 导出七种可选布料色；每件自身有设计好的 fallback 配色。
- 在 **单个 use** 设置 `style="--cloth:#e8bd69"` 改主面料；领口、缝线、绣花、金属扣保持原色。背带裤两层共用 `colors.bottom`；背包两层共用 `colors.accessory`。
- `--fur` 是角色内部共享身体用色，不建议游戏覆盖。
- 外部 use 要同源 HTTP；请用 `npm run dev`，不要以 file:// 打开。
- 要生成可下载的自包含 SVG/PNG：fetch 本地 sprite 后，把全部 defs 和 symbol 克隆进目标 SVG 的 defs，将 use 中 `SPRITE_URL#id` 改为 `#id`，然后 XMLSerializer。若把这种内联作品放回同一 HTML，要为所有 id 与对应 href 添加作品唯一前缀，避免冲突。不要把只含外部 use 的字符串直接转成 img/data URL，部分浏览器不会加载其外部引用。
- `showcase.html` 为 320px 窄屏提供两列作品、三列衣物；不使用固定宽度容器或外部字体。
