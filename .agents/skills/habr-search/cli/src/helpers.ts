// Источник данных: Хабр Карьера (career.habr.com).
//
// Поиск — JSON-эндпоинт, которым пользуется сам сайт (`/api/frontend/vacancies`):
// без ключа и без авторизации, robots.txt его не запрещает (закрыт только `/v1`).
// Детали — HTML-страница вакансии `/vacancies/<id>`: в ней есть встроенное
// JSON-состояние (`<script type="application/json" data-ssr-state="true">`) с
// полным описанием, а JSON-LD `JobPosting` служит запасным вариантом. Разметку
// карточек парсить не нужно — оба источника структурированы.

export const BASE_URL = "https://career.habr.com"
export const SEARCH_PATH = "/api/frontend/vacancies"

// Честный User-Agent с названием инструмента — соглашение для всех CLI-порталов
// репозитория. Хабр его принимает; маскироваться под браузер не нужно.
const UA = "Mozilla/5.0 (compatible; habr-search-cli/1.0; +https://github.com/spichkinevgeniy/ai-job-search-ru)"

// Сайт отдаёт не больше 50 вакансий на страницу (per_page=100 возвращает 50).
export const MAX_PER_PAGE = 50

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

// Суммарный лимит ожидания на все повторы одного запроса: сбой источника должен
// быстро деградировать, а не пережидать таймаут вызывающего агента.
const RETRY_BUDGET_MS = 30_000

/** Сколько просит подождать `Retry-After` (секунды или HTTP-дата), в мс; null — нет/нечитаемо. */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null
  const value = header.trim()
  if (/^\d+$/.test(value)) return Number(value) * 1000
  const date = Date.parse(value)
  if (Number.isNaN(date)) return null
  return Math.max(date - now, 0)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * GET с повторами на 429/5xx (экспоненциальная пауза с джиттером, не дольше
 * RETRY_BUDGET_MS суммарно). 404 → null. Сетевая ошибка — сразу понятное
 * исключение без повторов.
 */
export async function httpGet(url: string, accept: string): Promise<string | null> {
  const maxRetries = 6
  let delay = 500
  let waited = 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "ru-RU,ru;q=0.9" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      throw new Error(`не удалось достучаться до ${BASE_URL} (${e instanceof Error ? e.message : String(e)})`)
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`запрос к Хабр Карьере не удался: ${response.status} ${response.statusText}`)
      }
      const backoff = delay + Math.floor(Math.random() * 500)
      const wait = Math.max(backoff, retryAfterMs(response.headers.get("Retry-After")) ?? 0)
      if (waited + wait > RETRY_BUDGET_MS) {
        throw new Error(
          `запрос к Хабр Карьере не удался: ${response.status} ${response.statusText}; ` +
            `сервер просит подождать ${Math.ceil(wait / 1000)} с — больше лимита ${RETRY_BUDGET_MS / 1000} с`,
        )
      }
      await sleep(wait)
      waited += wait
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`запрос к Хабр Карьере не удался: ${response.status} ${response.statusText}`)
    }
    return await response.text()
  }
  throw new Error("запрос к Хабр Карьере не удался после повторов")
}

// --- Справочники -------------------------------------------------------------

/**
 * Грейды Хабра → параметр `qid`. Коды проверены живыми запросами (10.2026):
 * 1 Стажёр, 3 Младший, 4 Средний, 5 Старший, 6 Ведущий; 2 и 7 пустые.
 */
export const GRADES: Record<string, number> = {
  intern: 1,
  junior: 3,
  middle: 4,
  senior: 5,
  lead: 6,
}

/**
 * Города → `city_id` Хабра (из `locations[].href` в выдаче, 10.2026). Ключ —
 * латинский слаг; русские названия — синонимы. Любой другой город передаётся
 * числовым id (`--city 3268`), его видно в ссылке фильтра на сайте.
 */
export const CITIES: Record<string, number> = {
  moscow: 678,
  spb: 679,
  ekaterinburg: 693,
  kazan: 698,
  kaliningrad: 699,
  minsk: 713,
  "nizhny-novgorod": 715,
  novosibirsk: 717,
  "rostov-on-don": 726,
  ryazan: 727,
  samara: 728,
  tomsk: 736,
  ufa: 740,
  yaroslavl: 747,
  yerevan: 878,
  sochi: 3394,
}

