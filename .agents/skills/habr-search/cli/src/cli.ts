#!/usr/bin/env bun
// CLI для поиска IT-вакансий на Хабр Карьере (career.habr.com).
// Без CLI-фреймворка и без runtime-зависимостей: запускается любым `bun`
// сразу после клонирования репозитория.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { CITIES, GRADES, resolveCity, writeError } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

const ALIAS: Record<string, string> = { q: "query", n: "limit", l: "city" }

// Флаги-переключатели никогда не забирают следующий аргумент как значение:
// иначе `--remote python` съел бы позиционный аргумент.
const BOOLEAN_FLAGS = new Set(["remote", "with-salary", "help", "h"])

export function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("-") || a === "-") {
      ;(flags._ as string[]).push(a)
      continue
    }
    const name = a.replace(/^-+/, "")
    const key = ALIAS[name] ?? name
    let value: string | boolean = true
    const next = argv[i + 1]
    if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith("-")) {
      value = next
      i++
    }
    flags[key] = value
  }
  return flags
}

const HELP = `habr-search — поиск IT-вакансий на Хабр Карьере (career.habr.com)

ИСПОЛЬЗОВАНИЕ
  bun run src/cli.ts search [-q "<запрос>"] [фильтры] [--format json|table|plain]
  bun run src/cli.ts detail <id|url> [--format json|plain]

ФЛАГИ SEARCH
  --query, -q <текст>     Ключевые слова (должность, технология, компания). Необязателен.
  --city, -l <города>     Через запятую: слаг (${Object.keys(CITIES).join(", ")}),
                          русское название (москва, спб, казань…) или числовой city_id.
  --grade <грейд>         ${Object.keys(GRADES).join(" | ")}
  --remote                Только с возможностью удалённой работы.
  --salary <₽>            Зарплата от (₽ в месяц).
  --with-salary           Только вакансии с указанной зарплатой.
  --employment <тип>      full_time | part_time
  --sort <порядок>        relevance (по умолчанию) | date. С --jobage по умолчанию date.
  --jobage <дней>         Не старше N дней. У API такого фильтра нет — отбор на стороне
                          клиента по текущей странице (поэтому сортировка по дате).
  --page <n>              Страница, с 1. По умолчанию 1.
  --limit, -n <n>         Сколько вакансий вывести (не больше 50 за страницу). По умолчанию 25.
  --format <fmt>          json (по умолчанию) | table | plain

DETAIL
  <id|url>                Числовой id из выдачи или ссылка https://career.habr.com/vacancies/<id>

ПРИМЕРЫ
  bun run src/cli.ts search -q "python" --city moscow --grade middle --format table
  bun run src/cli.ts search -q "data engineer" --remote --jobage 14 --format table
  bun run src/cli.ts search -q "frontend" --city spb,kazan --with-salary --salary 200000
  bun run src/cli.ts detail 1000168937 --format plain

Данные: публичный JSON сайта career.habr.com, без ключа. Только для личного
поиска работы, небольшим объёмом запросов.
`

function badArg(error: string): number {
  writeError(error, "BAD_ARG")
  return 1
}

/** Целое ≥ 1 или null (с ошибкой в stderr). Number(), а не parseInt: «0.5» не должно стать 0. */
function intFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(val) || val < 1) {
    badArg(`--${name} должен быть целым числом не меньше 1, получено "${raw}"`)
    return null
  }
  return val
}

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query", "city", "grade", "remote", "salary", "with-salary", "employment", "sort",
    "jobage", "page", "limit", "format", "help", "h",
  ]),
  detail: new Set(["format", "help", "h"]),
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Неизвестный флаг — ошибка, а не тихий пропуск: выброшенный фильтр меняет
  // выдачу без всякого сообщения (контракт add-portal.md).
  const known = KNOWN_FLAGS[cmd]
  if (known) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || known.has(key)) continue
      writeError(
        `неизвестный флаг --${key} для '${cmd}' — флаги никогда не игнорируются молча; список см. в --help`,
        "UNKNOWN_FLAG",
      )
      return 1
    }
  }

  if (cmd === "search") {
    // Флаг со значением, переданный без значения, нельзя считать «не задан»:
    // это молча расширило бы поиск.
    for (const name of ["query", "city", "grade", "salary", "employment", "sort", "jobage", "page", "limit", "format"]) {
      const v = flags[name]
      if (v !== undefined && (typeof v !== "string" || !v.trim())) {
        return badArg(`--${name} требует непустое значение`)
      }
    }

    const fmt = (flags.format as string | undefined) ?? "json"
    if (!["json", "table", "plain"].includes(fmt)) return badArg(`--format: json|table|plain, получено "${fmt}"`)

    const cityIds: number[] = []
    if (typeof flags.city === "string") {
      for (const part of flags.city.split(",").map((s) => s.trim()).filter(Boolean)) {
        const id = resolveCity(part)
        if (id === null) {
          return badArg(
            `неизвестный город "${part}": используй ${Object.keys(CITIES).join(", ")} или числовой city_id с сайта`,
          )
        }
        cityIds.push(id)
      }
    }

    let grade: number | undefined
    if (typeof flags.grade === "string") {
      grade = GRADES[flags.grade.trim().toLowerCase()]
      if (grade === undefined) return badArg(`--grade: ${Object.keys(GRADES).join("|")}, получено "${flags.grade}"`)
    }

    let employment: SearchOpts["employment"]
    if (typeof flags.employment === "string") {
      if (flags.employment !== "full_time" && flags.employment !== "part_time") {
        return badArg(`--employment: full_time|part_time, получено "${flags.employment}"`)
      }
      employment = flags.employment
    }

    let sort: SearchOpts["sort"] | undefined
    if (typeof flags.sort === "string") {
      if (flags.sort !== "relevance" && flags.sort !== "date") {
        return badArg(`--sort: relevance|date, получено "${flags.sort}"`)
      }
      sort = flags.sort
    }

    const ints: Record<string, number | undefined> = {}
    for (const name of ["salary", "jobage", "page", "limit"]) {
      if (flags[name] !== undefined) {
        const v = intFlag(name, flags[name])
        if (v === null) return 1
        ints[name] = v
      }
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query.trim() : undefined,
      cityIds,
      grade,
      remote: flags.remote === true,
      salary: ints.salary,
      withSalary: flags["with-salary"] === true,
      employment,
      // Фильтр давности работает по полученной странице, поэтому без явного
      // --sort свежие вакансии должны идти первыми.
      sort: sort ?? (ints.jobage !== undefined ? "date" : "relevance"),
      jobage: ints.jobage,
      page: ints.page ?? 1,
      limit: ints.limit ?? 25,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      writeError("detail требует <id|url>", "NO_ID")
      return 1
    }
    const fmt = (flags.format as string | undefined) ?? "json"
    if (fmt !== "json" && fmt !== "plain") return badArg(`--format: json|plain, получено "${fmt}"`)
    const opts: DetailOpts = { id, format: fmt }
    return runDetail(opts)
  }

  writeError(`неизвестная команда "${cmd}"`, "BAD_CMD")
  return 1
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      writeError(e instanceof Error ? e.message : String(e), "INTERNAL_ERROR")
      process.exit(1)
    })
}
