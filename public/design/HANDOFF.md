# 儿童游戏扩容 · 设计交接

## 当前项目与边界
- 原生 HTML / CSS / ES Modules，零运行依赖；Node 静态服务器，Playwright 测试（`package.json:5–17`）。
- `public/index.html` 游戏大厅；`public/assets/home.js:8–26` 生成卡片，`:33–55` 搜索/分类/排序，`:115–128` 从目录生成分类。
- `public/play.html` 为统一 iframe 播放器；`public/assets/shared.js:60–80` 校验 `games.json` 并生成 `play.html?game=id`。
- 检查时已有 9 款：喵喵星际队（射击）、五子棋、2048、扫雷、国际象棋、森林邮差（不交叉路径）、花园翻翻乐（记忆配对）、星星接接乐（限时反应）、魔法衣橱（订单装扮/自由创作）。目录 `public/games.json:1–155`。
- 本次只修改首页设计、制作静态设计样张及 SVG。不写游戏逻辑，不注册未完成游戏，不改 shared.js/home.js/play.html/games.json，不动已有游戏。

## 已交付文件
1. `public/index.html:7–14,26–30`：移除固定款数文案、挂载首页独立样式、儿童操作提示、可见结果数量。保留所有原有 ID 和事件接口。
2. `public/assets/collection.css:1–62`：首页专用覆盖，不影响播放器。奶油纸底、鼠尾草绿、杏色与淡紫插画保持原风格；桌面 3 列、601–1000px 2 列、≤600px 1 列。移动分类双列完整展示，不用隐藏横向滚动。搜索 16px，描述 14px，收藏/开始玩/分类 48px 触控。卡片英文副标题隐藏，中文分类保留，底部按钮对齐；不截断长中文简介。
3. `public/design/kids-games.html:1–48`：可直接从服务器打开的静态样张；两款布局、所有 12 个 symbol、封面、选中/提示/重试/成功状态均有使用示例。明确标为非游戏，不向首页发布。
4. `public/design/kids-games.css:1–52`：可复用游戏视觉结构；760px 以下侧栏下移，420px 以下缩小非交互车厢，候选图案仍有 ≥48px 目标。
5. `public/assets/pattern-train.svg:1–11`、`public/assets/picnic-count.svg:1–10`：独立 600×350 封面，无外部引用，可直接用于 `<img>`。
6. `public/games/pattern-train/assets/pattern-sprite.svg:1–33`：`leaf/flower/mushroom/berry` 为 100×100；`wagon/engine` 为 160×130。
7. `public/games/picnic-count/assets/picnic-sprite.svg:1–26`：`apple/pear/rabbit/bear` 为 100×100；`plate` 为 160×120；`basket` 为 160×130。
8. 本交接文件 `public/design/HANDOFF.md`。

## 游戏一：花花小火车 / pattern-train
- 5～8 岁，识别重复规律，不是记忆配对：所有线索一直可见，也没有路径规划。
- 从左到右看 6 节车厢，每题只留一个空位。点击 3 个候选图案之一，正确即填入；不正确保留空位，用“再看看前面的一组”提示，无扣分、倒计时或生命。
- 固定 9 站。第 1–3 站 ABABAB（最后一格空）；4–6 站 AABAAB（最后一格空）；7–9 站 ABCABC（第 4/5/6 格分别空）。每站替换 A/B/C 的图形映射，必须互不相同。每个模板给足两组线索，避免仅凭颜色。
- 示例映射按站次：AB 的 (leaf,flower)、(mushroom,berry)、(flower,mushroom)；AAB 的 (leaf,berry)、(flower,leaf)、(berry,mushroom)；ABC 的 (leaf,flower,berry)、(mushroom,leaf,flower)、(berry,mushroom,leaf)。候选含正确答案且无重复，每题可洗牌一次，答错不洗牌。
- “提示”给每个重复组加括线并读出组内图案，不直接代填；成功展示 ✓ 与规律解释，用户点“下一站”，禁止自动跳题。第九站完成显示“九站都到啦”和“再玩一次”。
- 状态建议：`levelIndex / selected / solved / hintShown`；正确判断为模板空位的 symbol ID。仅保存最大解锁站数，键 `little-play:pattern-train:v1`；存储损坏或禁用时可继续玩。
- 低成本 DOM 渲染，数组查答案即可，无物理、Canvas、声音或拖拽依赖。