const CITY_ALIASES: Record<string, string> = {
  москва: "moscow",
  msk: "moscow",
  "санкт-петербург": "spb",
  петербург: "spb",
  спб: "spb",
  "saint-petersburg": "spb",
  "st-petersburg": "spb",
  екатеринбург: "ekaterinburg",
  казань: "kazan",
  калининград: "kaliningrad",
  минск: "minsk",
  "нижний-новгород": "nizhny-novgorod",
  "нижний новгород": "nizhny-novgorod",
  новосибирск: "novosibirsk",
  "ростов-на-дону": "rostov-on-don",
  рязань: "ryazan",
  самара: "samara",
  томск: "tomsk",
  уфа: "ufa",
  ярославль: "yaroslavl",
  ереван: "yerevan",
  сочи: "sochi",
}

/** `city_id` по слагу, русскому названию или числу; null — город неизвестен. */
export function resolveCity(input: string): number | null {
  const v = input.trim().toLowerCase()
  if (/^\d+$/.test(v)) return Number(v)
  const slug = CITY_ALIASES[v] ?? v
  return CITIES[slug] ?? null
}

// --- Формы данных --------------------------------------------------------------

interface Titled {
  title?: string | null
  href?: string | null
}

/** Вакансия в выдаче поиска (поля, которые читает CLI; в ответе их больше). */
export interface HabrVacancy {
  id: number
  href: string
  title: string
  remoteWork?: boolean | null
  salaryQualification?: Titled | null
  qualification?: string | null
  publishedDate?: { date?: string | null; title?: string | null } | string | null
  company?: { title?: string | null; alias_name?: string | null; href?: string | null } | null
  employment?: string | null
  salary?: { from?: number | null; to?: number | null; currency?: string | null; formatted?: string | null } | null
  predictedSalary?: { formatted?: string | null } | null
  divisions?: Titled[] | null
  skills?: Titled[] | null
  locations?: Titled[] | null
  archived?: boolean | null
  // Только на странице вакансии (ssr-state):
  description?: string | null
  employmentType?: string | null
  humanCityNames?: string | null
}

export interface SearchResponse {
  list?: HabrVacancy[]
  meta?: { totalResults?: number; perPage?: number; currentPage?: number; totalPages?: number }
}

/**
 * Результат поиска в форме контракта портальных CLI: `id`, `title`, `company`,
 * `location`, `date` (YYYY-MM-DD), `url` — всегда есть, пустое — `null`.
 * Остальные поля — допустимое расширение.
 */
export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  grade: string | null
  remote: boolean
  employment: string | null
  specialization: string | null
  skills: string[]
}

export interface JobDetailResult extends JobResult {
  description: string | null
  valid_through: string | null
  archived: boolean
  isActive: boolean
}

/** YYYY-MM-DD из ISO-даты (`2026-10-20T12:13:48+03:00`); null — нет даты. */
export function contractDate(value: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? "")
  return m ? m[1] : null
}

function publishedIso(v: HabrVacancy): string | null {
  const p = v.publishedDate
  if (!p) return null
  return typeof p === "string" ? p : (p.date ?? null)
}

/** Строка зарплаты: указанная работодателем; иначе null (прогноз Хабра — не зарплата). */
function salaryText(v: HabrVacancy): string | null {
  const f = v.salary?.formatted?.trim()
  return f ? f : null
}

/** Грейд: «Middle» из `qualification` или «Средний (Middle)» из `salaryQualification`. */
function gradeText(v: HabrVacancy): string | null {
  return v.qualification?.trim() || v.salaryQualification?.title?.trim() || null
}

function locationText(v: HabrVacancy): string | null {
  const cities = (v.locations ?? []).map((l) => l.title?.trim()).filter((t): t is string => !!t)
  if (cities.length) return cities.join(", ") + (v.remoteWork ? " (можно удалённо)" : "")
  if (v.humanCityNames?.trim()) return v.humanCityNames.trim()
  return v.remoteWork ? "Удалённо" : null
}

export function vacancyUrl(id: number | string): string {
  return `${BASE_URL}/vacancies/${id}`
}

