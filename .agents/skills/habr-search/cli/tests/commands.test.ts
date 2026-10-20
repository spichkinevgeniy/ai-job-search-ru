import { afterEach, describe, expect, test } from "bun:test"
import { buildQuery, filterByAge, runSearch, type SearchOpts } from "../src/commands/search"
import { runDetail } from "../src/commands/detail"
import type { JobResult } from "../src/helpers"
import { DETAIL_HTML, DETAIL_HTML_EMPTY, SEARCH_RESPONSE } from "./fixtures"

const originalFetch = globalThis.fetch
const originalStdout = process.stdout.write
const originalStderr = process.stderr.write

function capture(): { out: () => string; err: () => string } {
  let out = ""
  let err = ""
  process.stdout.write = ((c: string | Uint8Array) => ((out += c.toString()), true)) as typeof process.stdout.write
  process.stderr.write = ((c: string | Uint8Array) => ((err += c.toString()), true)) as typeof process.stderr.write
  return { out: () => out, err: () => err }
}

/** Подменить fetch очередью ответов; возвращает список запрошенных URL. */
function mockFetch(responses: Array<{ status: number; body: string; headers?: Record<string, string> }>): string[] {
  const urls: string[] = []
  let i = 0
  globalThis.fetch = (async (input: string | URL | Request) => {
    urls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
    const r = responses[Math.min(i++, responses.length - 1)]
    return new Response(r.body, { status: r.status, headers: r.headers })
  }) as typeof fetch
  return urls
}

afterEach(() => {
  globalThis.fetch = originalFetch
  process.stdout.write = originalStdout
  process.stderr.write = originalStderr
})

const base: SearchOpts = {
  cityIds: [],
  remote: false,
  withSalary: false,
  sort: "relevance",
  page: 1,
  limit: 25,
  format: "json",
}

describe("buildQuery", () => {
  test("все фильтры уходят в параметры API", () => {
    const p = buildQuery({
      ...base,
      query: "python",
      cityIds: [678, 679],
      grade: 4,
      remote: true,
      salary: 200000,
      withSalary: true,
      employment: "full_time",
      sort: "date",
      page: 2,
      limit: 10,
    })
    expect(p.get("type")).toBe("all")
    expect(p.get("q")).toBe("python")
    expect(p.getAll("locations[]")).toEqual(["c_678", "c_679"])
    expect(p.get("qid")).toBe("4")
    expect(p.get("remote")).toBe("true")
    expect(p.get("salary")).toBe("200000")
    expect(p.get("with_salary")).toBe("true")
    expect(p.get("employment_type")).toBe("full_time")
    expect(p.get("sort")).toBe("date")
    expect(p.get("page")).toBe("2")
    expect(p.get("per_page")).toBe("10")
  })
  test("по умолчанию — без лишних фильтров, per_page не больше 50", () => {
    const p = buildQuery({ ...base, limit: 200 })
    expect([...p.keys()].sort()).toEqual(["page", "per_page", "type"])
    expect(p.get("per_page")).toBe("50")
  })
  test("с --jobage берётся полная страница", () => {
    expect(buildQuery({ ...base, limit: 3, jobage: 7 }).get("per_page")).toBe("50")
  })
})

describe("filterByAge", () => {
  const row = (date: string | null) => ({ date }) as JobResult
  test("отбрасывает старые и без даты", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const kept = filterByAge([row("2026-10-20"), row("2026-10-13"), row("2026-10-12"), row(null)], 7, now)
    expect(kept.map((r) => r.date)).toEqual(["2026-10-20", "2026-10-13"])
  })
})

