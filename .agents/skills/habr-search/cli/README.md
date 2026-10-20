# habr-search-cli

CLI для поиска IT-вакансий на [Хабр Карьере](https://career.habr.com). Ноль
runtime-зависимостей: `bun install` ставит только типы для проверки TypeScript.

```bash
cd .agents/skills/habr-search/cli
bun install            # необязательно, только для typecheck
bun run src/cli.ts search -q "python" --city moscow --format table
bun run src/cli.ts detail 1000168937 --format plain
bun run test           # офлайн: fetch подменяется, сеть не нужна
bun run typecheck
```

Флаги, формат вывода и коды ошибок — в [`../SKILL.md`](../SKILL.md);
эндпоинты и параметры API — в [`../url-reference.md`](../url-reference.md).

## Устройство

- `src/cli.ts` — разбор аргументов, справка, проверки, вызов команд.
- `src/helpers.ts` — HTTP с повторами (429/5xx, `Retry-After`, лимит 30 с),
  справочники городов и грейдов, разбор выдачи и страницы вакансии.
- `src/commands/search.ts`, `src/commands/detail.ts` — команды.
- `tests/` — тесты на синтетических фикстурах в форме реальных ответов.