export function toResult(v: HabrVacancy): JobResult {
  return {
    id: String(v.id),
    title: decodeHtmlEntities(v.title || "").trim() || "(без названия)",
    company: v.company?.title?.trim() || null,
    location: locationText(v),
    date: contractDate(publishedIso(v)),
    url: vacancyUrl(v.id),
    salary: salaryText(v),
    grade: gradeText(v),
    remote: v.remoteWork === true,
    employment: v.employment || null,
    specialization: (v.divisions ?? []).map((d) => d.title?.trim()).filter(Boolean).join(", ") || null,
    skills: (v.skills ?? []).map((s) => s.title?.trim()).filter((t): t is string => !!t),
  }
}

// --- Разбор страницы вакансии ---------------------------------------------------

const SSR_STATE = /<script type="application\/json" data-ssr-state="true">([\s\S]*?)<\/script>/
const LD_JSON = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g

/** Объект `vacancy` из встроенного JSON-состояния страницы; null — не нашли/не разобрали. */
export function parseSsrVacancy(html: string): HabrVacancy | null {
  const m = SSR_STATE.exec(html)
  if (!m) return null
  try {
    const state = JSON.parse(m[1]) as { vacancy?: HabrVacancy }
    return state.vacancy && typeof state.vacancy.id === "number" ? state.vacancy : null
  } catch {
    return null
  }
}

export interface LdJobPosting {
  title?: string
  description?: string
  datePosted?: string
  validThrough?: string
  hiringOrganization?: { name?: string }
  jobLocation?: { address?: { addressLocality?: string } } | Array<{ address?: { addressLocality?: string } }>
}

/** Первый JSON-LD блок с `@type: JobPosting`; битые блоки пропускаются по одному. */
export function parseLdJobPosting(html: string): LdJobPosting | null {
  for (const m of html.matchAll(LD_JSON)) {
    try {
      const j = JSON.parse(m[1]) as LdJobPosting & { "@type"?: string }
      if (j["@type"] === "JobPosting") return j
    } catch {
      // один битый блок не ломает остальные
    }
  }
  return null
}

/** Детали вакансии: ssr-state как основной источник, JSON-LD — запасной и для срока. */
export function toDetail(id: string, html: string): JobDetailResult | null {
  const vac = parseSsrVacancy(html)
  const ld = parseLdJobPosting(html)
  if (!vac && !ld) return null

  if (vac) {
    const base = toResult(vac)
    const archived = vac.archived === true
    return {
      ...base,
      employment: vac.employmentType?.trim() || base.employment,
      description: cleanHtml(vac.description) ?? cleanHtml(ld?.description),
      valid_through: contractDate(ld?.validThrough),
      archived,
      isActive: !archived,
    }
  }

  const loc = Array.isArray(ld!.jobLocation) ? ld!.jobLocation[0] : ld!.jobLocation
  return {
    id,
    title: decodeHtmlEntities(ld!.title ?? "").trim() || "(без названия)",
    company: ld!.hiringOrganization?.name?.trim() || null,
    location: loc?.address?.addressLocality?.trim() || null,
    date: contractDate(ld!.datePosted),
    url: vacancyUrl(id),
    salary: null,
    grade: null,
    remote: false,
    employment: null,
    specialization: null,
    skills: [],
    description: cleanHtml(ld!.description),
    valid_through: contractDate(ld!.validThrough),
    archived: false,
    isActive: true,
  }
}

// --- Текст -----------------------------------------------------------------------

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
}

/** HTML описания → читаемый текст: блоки и <br> → переносы, пункты списков → «- ». */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    .replace(/<h\d[^>]*>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n- \n/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n(?=- )/g, "\n")
    .trim()
  return text || null
}

const HABR_HOST = /^career\.habr\.com$/i

/**
 * id вакансии из числа или ссылки `https://career.habr.com/vacancies/<id>`.
 * Ссылки на другие хосты (включая похожие: career.habr.com.evil.io,
 * career.habr.com@evil.io) отвергаются — URL разбирается по-настоящему.
 */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (!hasScheme && !/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return null
  let parsed: URL
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (parsed.username || parsed.password) return null
  if (!HABR_HOST.test(parsed.hostname)) return null
  const m = parsed.pathname.match(/^\/vacancies\/(\d+)\/?$/)
  return m ? m[1] : null
}
