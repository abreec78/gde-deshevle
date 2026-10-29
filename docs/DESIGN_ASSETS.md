# Визуальные образцы и ресурсы

Владелец предоставил два утверждённых оригинала 27.10.2026:

1. `где_дешевле_категории_и_популярные_товары.png` — главная, 12 категорий, ряд популярных товаров.
2. `сравнение_цен_на_ssd_1_тб.png` — компьютеры → накопители → SSD → 1 ТБ, список и панель сравнения.

Категорийные `assets/category-0.webp` … `category-11.webp` извлечены непосредственно из первого PNG. Изображения телефона, телевизора, ноутбука, наушников и стиральной машины также извлечены из него; элементы скидок и кнопок исключены. `ssd.webp`, `kingston.webp`, `wd.webp` извлечены из второго PNG. `samsung-sata.webp` использует очищенную от скидочного бейджа иллюстрацию SATA SSD из первой главной. Эти файлы являются иллюстрациями из макетов, а не фотографиями подтверждённых предложений.

Для трёх сохранённых товаров старого PR (робот-пылесос, клавиатура, чайник), отсутствующих на макетах, использованы дополнительные студийные иллюстрации из ранее созданного встроенным image_gen листа. Они не заменяют утверждённые изображения категорий или SSD и находятся в отдельных `robot.webp`, `keyboard.webp`, `kettle.webp`. Исходный лист сохранён в каталоге generated_images; в приложении используются только локальные WebP. `ssd-sata.webp` — исходная очищенная вырезка SATA SSD, также использованная для `samsung-sata.webp`.

Иконки PWA — локально нарисованный знак корзины на синем фоне. Все web-иконки интерфейса — собственный встроенный SVG, без сторонней библиотеки.

## Исходный prompt дополнительных иллюстраций

Встроенный режим image_gen, не API/CLI:

> Create one production asset sheet for a Russian shopping comparison application. 3 columns by 6 rows, exactly 18 equal square cells, each isolated centered object with generous margins, seamless very pale neutral #f5f6f8 backgrounds. No text, no numbers, no logos, no dividing lines. First TWO ROWS are photorealistic premium studio product photography: row1: portable silver external SSD drive, black wireless over-ear headphones, round white robot vacuum; row2: graphite smartphone back and front, compact black mechanical keyboard, cream electric kettle. Remaining FOUR ROWS are charming polished volumetric 3D clay category illustrations, soft lavender mint peach materials and realistic shadows: row3 headphones, table lamp, laptop; row4 washing machine, skincare bottles, sneaker; row5 teddy bear, basketball, car; row6 drill, cat beside bowl, grocery bag with vegetables. Uniform straight-on three-quarter perspective, high-end marketplace visual quality, keep every object fully inside its own cell. No emoji, no UI, no labels, no watermark. Square or portrait sheet with exact 1:2 width to height ratio.

Дополнительные категории из этого листа в интерфейсе не используются: эталоном категорий остаётся присланный владельцем оригинал.