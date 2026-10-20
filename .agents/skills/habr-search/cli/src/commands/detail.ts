import { httpGet, normalizeId, toDetail, vacancyUrl, writeError, type JobDetailResult } from "../helpers.js"

export interface DetailOpts {
  id: string // числовой id или ссылка https://career.habr.com/vacancies/<id>
  format: "json" | "plain"
}

function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]
  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Опубликована", job.date)
  field("Действует до", job.valid_through)
  field("Грейд", job.grade)
  field("Зарплата", job.salary)
  field("Занятость", job.employment)
  field("Специализация", job.specialization)
  field("Навыки", job.skills.length ? job.skills.join(", ") : null)
  if (job.archived) lines.push("⚠ Вакансия в архиве — отклик закрыт")
  lines.push("", job.description ?? "(описания нет)", "", `URL: ${job.url}`, `id: ${job.id}`)
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`не удалось получить id вакансии Хабр Карьеры из "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await httpGet(vacancyUrl(id), "text/html")
    if (html === null) {
      writeError("вакансия не найдена (404)", "NOT_FOUND")
      return 1
    }
    const job = toDetail(id, html)
    if (!job) {
      writeError("на странице вакансии нет данных (ни ssr-state, ни JSON-LD) — возможно, поменялась разметка", "PARSE_FAILED")
      return 1
    }
    process.stdout.write((opts.format === "plain" ? renderPlain(job) : JSON.stringify(job, null, 2)) + "\n")
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
