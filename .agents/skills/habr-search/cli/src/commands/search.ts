import {
  BASE_URL,
  MAX_PER_PAGE,
  SEARCH_PATH,
  httpGet,
  toResult,
  writeError,
  type JobResult,
  type SearchResponse,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  cityIds: number[]
  grade?: number
  remote: boolean
  salary?: number
  withSalary: boolean
  employment?: "full_time" | "part_time"
  sort: "relevance" | "date"
  // Давность в днях. У API нет такого фильтра, поэтому он применяется к
  // полученной странице на стороне клиента (контракт /scrape это допускает).
  jobage?: number
  page: number
  limit: number
  format: "json" | "table" | "plain"
}

export function buildQuery(opts: SearchOpts): URLSearchParams {
  const p = new URLSearchParams()
  // type=all — все вакансии; без него сайт подмешивает «подходящие» для гостя.
  p.set("type", "all")
  if (opts.query) p.set("q", opts.query)
  if (opts.sort === "date") p.set("sort", "date")
  for (const id of opts.cityIds) p.append("locations[]", `c_${id}`)
  if (opts.grade !== undefined) p.set("qid", String(opts.grade))
  if (opts.remote) p.set("remote", "true")
  if (opts.salary !== undefined) p.set("salary", String(opts.salary))
  if (opts.withSalary) p.set("with_salary", "true")
  if (opts.employment) p.set("employment_type", opts.employment)
  p.set("page", String(opts.page))
  // С --jobage берём полную страницу: фильтр отсеет часть, и --limit должен
  // резать уже отфильтрованное, а не первые N до фильтра.
  p.set("per_page", String(opts.jobage !== undefined ? MAX_PER_PAGE : Math.min(opts.limit, MAX_PER_PAGE)))
  return p
}

/** Оставить вакансии не старше `days` дней (по дате публикации); без даты — отбросить. */
export function filterByAge(rows: JobResult[], days: number, now = new Date()): JobResult[] {
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10)
  return rows.filter((r) => r.date !== null && r.date >= cutoff)
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "Ничего не найдено."
  const columns: Array<{ header: string; width: number; cell: (r: JobResult) => string }> = [
    { header: "ID", width: Math.max(2, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "ВАКАНСИЯ", width: 36, cell: (r) => r.title },
    { header: "КОМПАНИЯ", width: 20, cell: (r) => r.company ?? "—" },
    { header: "ГОРОД", width: 18, cell: (r) => r.location ?? "—" },
    { header: "ГРЕЙД", width: 8, cell: (r) => r.grade ?? "—" },
    { header: "ЗАРПЛАТА", width: 22, cell: (r) => r.salary ?? "—" },
    { header: "ДАТА", width: 10, cell: (r) => r.date ?? "—" },
  ]
  const row = (cells: string[]) =>
    cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")
  const header = row(columns.map((c) => c.header))
  return [header, "-".repeat(header.length), ...rows.map((r) => row(columns.map((c) => c.cell(r))))].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "Ничего не найдено."
  return rows
    .map((r) =>
      [
        r.title,
        `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${r.date ?? "—"}`,
        `  ${[r.grade, r.salary, r.skills.slice(0, 6).join(", ")].filter(Boolean).join(" · ") || "—"}`,
        `  id: ${r.id}`,
        `  ${r.url}`,
      ].join("\n"),
    )
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const body = await httpGet(`${BASE_URL}${SEARCH_PATH}?${buildQuery(opts).toString()}`, "application/json")
    if (body === null) {
      writeError(`${SEARCH_PATH} не найден (404) — Хабр мог поменять API; см. url-reference.md`, "SEARCH_FAILED")
      return 1
    }
    let data: SearchResponse
    try {
      data = JSON.parse(body) as SearchResponse
    } catch {
      writeError("Хабр Карьера вернула не JSON — возможно, поменялся API; см. url-reference.md", "SEARCH_FAILED")
      return 1
    }
    if (!Array.isArray(data.list)) {
      writeError("в ответе Хабр Карьеры нет поля list — возможно, поменялся API", "SEARCH_FAILED")
      return 1
    }

    let rows = data.list.map(toResult)
    const fetched = rows.length
    if (opts.jobage !== undefined) rows = filterByAge(rows, opts.jobage)
    rows = rows.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      const meta: Record<string, number> = {
        count: rows.length,
        page: opts.page,
        total: data.meta?.totalResults ?? fetched,
        totalPages: data.meta?.totalPages ?? 1,
      }
      if (opts.jobage !== undefined) meta.fetched = fetched
      process.stdout.write(JSON.stringify({ meta, results: rows }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
