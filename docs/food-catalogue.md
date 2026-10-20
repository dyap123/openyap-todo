# Food catalogue provenance

`food-catalogue.js` is a local, dependency-free data asset. It assigns `window.OY_FOOD_CATALOGUE` with `version`, `checkedAt`, `sources` (keyed by source ID), and `foods`. Each food has a stable `id`, `chain`, `name`, `portion`, calories in kcal, protein/carbs/fat in grams, an official `source` URL, `sourceId`, and usually `sourceRow` to locate the printed/menu row. No runtime scrape, API key or network request is needed to search this catalogue.

Version `2026-10-20.1` contains 189 menu foods: Chick-fil-A 71, Subway 69, Chipotle 25, Panda Express 22, McDonald’s 2. All 25 original IDs remain present. There are 188 foods with all three macros. McDonald’s Cheeseburger retains its verified 300 calories, with all three macros explicitly `null`: the official page's dynamic nutrition panel was unavailable to verification. Conflicting secondary-site values were not substituted. `null` means unknown, never zero. Big Mac's previously absent macros are now filled from its official indexed nutrition panel.

The catalogue uses one standard serving for each new item. The original 8/12-count fried and grilled nuggets remain for compatibility; no new nugget count or drink-size variants were added. Subway sandwiches and salads are different meal recipes, with bread, cheese, vegetables and dressing inclusion stated in their names/portion descriptions. Footlong doubling, protein bowl size alternatives, alternate sandwich bread variants, kids' portions and catering trays were omitted. Chipotle ingredients and Chick-fil-A sauce packets are useful additions to a meal, not complete meal estimates. Regional items are marked where the source marks them. A listed menu item is not a guarantee that a particular location sells it.

## Official sources

All accessed October 20, 2026. Access dates do not imply that an older PDF was newly published that day.

| Source ID | Official source | Version evidence |
| --- | --- | --- |
| `chipotle-us-2025` | [Chipotle U.S. nutrition facts PDF](https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf) | URL names March 2025; printed footer `OCT-2024-US-CK`; PDF creation/modification October 16, 2024. Uses the regular nutrition table on PDF page 3, excluding kids' table and larger serving duplicates. Publication date is therefore left unknown rather than inferred from URL. |
| `cfa-us-live` | [Chick-fil-A U.S. Nutrition & Allergens](https://www.chick-fil-a.com/nutrition-allergens) | Live U.S. table, no publication date stated. Extracted explicit rendered HTML row cells, including their screen-reader labels; omitted the empty template cell. |
| `subway-us-2026-10` | [Subway U.S. nutrition PDF](https://media.subway.com/dam/urn:aaid:aem:f20a4541-8c88-496b-940d-4aa8318cae26/original/as/us-nutrition-en.pdf) | Page 1 explicitly says **U.S. Nutrition Information, October 2026**. PDF metadata title says `CAN Nutrition 9.2025`; that stale internal title does not override the printed U.S. heading. PDF creation/modification September 18, 2026. Linked from [Subway U.S. nutrition](https://www.subway.com/en-us/menunutrition/nutrition). |
| `panda-us-live` | [Panda Express nutrition table](https://www.pandaexpress.com/nutritioninformation) | Live U.S. table, no publication date stated. Transcribed standard entree/side/appetizer/cup-soup rows. Excludes Cub Meal portions and soup bowl duplicate. |
| `mcd-bigmac-us-live` | [McDonald’s U.S. Big Mac](https://www.mcdonalds.com/us/en-us/product/big-mac.html) | Page verifies calories; official search-indexed nutrition panel verifies 25 g protein, 45 g total carbs and 34 g total fat. No product-specific publication date stated. |
| `mcd-cheese-us-live` | [McDonald’s U.S. Cheeseburger](https://www.mcdonalds.com/us/en-us/product/cheeseburger.html) | Page verifies 300 calories. Dynamic macros unavailable, so remain unknown. |

The source metadata includes SHA-256 of the downloaded PDFs and Chick-fil-A HTML for identifying the exact bytes used. The original temporary source files were downloaded into `/private/tmp/oy-food-sources` during implementation; they are verification scratch files, not runtime dependencies or durable repository fixtures. Source pages can change independently of this pinned local snapshot.

## Verification and source-row fixtures

Nutrition columns were read by their printed headings, not inferred from calorie arithmetic. Chipotle's columns after serving size are calories, calories from fat, fat, saturated fat, trans fat, cholesterol, sodium, carbs, fiber, sugar, protein. Subway's columns after serving weight are calories, fat, saturated fat, trans fat, cholesterol, sodium, carbs, fiber, sugar, added sugar, protein, then vitamins/minerals. CFA HTML cells include serving weight, calories, fat, saturated fat, trans fat, cholesterol, sodium, carbs, fiber, sugar, protein. Printed bounded fiber values such as `<1` are outside this catalogue's macro fields; no bounded macro value was converted to zero.

These independently readable source rows provide concrete reviewer fixtures. Values are `kcal / protein g / carbs g / fat g` for the stated portion:

| Catalogue ID | Source row and portion | Expected values |
| --- | --- | --- |
| `chip-chicken` | PDF page 3, Chicken, 4 oz | 180 / 32 / 0 / 7 |
| `chip-black-beans` | PDF page 3, Black Beans, 4 oz | 130 / 8 / 22 / 1.5 |
| `chip-chipotle-honey-vinaigrette` | PDF page 3, Chipotle-Honey Vinaigrette, 2 fl oz | 220 / 1 / 18 / 16 |
| `cfa-grill8` | 8 ct Grilled Nuggets, 95 g | 130 / 25 / 1 / 3 |
| `cfa-grill12` | 12 ct Grilled Nuggets, 142 g | 200 / 38 / 2 / 4.5 |
| `cfa-sandwich` | Chick-fil-A Chicken Sandwich, 183 g | 420 / 29 / 41 / 16 |
| `cfa-deluxe` | Deluxe Sandwich w/ American, 247 g | 490 / 32 / 43 / 21 |
| `subway-sandwich-steak-philly` | PDF page 1, 6-inch Steak Philly, 192 g | 510 / 28 / 43 / 25 |
| `subway-salad-grilled-chicken` | PDF page 2, Grilled Chicken salad, 415 g | 450 / 26 / 12 / 34 |
| `panda-the-original-orange-chicken` | The Original Orange Chicken, 6.2 oz | 560 / 19 / 63 / 25 |
| `mc-bigmac` | Big Mac, one burger | 580 / 25 / 45 / 34 |
| `mc-cheese` | Cheeseburger, one burger | 300 / unknown / unknown / unknown |

Compared with the old inline starter data, the current official Chick-fil-A source lists Chicken Sandwich fat as 16 g (previously 18) and Deluxe with American fat as 21 g (previously 22). The catalogue uses verified current source values for new selections. Existing diary entries must continue to use their saved historical nutrition snapshot.

Menus and preparation vary. These are restaurant estimates for the named U.S. standard serving, not measured nutrition of the user's actual portion. Refresh the catalogue by checking the official sources, preserving stable IDs, updating changed values and source metadata, and advancing the catalogue version. Missing future provider macros must remain unknown. This data asset makes no dietary, allergy or investment recommendations.