## 游戏二：野餐分分乐 / picnic-count
- 4～7 岁，点数与一一对应数量，不是装扮订单：核心为反复加减实物理解数量。
- 两位朋友兔子/小熊各有“水果图标＋数字＋等量圆点”需求。先选苹果或梨，再点朋友的“＋ 放一个”；“− 拿回一个”移除该朋友盘里最后放入的水果（明确 LIFO，与当前选中的水果无关）。不强制拖拽。
- 每盘最多 5 个，空盘拿回禁用，满盘放入禁用。水果无限供应；点“分好啦”才检查，防止自动成功打断探索。
- 固定 8 关，用 `(兔子水果,数量; 小熊水果,数量)`：1 `(apple,1; apple,2)`；2 `(apple,2; apple,3)`；3 `(pear,1; pear,3)`；4 `(apple,3; pear,2)`；5 `(pear,4; apple,2)`；6 `(apple,4; pear,3)`；7 `(pear,5; apple,3)`；8 `(apple,5; pear,5)`。
- 每盘须水果类型全部正确且总数等于目标。错误优先指出类型“把小熊盘里的梨拿回来，换成苹果”，再指出多/少数量；保留现状继续修改。圆点最多 5 个，不把需求藏在纯文本里。
- 两盘正确才完成，显示 ✓ 与“刚刚好！谢谢你照顾每位朋友”，点击“下一次野餐”继续。无计时/分数/失败惩罚；“重新分一分”清空当前两盘，不换关卡。
- 状态建议：`levelIndex / selectedFruit / plates: {rabbit: [], bear: []} / checked / solved`。仅保存解锁，键 `little-play:picnic-count:v1`。数组增删和数量校验即可，不需要库存算法。

## SVG 使用契约
- 原创矢量，颜色固定、圆角描边，无脚本、字体、远程资源、动画。形状与中文标签同时区分，颜色不是唯一线索。
- sprite 是 symbol 库，不可把整个文件直接用 `<img>` 当单个图标。游戏内使用：`<svg viewBox="0 0 100 100" aria-hidden="true"><use href="assets/pattern-sprite.svg#leaf"/></svg>`。另一款替换为 `assets/picnic-sprite.svg#apple`。
- 为 HTML 按钮提供中文名称，如“选择花朵”“给小兔放一个苹果”；SVG 本身可 aria-hidden。使用标准 `href`，外部 symbol 必须同源 HTTP。封面已经自包含，不依赖外部 use。
- 车厢 cargo 叠加位置见样张 CSS `:20–23`；水果不要缩成难以辨认的小点：正式版 5 个水果可用 3+2 网格，单个建议 ≥32px，盘子放入/拿回按钮独立 ≥48px。

## Fixer 整合顺序
1. 在两个新游戏目录各建 `index.html / style.css / game.js`；从设计样张拆出对应 section，拷贝所需样式至各自 style.css（勿直接把整张设计页嵌入播放器）。将静态 `.choice` div 与 `.study-action` span 改成真实 `button type="button"`，接状态。顶部有返回大厅链接。
2. 实现以上关卡数组、输入和成功/重试/重开；布局无需图形引擎。补充圆点旁的水果 SVG、每个实物图标、计数、启用/禁用态；初始候选不预选，样张选中只用于演示。火车 6 格线性排列不折行，图案可读标签另供读屏。
3. Tab + Enter/Space 覆盖所有操作；choice 用 aria-pressed，feedback 用 role=status；换关后聚焦题目或首个候选；所有必要信息有可读文本，减少动态效果偏好下不播放庆祝移动。默认无需声音。
4. 正式游戏可用后在 `public/games.json` 添加 id `pattern-train` / `picnic-count`；entry 为 `games/<id>/index.html`，cover 为 `assets/<id>.svg`；category 复用 `儿童益智`，color 分别 `sage` / `apricot`，badge `亲子推荐`，devices `["电脑","手机"]`，featured 可 false；addedAt 填实际发布日。必填 title/subtitle/description/controls/note/tags 依照 shared.js 校验，不新增必须字段。
5. 推荐文案：花花小火车 / LITTLE PATTERNS, BIG DISCOVERIES / “看看叶子和花朵怎样排队，给小火车装上下一节图案。没有倒计时，慢慢发现规律。” / tags `["5～8 岁","规律","观察"]`；野餐分分乐 / JUST ENOUGH FOR EVERY FRIEND / “数数小圆点，把刚刚好的水果分给森林朋友。多了拿回来，少了再添一个。” / tags `["4～7 岁","点数","数量"]`。
6. 首页分类、计数、搜索、收藏、随机和播放器通过现有目录机制自动覆盖；不要硬编码 11 款。后续超过约 24 款可增加“再看一些”分页而非无限自动加载；目前 11 款无需增加复杂导航或新分类。
7. 测试两款题目唯一解、错选可恢复、最后一关、重置、重复点击、拿回空盘/满盘、防止负数、错误水果、存储失败；补目录/播放器访问、收藏/随机/搜索新游戏测试。用 320/390/768/1280px、键盘与 reduced-motion 验证。运行 npm run check / npm test / npm run test:e2e。

## 验证与保留项
- Playwright Chromium 实测首页与样张在 320、390、768、1280px 无横向溢出；首页列数分别 1/1/2/3，仍加载现有 9 款。儿童筛选 4 款、无结果态、清除筛选恢复 9 款均通过。
- 测试发现 CSS ::before 分类字符会改变按钮可访问名称，已移除，保留原按钮名称兼容现有测试。
- 未运行全套业务测试；未声称两款新游戏已可玩。静态素材尺寸与浏览器加载已检查，其他浏览器/真实触屏需 fixer 再验。
