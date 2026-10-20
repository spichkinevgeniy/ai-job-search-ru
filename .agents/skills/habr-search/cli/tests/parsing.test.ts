import { describe, expect, test } from "bun:test"
import {
  cleanHtml,
  contractDate,
  normalizeId,
  parseLdJobPosting,
  parseSsrVacancy,
  resolveCity,
  retryAfterMs,
  toDetail,
  toResult,
} from "../src/helpers"
import {
  DETAIL_HTML,
  DETAIL_HTML_ARCHIVED,
  DETAIL_HTML_EMPTY,
  DETAIL_HTML_LD_ONLY,
  VAC_CITIES_SALARY,
  VAC_NO_DATE,
  VAC_REMOTE_NO_CITY,
} from "./fixtures"

describe("toResult — форма контракта", () => {
  test("удалённая вакансия без города", () => {
    const r = toResult(VAC_REMOTE_NO_CITY)
    expect(r.id).toBe("1000000001")
    expect(r.title).toBe("Python Backend Developer (FastAPI & AI)")
    expect(r.company).toBe("Пример Софт")
    expect(r.location).toBe("Удалённо")
    expect(r.date).toBe("2026-10-20")
    expect(r.url).toBe("https://career.habr.com/vacancies/1000000001")
    expect(r.grade).toBe("Senior")
    expect(r.remote).toBe(true)
    expect(r.specialization).toBe("Бэкенд разработчик")
    expect(r.skills).toEqual(["Python", "FastAPI"])
  })

  test("прогноз зарплаты Хабра не выдаётся за зарплату", () => {
    expect(toResult(VAC_REMOTE_NO_CITY).salary).toBeNull()
  })

  test("города и указанная зарплата", () => {
    const r = toResult(VAC_CITIES_SALARY)
    expect(r.location).toBe("Москва, Санкт-Петербург")
    expect(r.salary).toBe("от 230 000 ₽")
    expect(r.remote).toBe(false)
  })

  test("пустые поля — null, а не пропуск", () => {
    const r = toResult(VAC_NO_DATE)
    expect(r.title).toBe("(без названия)")
    for (const key of ["company", "location", "date", "salary", "grade", "employment", "specialization"]) {
      expect(r).toHaveProperty(key)
      expect((r as unknown as Record<string, unknown>)[key]).toBeNull()
    }
  })
})

describe("даты и Retry-After", () => {
  test("contractDate режет ISO до дня", () => {
    expect(contractDate("2026-10-20T12:13:48+03:00")).toBe("2026-10-20")
    expect(contractDate("20 октября")).toBeNull()
    expect(contractDate(null)).toBeNull()
  })
  test("retryAfterMs понимает секунды и HTTP-дату", () => {
    expect(retryAfterMs("3")).toBe(3000)
    expect(retryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6000)
    expect(retryAfterMs("мусор")).toBeNull()
    expect(retryAfterMs(null)).toBeNull()
  })
})

describe("resolveCity", () => {
  test("слаг, русское название, число", () => {
    expect(resolveCity("moscow")).toBe(678)
    expect(resolveCity("Москва")).toBe(678)
    expect(resolveCity("спб")).toBe(679)
    expect(resolveCity("Нижний Новгород")).toBe(715)
    expect(resolveCity("3268")).toBe(3268)
  })
  test("неизвестный город — null", () => {
    expect(resolveCity("tokyo")).toBeNull()
  })
})

describe("normalizeId", () => {
  test("число и ссылка на career.habr.com", () => {
    expect(normalizeId("1000168937")).toBe("1000168937")
    expect(normalizeId("https://career.habr.com/vacancies/1000168937")).toBe("1000168937")
    expect(normalizeId("career.habr.com/vacancies/1000168937/")).toBe("1000168937")
  })
  test("чужие и похожие хосты отвергаются", () => {
    expect(normalizeId("https://career.habr.com.evil.io/vacancies/1")).toBeNull()
    expect(normalizeId("https://career.habr.com@evil.io/vacancies/1")).toBeNull()
    expect(normalizeId("https://evil.io/vacancies/1")).toBeNull()
    expect(normalizeId("https://hh.ru/vacancy/135237472")).toBeNull()
  })
  test("не вакансия и мусор", () => {
    expect(normalizeId("https://career.habr.com/companies/yandex")).toBeNull()
    expect(normalizeId("abc")).toBeNull()
    expect(normalizeId("")).toBeNull()
  })
})

describe("cleanHtml", () => {
  test("абзацы, заголовки, списки, сущности", () => {
    const text = toDetail("1000000001", DETAIL_HTML)!.description!
    expect(text).toContain("Проект: платформа «ИИ».")
    expect(text).toContain("Чем предстоит заниматься:\n- Писать сервисы на Python\n- Поддерживать Kafka & Redis")
    expect(text).not.toContain("<")
  })
  test("пустое — null", () => {
    expect(cleanHtml("")).toBeNull()
    expect(cleanHtml("<p> </p>")).toBeNull()
  })
})

describe("страница вакансии", () => {
  test("ssr-state — основной источник, JSON-LD даёт срок", () => {
    expect(parseSsrVacancy(DETAIL_HTML)?.id).toBe(1000000001)
    const d = toDetail("1000000001", DETAIL_HTML)!
    expect(d.title).toBe("Python Backend Developer (FastAPI & AI)")
    expect(d.employment).toBe("Полный рабочий день")
    expect(d.valid_through).toBe("2026-11-05")
    expect(d.isActive).toBe(true)
  })
  test("битый JSON-LD блок пропускается, целый находится", () => {
    expect(parseLdJobPosting(DETAIL_HTML)?.title).toBe("Python Backend Developer (LD)")
  })
  test("архивная вакансия помечена неактивной", () => {
    const d = toDetail("1000000002", DETAIL_HTML_ARCHIVED)!
    expect(d.archived).toBe(true)
    expect(d.isActive).toBe(false)
    expect(d.valid_through).toBeNull()
  })
  test("только JSON-LD — запасной путь", () => {
    const d = toDetail("1000000001", DETAIL_HTML_LD_ONLY)!
    expect(d.title).toBe("Python Backend Developer (LD)")
    expect(d.company).toBe("Пример Софт")
    expect(d.location).toBe("Пенза")
    expect(d.date).toBe("2026-10-06")
    expect(d.description).toBe("Описание из JSON-LD")
  })
  test("нет ни того, ни другого — null", () => {
    expect(toDetail("1", DETAIL_HTML_EMPTY)).toBeNull()
  })
})
