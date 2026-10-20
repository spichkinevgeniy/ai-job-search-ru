# Хабр Карьера — справочник эндпоинтов

Проверено живыми запросами в октябре 2026. Если Хабр поменяет API, начинай отсюда.

## Поиск: `GET https://career.habr.com/api/frontend/vacancies`

JSON, без авторизации. robots.txt (`User-agent: *`) закрывает `/v1`, `/suggest`,
`/vacancies/*/responses` и т. п., но не `/api/frontend/vacancies`. Честный
User-Agent (`Mozilla/5.0 (compatible; habr-search-cli/1.0; …)`) принимается.

| Параметр | Значения | Флаг CLI |
|---|---|---|
| `type` | `all` — все вакансии (без него гостю подмешиваются «подходящие») | всегда `all` |
| `q` | строка поиска | `--query` |
| `sort` | `date` — сначала свежие; без параметра — по релевантности | `--sort` |
| `locations[]` | `c_<city_id>`, повторяется | `--city` |
| `qid` | грейд: `1` стажёр, `3` junior, `4` middle, `5` senior, `6` lead (`2`, `7` — пусто) | `--grade` |
| `remote` | `true` | `--remote` |
| `salary` | зарплата от, ₽ | `--salary` |
| `with_salary` | `true` | `--with-salary` |
| `employment_type` | `full_time`, `part_time` | `--employment` |
| `page` | с 1; за последней страницей — пустой `list` | `--page` |
| `per_page` | до 50 (больше — всё равно 50) | `--limit` |

Фильтра по дате публикации нет — `--jobage` работает на клиенте.

Альтернативный параметр города `city_id=<id>` тоже работает; CLI использует
`locations[]`, как сам сайт.

### Ответ

```text
{
  "list": [ <вакансия>, ... ],
  "meta": { "totalResults": 485, "perPage": 25, "currentPage": 1, "totalPages": 20 },
  "recommendedQuickVacancies": [...]
}
```

Поля вакансии, которые читает CLI:

| Поле | Пример |
|---|---|
| `id` | `1000168937` |
| `href` | `/vacancies/1000168937` |
| `title` | `Python Backend Developer` |
| `remoteWork` | `true` |
| `qualification` | `Senior` |
| `salaryQualification.title` | `Старший (Senior)` |
| `publishedDate.date` | `2026-10-20T12:13:48+03:00` |
| `company.title` | `Пример` |
| `employment` | `full_time` |
| `salary.formatted` | `от 230 000 ₽` или `""` |
| `predictedSalary.formatted` | прогноз Хабра — **не** зарплата, не выводится |
| `divisions[].title` | `Бэкенд разработчик` |
| `skills[].title` | `Python` |
| `locations[]` | `[{"title": "Москва", "href": "/vacancies?city_id=678"}]` или `null` |
| `archived` | `false` |

### Коды городов (`city_id`)

Москва 678, Санкт-Петербург 679, Екатеринбург 693, Казань 698, Калининград 699,
Минск 713, Нижний Новгород 715, Новокузнецк 716, Новосибирск 717,
Ростов-на-Дону 726, Рязань 727, Самара 728, Ставрополь 731, Томск 736, Уфа 740,
Ярославль 747, Ереван 878, Балашиха 3268, Рыбинск 3380, Сочи 3394.

## Детали: `GET https://career.habr.com/vacancies/<id>`

HTML. Отдельного JSON-эндпоинта нет (`/api/frontend/vacancies/<id>` → 404).

1. Основной источник — `<script type="application/json" data-ssr-state="true">`:
   объект `vacancy` с теми же полями, что в поиске, плюс `description` (HTML),
   `employmentType` («Полный рабочий день»), `humanCityNames`, `bannerDescription`.
2. Запасной — `<script type="application/ld+json">` с `@type: JobPosting`:
   `title`, `description`, `datePosted`, `validThrough`, `hiringOrganization.name`,
   `jobLocation.address.addressLocality`. Отсюда же берётся `valid_through`.

Несуществующая вакансия → 404.
