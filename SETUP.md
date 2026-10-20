# Руководство по настройке

Пошаговая инструкция, как запустить фреймворк AI Job Search RU.

## 1. Требования

### Claude Code

Установите Claude Code (CLI от Anthropic для работы с Claude):

```bash
npm install -g @anthropic-ai/claude-code
```

Понадобится API-ключ Anthropic или подписка Claude Pro/Max/Team. Официально Anthropic не обслуживает пользователей из России — нужен действующий доступ к Claude Code. Подробности — в [документации Claude Code](https://docs.anthropic.com/en/docs/claude-code).

### Python

Для инструмента сравнения зарплат нужен Python 3.10+. Проверка:

```bash
python3 --version
```

На Windows надёжнее всего проверять через `py --version`. Если Python в вашей системе вызывается как `python`, а не `python3`, используйте `python` в командах ниже.

### Bun (для инструментов поиска вакансий)

CLI порталов (`habr-search` для Хабр Карьеры и `freehire-search`) написаны на TypeScript и запускаются через Bun.

- macOS/Linux:

```bash
curl -fsSL https://bun.sh/install | bash
```

- Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://bun.sh/install.ps1 | iex"
```

Если предпочитаете менеджер пакетов, на Windows подойдёт и `winget install Oven-sh.Bun`.

### LaTeX (для сборки резюме и сопроводительных писем)

Установите дистрибутив LaTeX, чтобы собирать сгенерированные `.tex` в PDF:

- **Windows:** [MiKTeX](https://miktex.org/download)
- **macOS:** [MacTeX](https://tug.org/mactex/)
- **Linux:** `sudo apt install texlive-full` или `sudo dnf install texlive-scheme-full`

Резюме собирается через `lualatex` (pdflatex на свежих MiKTeX часто падает с ошибками расширения шрифтов `fontawesome5`). Сопроводительное письмо — через `xelatex`, потому что `cover.cls` требует `fontspec` для своих шрифтов Lato/Raleway.

**Кириллица.** Для резюме и писем на русском нужны шрифты с кириллицей. Полные дистрибутивы (TeX Live full, MacTeX, полный MiKTeX) их уже содержат; на минимальной установке проверьте, что кириллица в собранном PDF отображается, а не пропадает или превращается в квадратики, и при необходимости доустановите шрифты (например, семейство `cm-super` или `lm` для lualatex) либо укажите в шаблоне системный шрифт с кириллицей.

<a id="minimal-tex-install-tinytexbasictex"></a>
#### Минимальная установка TeX: TinyTeX/BasicTeX

Полные дистрибутивы TeX работают сразу, а минимальным нужно несколько дополнительных пакетов, прежде чем стандартные шаблоны соберутся.

На macOS установка TinyTeX на уровне пользователя обходится без системного установщика и не требует `sudo`:

```bash
curl -fsSL https://yihui.org/tinytex/install-bin-unix.sh -o /tmp/tinytex-install-bin-unix.sh
sh /tmp/tinytex-install-bin-unix.sh /tmp --no-path
export PATH="$HOME/Library/TinyTeX/bin/universal-darwin:$PATH"
```

`export` выше действует только в текущем окне терминала. Сохраните его, иначе в каждом новом окне будет `zsh: command not found: lualatex` (или `xelatex`), хотя TinyTeX установился нормально:

```bash
echo 'export PATH="$HOME/Library/TinyTeX/bin/universal-darwin:$PATH"' >> ~/.zshrc
source ~/.zshrc
lualatex --version   # should print a version, not "command not found"
```

(Если у вас Bash — допишите в `~/.bash_profile`.)

Затем установите зависимости шаблонов:

```bash
tlmgr install \
  moderncv fontawesome5 fontawesome6 academicons import luatexbase pgf \
  titlesec textpos xltxtra xunicode cite realscripts needspace
```

Для BasicTeX/MacTeX сначала убедитесь, что каталог бинарников TeX есть в `PATH` (например, `/Library/TeX/texbin`), затем выполните ту же команду `tlmgr install ...`.

Быстрые smoke-тесты после настройки:

```bash
cd cv && lualatex -interaction=nonstopmode -halt-on-error main_example.tex && cd ..

SMOKE_DIR="$(mktemp -d /tmp/ai-job-cover-smoke.XXXXXX)"
cp -R cover_letters/cover.cls cover_letters/OpenFonts "$SMOKE_DIR/"
cat >"$SMOKE_DIR/cover_smoke.tex" <<'EOF'
\documentclass[]{cover}
\begin{document}
\namesection{Test}{Candidate}{test@example.com}
\companyname{Example Company}
\companyaddress{123 Hiring Street\\Example City}
\currentdate{\today}
\lettercontent{Dear Hiring Manager,}
\lettercontent{This smoke test verifies that xelatex can load cover.cls and the bundled fonts.}
\closing{Sincerely,}
\signature{Test Candidate}
\end{document}
EOF
(cd "$SMOKE_DIR" && xelatex -interaction=nonstopmode -halt-on-error cover_smoke.tex)
```

#### Windows: Basic MiKTeX

Полный установщик MiKTeX включает все пакеты CTAN и работает сразу, а более компактный [Basic MiKTeX](https://miktex.org/download) (`basic-miktex-*.exe`) ставит минимальный набор пакетов, и перед сборкой стандартных шаблонов нужно один раз поменять пару настроек.

По умолчанию MiKTeX доустанавливает недостающие пакеты на лету, но для каждого показывает окно с вопросом — а это блокирует неинтерактивные терминалы (включая инструмент Bash в Claude Code). Включите вместо этого тихую автоустановку:

```powershell
initexmf --admin --set-config-value=[MPM]AutoInstall=1
initexmf --set-config-value=[MPM]AutoInstall=1
```

(Первую строку запускайте из PowerShell с правами администратора, если ставили MiKTeX для всех пользователей; вторая — для установки на одного пользователя. Сработает только одна, в зависимости от способа установки, — запуск обеих безвреден.)

Если не хотите полагаться на установку на лету (например, чтобы потом собирать полностью офлайн), заранее поставьте тот же набор пакетов, что указан выше в разделе про TinyTeX для macOS, через менеджер пакетов MiKTeX:

```powershell
mpm --admin --install=moderncv --install=fontawesome5 --install=fontawesome6 --install=academicons --install=import --install=luatexbase --install=pgf --install=titlesec --install=textpos --install=xltxtra --install=xunicode --install=cite --install=realscripts --install=needspace
```

Уберите `--admin`, если MiKTeX установлен только для текущего пользователя. Если имя пакета не находится, `mpm --find=<name>` поищет правильное имя в репозитории.

Быстрые smoke-тесты после настройки (PowerShell):

```powershell
Set-Location cv; lualatex -interaction=nonstopmode -halt-on-error main_example.tex; Set-Location ..

$SmokeDir = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "ai-job-cover-smoke-$(Get-Random)")
Copy-Item cover_letters\cover.cls, cover_letters\OpenFonts -Destination $SmokeDir -Recurse
@'
\documentclass[]{cover}
\begin{document}
\namesection{Test}{Candidate}{test@example.com}
\companyname{Example Company}
\companyaddress{123 Hiring Street\\Example City}
\currentdate{\today}
\lettercontent{Dear Hiring Manager,}
\lettercontent{This smoke test verifies that xelatex can load cover.cls and the bundled fonts.}
\closing{Sincerely,}
\signature{Test Candidate}
\end{document}
'@ | Set-Content (Join-Path $SmokeDir "cover_smoke.tex")
Push-Location $SmokeDir; xelatex -interaction=nonstopmode -halt-on-error cover_smoke.tex; Pop-Location
```

### Необязательно: извлечение текста для ATS (pypdf, затем pdftotext)

`/apply` проверяет собранное резюме на читаемость ATS (система автоматического отбора резюме): извлекает текстовый слой PDF и проверяет контакты, порядок чтения и покрытие ключевых слов так, как их видит такая система.

Извлекатель по умолчанию — **pypdf** (BSD, `pip install pypdf`). `pdftotext` из Poppler остаётся необязательным запасным вариантом:

- **macOS:** `brew install poppler`
- **Debian/Ubuntu:** `sudo apt install poppler-utils`
- **Windows:** `choco install poppler`

Если команда всё же использует `pdftotext -layout`, ей обязательно нужно передавать и `-enc UTF-8` (для кириллицы это критично). Если **нет ни одного** извлекателя, `/apply` пропускает механическую проверку с предупреждением и переходит к визуальному просмотру ключевых слов — всё остальное работает как обычно.

<a id="2-fork-and-clone"></a>
## 2. Форк и клонирование

```bash
gh repo fork spichkinevgeniy/ai-job-search-ru --clone
cd ai-job-search-ru
gh repo set-default <your-github-username>/ai-job-search-ru
```

Или вручную: сделайте форк на GitHub и клонируйте его.

> **Строка `set-default` обязательна.** `gh repo fork --clone` делает репозиторий
> **upstream** репозиторием по умолчанию для gh («The `upstream` remote will be set as
> the default remote repository» — `gh repo fork --help`), а gh использует его для
> **создания issue и PR**. Без этой строки любой последующий `gh issue create` из этого
> клона — вашими руками или руками агента, которому вы поручили следить за откликами, —
> молча создаст issue в **публичном** трекере upstream, опубликовав его содержимое
> от вашего имени на GitHub, в репозитории, где вы не можете его удалить (#389 в оригинале).

> **Прежде чем идти дальше: форки публичны.** GitHub не позволяет сделать форк публичного
> репозитория приватным, а `/setup` (раздел 6) записывает ваши личные данные в файлы,
> **отслеживаемые git**, — пуш этих коммитов в форк публикует их. Если копия нужна для
> вашего собственного поиска работы, а не для контрибьюта, лучше сделайте **приватный
> репозиторий** с этим репозиторием в роли `upstream`: точные команды и объяснение, почему
> коммитить персонализацию там всё равно правильно, — в разделе 8, шаг 1. Всё остальное
> в руководстве работает одинаково в обоих случаях.

## 3. Установка зависимостей CLI поиска вакансий
Запускайте из корня репозитория.

```bash
python3 tools/install_portal_clis.py   # Windows: python tools\install_portal_clis.py
```

Скрипт запускает `bun install` в каждом CLI порталов в `.agents/skills/*/cli/`. Список не зашит, а обнаруживается автоматически, так что портал, добавленный через `/add-portal` или скопированный из другого форка, тоже установится на свежем клоне. CLI, чей `package.json` объявляет скрипт жизненного цикла при установке, пропускается с сообщением, а не запускается. `--dry-run` показывает, что будет установлено.

Для `habr-search` и `freehire-search` установка необязательна: у них нет зависимостей времени выполнения, они запускаются обычным `bun`; `bun install` только подтягивает типы TypeScript для разработки.

Проверка поиска по Хабр Карьере:

```bash
bun run .agents/skills/habr-search/cli/src/cli.ts search -q "python" --city moscow --grade middle --remote --jobage 14 --format table
```

Нужного сайта вакансий нет среди встроенных? Сгенерируйте для него навык поиска командой `/add-portal` — она создаёт ту же структуру CLI для любого публичного портала и перед регистрацией делает живой тестовый запрос. См. раздел «Инструменты поиска вакансий» в README.

## 4. Интервью для настройки

Запустите Claude Code в репозитории:

```bash
claude
```

Затем запустите онбординг:

```
/setup
```

Claude предложит три пути:

- **Путь A (папка документов):** положите в `documents/` резюме, экспорт LinkedIn, дипломы, рекомендации или прошлые отклики. Claude прочитает и сопоставит их, прежде чем предложить изменения профиля. Лучший вариант, если исходных файлов несколько.
- **Путь B (импорт одного резюме):** передайте одно резюме, упомянув файл через `@` или вставив текст. Claude извлечёт данные и задаст уточняющие вопросы о недостающем.
- **Путь C (режим интервью):** отвечайте на структурированные вопросы раздел за разделом.

Все три пути дают одинаковый результат: полностью заполненные файлы профиля.

### Что заполняется

| Файл | Содержимое |
|------|---------|
| `CLAUDE.md` | Полный профиль кандидата |
| `01-candidate-profile.md` | Структурированные образование, опыт, навыки |
| `02-behavioral-profile.md` | Поведенческая оценка |
| `04-job-evaluation.md` | Персональные области совпадения навыков и карьерные цели |
| `05-cv-templates.md` | Шаблоны раздела «О себе» под ваш бэкграунд |
| `07-interview-prep.md` | Примеры STAR (Ситуация–Задача–Действие–Результат) из вашего опыта |
| `cv/main_example.tex` | Ваше резюме в LaTeX с реальными данными |
| `search-queries.md` | Поисковые запросы для `/scrape` |

### Повторная настройка

Отдельные разделы можно обновить позже:

```
/setup --section skills
/setup --section experience
/setup --section search
```

Вариант `--section search` особенно полезен, когда меняются приоритеты. Он заново проводит интервью по настройке поиска и предлагает типы ролей, о которых вы могли не подумать, исходя из полного профиля.

## 5. Необязательно: сравнение зарплат

Если у вас есть данные о зарплатах (зарплатные отчёты Хабр Карьеры, исследования hh.ru, опросы или собственные данные):

1. **Вариант A:** создайте `salary_data.json` вручную в корне репозитория (формат — в `tools/README_SALARY_TOOL.md`)
2. **Вариант B:** сконвертируйте из Excel:
   ```bash
   pip install openpyxl
   python3 tools/convert_salary_excel.py path/to/salary-data.xlsx --source "My Salary Data 2025"
   ```

Так появится `salary_data.json`, который процесс `/apply` использует для сравнения зарплат. Если пропустить этот шаг, сравнение зарплат просто не выполняется.

## 6. Проверка процесса

Найдите интересную вакансию, затем:

```
/apply https://career.habr.com/vacancies/<id>
```

Или вставьте текст вакансии напрямую:

```
/apply [вставьте сюда текст вакансии]
```

Claude:
1. Оценит соответствие вашему профилю
2. Спросит, продолжать ли
3. Подготовит черновики резюме и сопроводительного письма под вакансию
4. Передаст черновики на критику агенту-ревьюеру
5. Внесёт правки и покажет итог

## 7. Сборка документов

После того как `/apply` создал LaTeX-файлы:

```bash
# Bash / zsh / Git Bash
cd cv && lualatex main_<company>_<role>.tex && cd ..
cd cover_letters && xelatex cover_<company>_<role>.tex && cd ..
```

```powershell
# PowerShell
Set-Location cv; lualatex main_<company>_<role>.tex; Set-Location ..
Set-Location cover_letters; xelatex cover_<company>_<role>.tex; Set-Location ..
```

Эти команды — для стандартных шаблонов (резюме на moderncv, письмо на `cover.cls`). Если хотите свой LaTeX-шаблон, запустите `/add-template`: команда запишет движок сборки, шрифты, правила оформления и лимит страниц, сделает тестовую сборку и подключит шаблон к `/apply`. См. раздел «Свои шаблоны» в README.

<a id="8-pulling-upstream-updates-into-your-fork"></a>
## 8. Получение обновлений из upstream в вашу копию

Для вашей копии основной репозиторий (upstream) — этот, `spichkinevgeniy/ai-job-search-ru`; сам он, в свою очередь, получает изменения из оригинала [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search). Upstream продолжает улучшать файлы методологии, которые вы персонализировали, поэтому закладывайте обновления с первого дня:

**Предпочитайте релизы сырому `master`.** Размеченные [релизы](../../releases) — проверенные точки, каждая описана в [CHANGELOG.md](CHANGELOG.md). Обновление до тега даёт стабильное, задокументированное состояние, а не то, что оказалось в `master` посреди ревью. Получите теги через `git fetch upstream --tags` и смёрджите релиз (например, `git merge v1.0.0`), когда нужна стабильность; тяните `master` напрямую, только если вам нужны именно свежие невыпущенные изменения. Шаги ниже работают в обоих случаях — подставьте тег релиза вместо `upstream/master`.

1. **Закоммитьте персонализацию — но знайте, куда попадут коммиты.** `/setup` правит CLAUDE.md и файлы профиля на месте; эти правки — *ваши*, и именно коммит позволяет обновлениям сливаться чисто. Но **форк на GitHub публичен** — форки публичных репозиториев нельзя сделать приватными, — так что всё, что вы закоммитите *и запушите в форк*, видно всем. Если хотите хранить профиль на удалённом сервере, не пушьте его в форк: создайте **приватный** репозиторий, пушьте туда и добавьте этот репозиторий как remote `upstream` (`git remote add upstream https://github.com/spichkinevgeniy/ai-job-search-ru.git`), чтобы получать обновления. Коммитить локально без пуша — тоже нормально. Действительно чувствительные файлы (трекер, данные о зарплатах, `documents/`, архивы откликов) в `.gitignore` и в git не попадают ни в каком случае. Незакоммиченное рабочее дерево — самая частая причина, по которой `git pull` вообще отказывается сливать (`Your local changes ... would be overwritten`).
2. **Посмотрите, что изменилось, до слияния:**
   ```bash
   git remote add upstream https://github.com/spichkinevgeniy/ai-job-search-ru.git   # first time only, if you cloned your own fork
   git fetch upstream    # or origin, if you cloned the template directly
   python3 tools/check_upstream_updates.py
   ```
   Скрипт сравнивает маркеры `framework_version` в ваших файлах фреймворка с upstream и перечисляет, какие именно файлы методологии изменились, с командой diff для каждого.

   Два инструмента отвечают на два разных вопроса, и стоит запускать оба:
   - **`check_upstream_updates.py`** — *какие из моих персонализированных файлов изменились?* Он читает метку `framework_version` в каждом файле методологии и поэтому точно помечает настроенные файлы, которые затронул релиз.
   - **`upstream_triage.py`** — *какие коммиты upstream заслуживают внимания?* Он проходит по коммитам, от которых вы отстали, и сортирует их на «стоит посмотреть» и «можно пропустить», выкидывая уже перенесённые через cherry-pick (сопоставление по `git patch-id`, так что перенесённое отпадает без учёта вручную), коммиты, которые трогают только удалённые в вашем форке файлы, и SHA из `.github/upstream-wontport.txt`. Он только отчитывается — печатает готовые строки `git cherry-pick`, но никогда не сливает, не пушит и не открывает PR, потому что в форке «применяется чисто» не значит «правильно».

     ```bash
     python3 tools/upstream_triage.py --remote upstream
     ```

     Форки также наследуют `.github/workflows/upstream-watch.yml`, который запускает это еженедельно и пишет результат в одно обновляемое issue (на самом шаблоне upstream он ничего не делает, а в форке выключен, пока вы не включите Actions).
3. **Сливайте как обычно.** `git merge upstream/master` (или `git pull`) делает трёхстороннее слияние правок upstream вокруг вашей персонализации; поскольку правки методологии редко трогают строки, заполненные `/setup`, большинство обновлений проходит чисто. Конфликт в персонализированном файле — это *функция*, а не сбой: значит, upstream поменял методологию в разделе, который вы настроили, а маркер версии и его коммит в changelog объяснят почему. Разрешайте так: сохраните свои данные и примите изменение методологии вокруг них.

> **Примечание для этого форка.** Если вы хотите получать изменения напрямую из оригинала,
> а не из русской адаптации, укажите в качестве `upstream` `https://github.com/MadsLorentzen/ai-job-search.git`.
> Учтите: оригинал на английском и с датскими порталами, поэтому его коммиты в переведённые файлы
> почти всегда будут конфликтовать — `upstream_triage.py` поможет отобрать нужное.

## Решение проблем

### «salary_data.json not found»
Это нормально, если вы не настраивали сравнение зарплат. Процесс `/apply` пропускает этот шаг автоматически.

### Не работают CLI поиска вакансий
Убедитесь, что Bun установлен и вы запустили `bun install` в каждой папке CLI. Инструментам нужен доступ к сети, чтобы получать вакансии.

### Ошибки сборки LaTeX
- Резюме: используется `lualatex` (pdflatex на свежих MiKTeX часто падает с ошибками расширения шрифтов `fontawesome5`; lualatex собирает те же исходники без проблем)
- Сопроводительное письмо: используется `xelatex` (для своих шрифтов в `OpenFonts/fonts/`)
- Убедитесь, что в вашем дистрибутиве LaTeX есть пакет `moderncv`
- Кириллица пропадает или выводится квадратиками — в выбранном шрифте нет кириллических глифов; используйте шрифт с кириллицей (см. раздел про LaTeX выше)

### В сопроводительном письме не находятся шрифты
Шаблон письма ожидает шрифты в `cover_letters/OpenFonts/fonts/`. Убедитесь, что эта папка существует и в ней есть файлы шрифтов Lato и Raleway.

### Устаревший `.claude/settings.local.json` от старого клона
Общие разрешения Claude Code теперь лежат в `.claude/settings.json`: список `allow`, ограниченный точными командами, которые запускает процесс (каждый CLI портала по пути, скрипты `tools/`, `salary_lookup.py`, `pdftotext`), список `ask`, который всегда спрашивает перед правкой файлов с разрешениями или запуском `git push`, и список `deny`, который во всех режимах блокирует команды, похожие на выгрузку данных, и чтение файлов с учётными данными. Полная таблица — в `SECURITY.md`. Ранние версии репозитория коммитили более широкий `.claude/settings.local.json`, который заранее разрешал `Bash(curl:*)`, `Bash(python:*)` и `Bash(bun:*)`. Если вы клонировали до этого изменения, git оставляет старый файл в рабочей копии, и его разрешения по-прежнему действуют поверх `settings.json`. Удалите его (или сократите до своих личных настроек):

```bash
rm .claude/settings.local.json
```
