// Проверки аргументов CLI. Все кейсы падают ДО сетевого запроса, поэтому
// тесты работают офлайн.
import { describe, expect, test } from "bun:test"
import { parseFlags } from "../src/cli"
import { runCLI } from "./helpers"

async function expectBadArgs(args: string[], code: string) {
  const r = await runCLI(args)
  expect(r.exitCode).toBe(1)
  expect(r.stdout).toBe("")
  expect(JSON.parse(r.stderr).code).toBe(code)
}

describe("parseFlags", () => {
  test("переключатели не съедают следующий аргумент", () => {
    const f = parseFlags(["search", "--remote", "python", "-q", "go"])
    expect(f.remote).toBe(true)
    expect(f._).toEqual(["search", "python"])
    expect(f.query).toBe("go")
  })
  test("короткие алиасы", () => {
    const f = parseFlags(["search", "-q", "x", "-n", "5", "-l", "spb"])
    expect([f.query, f.limit, f.city]).toEqual(["x", "5", "spb"])
  })
})

describe("валидация", () => {
  test("неизвестный флаг", () => expectBadArgs(["search", "--location", "msk"], "UNKNOWN_FLAG"))
  test("флаг detail не принимается в search и наоборот", () => expectBadArgs(["detail", "1", "--city", "moscow"], "UNKNOWN_FLAG"))
  test("пустой --query", () => expectBadArgs(["search", "--query"], "BAD_ARG"))
  test("неизвестный город", () => expectBadArgs(["search", "--city", "tokyo"], "BAD_ARG"))
  test("неизвестный грейд", () => expectBadArgs(["search", "--grade", "principal"], "BAD_ARG"))
  test("неверная занятость", () => expectBadArgs(["search", "--employment", "remote"], "BAD_ARG"))
  test("неверная сортировка", () => expectBadArgs(["search", "--sort", "salary"], "BAD_ARG"))
  test("--page 0 и дробный --jobage", async () => {
    await expectBadArgs(["search", "--page", "0"], "BAD_ARG")
    await expectBadArgs(["search", "--jobage", "0.5"], "BAD_ARG")
  })
  test("неверный формат", () => expectBadArgs(["search", "--format", "csv"], "BAD_ARG"))
  test("detail без id", () => expectBadArgs(["detail"], "NO_ID"))
  test("detail с чужим хостом", () => expectBadArgs(["detail", "https://hh.ru/vacancy/1"], "BAD_ID"))
  test("неизвестная команда", () => expectBadArgs(["find"], "BAD_CMD"))
  test("--help печатает справку и выходит с 0", async () => {
    const r = await runCLI(["search", "--help"])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain("habr-search")
  })
})
