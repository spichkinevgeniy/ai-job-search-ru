// Синтетические фикстуры в форме реальных ответов career.habr.com (10.2026).
// Поля и вложенность повторяют живой ответ; тексты и компании вымышленные.

import type { HabrVacancy, SearchResponse } from "../src/helpers"

export const VAC_REMOTE_NO_CITY: HabrVacancy = {
  id: 1000000001,
  href: "/vacancies/1000000001",
  title: "Python Backend Developer (FastAPI &amp; AI)",
  remoteWork: true,
  salaryQualification: { title: "Старший (Senior)", href: "/vacancies?qid=5" },
  qualification: "Senior",
  publishedDate: { date: "2026-10-20T12:13:48+03:00", title: "20 октября" },
  company: { title: "Пример Софт", alias_name: "primer", href: "/companies/primer" },
  employment: "full_time",
  salary: { from: null, to: null, currency: null, formatted: "" },
  predictedSalary: { formatted: "от 312 000 до 409 000 ₽" },
  divisions: [{ title: "Бэкенд разработчик", href: "/vacancies/spec/development/backend" }],
  skills: [
    { title: "Python", href: "/vacancies/programmist_python" },
    { title: "FastAPI", href: "/vacancies/skills/fastapi" },
  ],
  locations: null,
  archived: false,
}

export const VAC_CITIES_SALARY: HabrVacancy = {
  id: 1000000002,
  href: "/vacancies/1000000002",
  title: "Middle Python developer",
  remoteWork: false,
  salaryQualification: { title: "Средний (Middle)", href: "/vacancies?qid=4" },
  qualification: "Middle",
  publishedDate: { date: "2026-10-01T09:00:00+03:00", title: "1 октября" },
  company: { title: "Тест Банк", alias_name: "testbank", href: "/companies/testbank" },
  employment: "full_time",
  salary: { from: 230000, to: null, currency: "rur", formatted: "от 230 000 ₽" },
  divisions: [],
  skills: [],
  locations: [
    { title: "Москва", href: "/vacancies?city_id=678" },
    { title: "Санкт-Петербург", href: "/vacancies?city_id=679" },
  ],
  archived: false,
}

export const VAC_NO_DATE: HabrVacancy = {
  id: 1000000003,
  href: "/vacancies/1000000003",
  title: "  ",
  remoteWork: null,
  company: null,
  publishedDate: null,
  locations: [],
}

export const SEARCH_RESPONSE: SearchResponse = {
  list: [VAC_REMOTE_NO_CITY, VAC_CITIES_SALARY, VAC_NO_DATE],
  meta: { totalResults: 485, perPage: 25, currentPage: 1, totalPages: 20 },
}

const DESCRIPTION_HTML =
  '<div class="habr-wysiwyg-content"><p><strong>Проект:</strong> платформа &laquo;ИИ&raquo;.<br><br></p>' +
  "<h4>Чем предстоит заниматься:</h4><ul><li><p>Писать сервисы на Python</p></li>" +
  "<li><p>Поддерживать Kafka &amp; Redis</p></li></ul></div>"

const LD_POSTING = {
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  datePosted: "2026-10-06",
  title: "Python Backend Developer (LD)",
  description: "<p>Описание из JSON-LD</p>",
  identifier: { "@type": "PropertyValue", name: "Пример Софт", value: 1000000001 },
  validThrough: "2026-11-05",
  hiringOrganization: { "@type": "Organization", name: "Пример Софт" },
  jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Пенза" } },
}

function page(ssr: unknown | null, ld: unknown | null): string {
  return [
    "<!DOCTYPE html><html lang=\"ru\"><head><title>Вакансия</title>",
    ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : "",
    '<script type="application/ld+json">{ битый json </script>',
    "</head><body><div class=\"vacancy-description__text\">…</div>",
    ssr ? `<script type="application/json" data-ssr-state="true">${JSON.stringify(ssr)}</script>` : "",
    "</body></html>",
  ].join("\n")
}

export const DETAIL_HTML = page(
  {
    vacancy: {
      ...VAC_REMOTE_NO_CITY,
      description: DESCRIPTION_HTML,
      employmentType: "Полный рабочий день",
      humanCityNames: "",
    },
    company: {},
  },
  LD_POSTING,
)

export const DETAIL_HTML_ARCHIVED = page(
  { vacancy: { ...VAC_CITIES_SALARY, archived: true, description: "<p>Старая вакансия</p>" } },
  null,
)

export const DETAIL_HTML_LD_ONLY = page(null, LD_POSTING)

export const DETAIL_HTML_EMPTY = page(null, null)
