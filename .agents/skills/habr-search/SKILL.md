---
name: habr-search
version: 1.0.0
description: >
  Используй этот навык, когда пользователь ищет IT-вакансии в России и СНГ, хочет
  найти работу разработчиком, аналитиком, тестировщиком, DevOps, дизайнером или
  менеджером продукта, или просит открыть конкретную вакансию с Хабр Карьеры
  (career.habr.com) — даже если Хабр не назван прямо. Триггеры: найди вакансии,
  поиск работы, IT-вакансии, вакансии python в Москве, удалёнка для разработчика,
  работа в Санкт-Петербурге, вакансии middle/senior, Хабр Карьера, хабр вакансии,
  мой круг, career.habr.com. English triggers: find IT jobs in Russia, developer
  jobs Moscow, remote developer jobs Russia, Habr Career, career.habr.com job.
context: fork
enabled: true  # поставь false, чтобы /scrape пропускал этот портал, не удаляя его
allowed-tools: Bash(bun run .agents/skills/habr-search/cli/src/cli.ts *)
---

# Поиск на Хабр Карьере

Ищет живые вакансии на **[Хабр Карьере](https://career.habr.com)** — крупнейшей
IT-площадке рунета (бывший «Мой круг»): разработка, аналитика, тестирование,
DevOps, дизайн, менеджмент. Без авторизации, без ключа, **без runtime-зависимостей** —
нужен только `bun`.

Источник — тот же JSON, которым пользуется сам сайт (`/api/frontend/vacancies`),
поэтому выдача структурированная: грейд, навыки, зарплата, города, удалёнка.
Детали вакансии берутся со страницы `/vacancies/<id>` (встроенное JSON-состояние,
запасной вариант — JSON-LD `JobPosting`).

> **Только для личного поиска работы.** Официального публичного API у Хабр Карьеры
> нет, это эндпоинт самого сайта. robots.txt его не запрещает, но держи объём
> маленьким: десятки запросов за прогон, а не обход всей базы.

## Когда использовать

- Найти вакансии по должности, технологии или компании.
- Сузить по городу, грейду, удалёнке, зарплате, типу занятости, давности.
- Открыть полное описание вакансии по id или ссылке.

## Команды

### Поиск

```bash
bun run .agents/skills/habr-search/cli/src/cli.ts search [-q "<запрос>"] [флаги]
```

| Флаг | Что делает |
|---|---|
| `--query`, `-q <текст>` | Ключевые слова. Необязателен (без него — все вакансии). |
| `--city`, `-l <города>` | Через запятую: `moscow`, `spb`, `ekaterinburg`, `novosibirsk`, `kazan`, `nizhny-novgorod`, `samara`, `rostov-on-don`, `ufa`, `tomsk`, `yaroslavl`, `ryazan`, `kaliningrad`, `sochi`, `minsk`, `yerevan`; русские названия (`москва`, `спб`…) или числовой `city_id` с сайта. |
| `--grade <грейд>` | `intern`, `junior`, `middle`, `senior`, `lead`. |
| `--remote` | Только с возможностью удалённой работы. |
| `--salary <₽>` | Зарплата от, ₽ в месяц. |
| `--with-salary` | Только с указанной зарплатой. |
| `--employment <тип>` | `full_time` или `part_time`. |
| `--sort <порядок>` | `relevance` (по умолчанию) или `date`. |
| `--jobage <дней>` | Не старше N дней. **У API нет такого фильтра** — CLI берёт страницу из 50 самых свежих (сортировка переключается на `date`, если `--sort` не задан) и отбрасывает старые на клиенте. |
| `--page <n>` | Страница, с 1. |
| `--limit`, `-n <n>` | Сколько вывести, по умолчанию 25, максимум 50 за страницу. |
| `--format` | `json` (по умолчанию), `table`, `plain`. |

### Детали вакансии

```bash
bun run .agents/skills/habr-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

Принимает числовой id из выдачи или ссылку `https://career.habr.com/vacancies/<id>`.
Ссылки на другие сайты отвергаются (`BAD_ID`) — для hh.ru и прочих используй `/apply`
со ссылкой или текстом вакансии.

## Примеры

```bash
# Python middle в Москве
bun run .agents/skills/habr-search/cli/src/cli.ts search -q "python" --city moscow --grade middle --format table

# Удалённые вакансии data engineer за последние две недели
bun run .agents/skills/habr-search/cli/src/cli.ts search -q "data engineer" --remote --jobage 14 --format table

# Фронтенд в Петербурге или Казани с зарплатой от 200 000 ₽
bun run .agents/skills/habr-search/cli/src/cli.ts search -q "frontend" --city spb,kazan --with-salary --salary 200000

# Senior Go, свежие сверху, JSON для /scrape
bun run .agents/skills/habr-search/cli/src/cli.ts search -q "golang" --grade senior --sort date --limit 20

# Полное описание вакансии
bun run .agents/skills/habr-search/cli/src/cli.ts detail 1000168937 --format plain
```

## Формат вывода

`search --format json`:

```json
{
  "meta": { "count": 2, "page": 1, "total": 485, "totalPages": 20 },
  "results": [
    {
      "id": "1000168874",
      "title": "Python backend",
      "company": "Пример",
      "location": "Москва",
      "date": "2026-10-13",
      "url": "https://career.habr.com/vacancies/1000168874",
      "salary": "от 230 000 ₽",
      "grade": "Middle",
      "remote": false,
      "employment": "full_time",
      "specialization": "Бэкенд разработчик",
      "skills": ["Python", "Django"]
    }
  ]
}
```

С `--jobage` в `meta` добавляется `fetched` — сколько вакансий было до фильтра.

`detail --format json` — те же поля плюс `description` (текст без HTML),
`valid_through` (до какого числа открыта, `YYYY-MM-DD` или `null`), `archived` и
`isActive` (`false` — вакансия в архиве, откликнуться нельзя).

| Формат | Для чего |
|---|---|
| `json` | Для агента и `/scrape` (по умолчанию) |
| `table` | Быстро пробежать глазами |
| `plain` | Читаемый текст, у `detail` — полное описание |

Ошибки — в stderr как `{"error": "...", "code": "..."}`, код выхода 1:
`UNKNOWN_FLAG`, `BAD_ARG`, `NO_ID`, `BAD_ID`, `NOT_FOUND`, `PARSE_FAILED`,
`SEARCH_FAILED`, `DETAIL_FAILED`.

## Заметки

- `salary` — только зарплата, которую указал работодатель. Прогноз Хабра
  (`predictedSalary`) не выдаётся за зарплату и в вывод не попадает.
- В `location` у вакансий без города и с удалёнкой стоит «Удалённо»; с городом и
  удалёнкой — «Москва (можно удалённо)».
- Город фильтруется через `locations[]=c_<city_id>`; полный список id есть только
  на сайте (в ссылке фильтра по городу), в CLI зашиты самые частые.
- Сайт отдаёт максимум 50 вакансий на страницу; `--limit` больше 50 не даст больше.
- Устройство эндпоинтов и параметры — в `url-reference.md`.