describe("runSearch", () => {
  test("JSON-вывод по контракту", async () => {
    const urls = mockFetch([{ status: 200, body: JSON.stringify(SEARCH_RESPONSE) }])
    const io = capture()
    const code = await runSearch({ ...base, query: "python" })
    expect(code).toBe(0)
    expect(urls[0]).toStartWith("https://career.habr.com/api/frontend/vacancies?")
    const out = JSON.parse(io.out())
    expect(out.meta).toEqual({ count: 3, page: 1, total: 485, totalPages: 20 })
    for (const r of out.results) {
      for (const key of ["id", "title", "company", "location", "date", "url"]) expect(r).toHaveProperty(key)
    }
  })
  test("--limit режет выдачу на клиенте", async () => {
    mockFetch([{ status: 200, body: JSON.stringify(SEARCH_RESPONSE) }])
    const io = capture()
    await runSearch({ ...base, limit: 1 })
    expect(JSON.parse(io.out()).results).toHaveLength(1)
  })
  test("table и plain печатают русские заголовки", async () => {
    mockFetch([{ status: 200, body: JSON.stringify(SEARCH_RESPONSE) }])
    let io = capture()
    await runSearch({ ...base, format: "table" })
    expect(io.out()).toContain("ВАКАНСИЯ")
    mockFetch([{ status: 200, body: JSON.stringify({ list: [], meta: {} }) }])
    io = capture()
    await runSearch({ ...base, format: "plain" })
    expect(io.out().trim()).toBe("Ничего не найдено.")
  })
  test("не-JSON ответ — ошибка в stderr, код 1", async () => {
    mockFetch([{ status: 200, body: "<html>капча</html>" }])
    const io = capture()
    expect(await runSearch(base)).toBe(1)
    expect(io.out()).toBe("")
    expect(JSON.parse(io.err()).code).toBe("SEARCH_FAILED")
  })
  test("404 — ошибка, а не пустая выдача", async () => {
    mockFetch([{ status: 404, body: "" }])
    const io = capture()
    expect(await runSearch(base)).toBe(1)
    expect(JSON.parse(io.err()).code).toBe("SEARCH_FAILED")
  })
  test("503 повторяется, затем успех", async () => {
    const urls = mockFetch([
      { status: 503, body: "", headers: { "Retry-After": "0" } },
      { status: 200, body: JSON.stringify(SEARCH_RESPONSE) },
    ])
    const io = capture()
    expect(await runSearch(base)).toBe(0)
    expect(urls).toHaveLength(2)
    expect(JSON.parse(io.out()).meta.count).toBe(3)
  })
  test("недоступная сеть — понятная ошибка без повторов", async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch
    const io = capture()
    expect(await runSearch(base)).toBe(1)
    expect(calls).toBe(1)
    expect(JSON.parse(io.err()).error).toContain("не удалось достучаться")
  })
})

describe("runDetail", () => {
  test("ссылка → страница вакансии → JSON", async () => {
    const urls = mockFetch([{ status: 200, body: DETAIL_HTML }])
    const io = capture()
    expect(await runDetail({ id: "https://career.habr.com/vacancies/1000000001", format: "json" })).toBe(0)
    expect(urls[0]).toBe("https://career.habr.com/vacancies/1000000001")
    const d = JSON.parse(io.out())
    expect(d.id).toBe("1000000001")
    expect(d.description).toContain("Писать сервисы на Python")
    expect(d.isActive).toBe(true)
  })
  test("plain-вывод", async () => {
    mockFetch([{ status: 200, body: DETAIL_HTML }])
    const io = capture()
    await runDetail({ id: "1000000001", format: "plain" })
    expect(io.out()).toContain("Действует до: 2026-11-05")
  })
  test("чужой хост не запрашивается", async () => {
    const urls = mockFetch([{ status: 200, body: DETAIL_HTML }])
    const io = capture()
    expect(await runDetail({ id: "https://hh.ru/vacancy/1", format: "json" })).toBe(1)
    expect(urls).toHaveLength(0)
    expect(JSON.parse(io.err()).code).toBe("BAD_ID")
  })
  test("404 и пустая страница", async () => {
    mockFetch([{ status: 404, body: "" }])
    let io = capture()
    expect(await runDetail({ id: "1", format: "json" })).toBe(1)
    expect(JSON.parse(io.err()).code).toBe("NOT_FOUND")
    mockFetch([{ status: 200, body: DETAIL_HTML_EMPTY }])
    io = capture()
    expect(await runDetail({ id: "1", format: "json" })).toBe(1)
    expect(JSON.parse(io.err()).code).toBe("PARSE_FAILED")
  })
})
