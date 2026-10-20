# Changelog

Все заметные изменения русского форка. Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [Semantic Versioning](https://semver.org/lang/ru/). Заголовки разделов (`### Added`,
`### Changed`, `### Removed`, `### Fixed`, …) оставлены на английском: их проверяет
`tests/test_changelog_structure.py`.

Форк отделился от [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search)
версии 1.7.3 (коммит `58f04bc`, 19.10.2026). История оригинала — в
[его CHANGELOG](https://github.com/MadsLorentzen/ai-job-search/blob/master/CHANGELOG.md).

## [Unreleased]

### Added

- **Портал `habr-search` — Хабр Карьера** (`.agents/skills/habr-search/`) — поиск IT-вакансий
  РФ/СНГ через публичный JSON сайта, без ключа и без runtime-зависимостей. Фильтры: город,
  грейд, удалёнка, зарплата, тип занятости, сортировка, давность; `detail` по id или ссылке.
  48 офлайн-тестов на фикстурах. Разрешён в `.claude/settings.json` и
  `tools/security_guards.py`.
- **Русские образцы `cv/main_example_ru.tex` и `cover_letters/cover_example_ru.tex`** — русские
  разделы, «Желаемая должность», «С уважением,», русская дата, переносы (babel / polyglossia).
  CI собирает оба, считает ошибкой строку `Missing character` в логе и проверяет текстовый слой
  (2 и 1 страница, кириллица и ₽ извлекаются).

### Fixed

- **Кириллица в PDF больше не пропадает** — шрифты письма заменены на Lato 2.015 и Raleway 4.020
  с кириллицей (OFL, под прежними именами файлов, `cover.cls` не менялся); резюме под lualatex
  набирается CMU (Computer Modern Unicode) вместо Latin Modern без кириллицы, а ₽, которого нет
  в CMU, берётся из Raleway. Раньше русский текст компилировался без ошибок, но молча исчезал
  из PDF. Английские образцы дают тот же текстовый слой, что и раньше.

### Changed

- **Весь проект переведён на русский** — README, SETUP, документация, команды
  (`.claude/commands/`), навыки (`.claude/skills/`), агенты (`.claude/agents/`), шаблон
  профиля `CLAUDE.md`. Агент общается с пользователем по-русски.
- **Адаптация под российский рынок** — резюме по-русски по умолчанию (на англоязычную
  вакансию — по-английски), русские разделы резюме, «С уважением,», зарплата в ₽ в месяц
  с уточнением «на руки» / «до вычета НДФЛ», российские стоп-факторы, примеры городов и
  компаний. `/apply` считает доверенными хостами `career.habr.com`, `hh.ru` и `*.hh.ru`.

### Removed

- **Датские порталы** `jobindex-search`, `jobnet-search`, `jobbank-search`, `jobdanmark-search`.
- **`linkedin-search`** — LinkedIn заблокирован в РФ.
- **`/notion-sync`** и его тест — Notion ушёл из РФ.
- **Ko-fi** (`.github/FUNDING.yml`) и бейджи оригинала.
