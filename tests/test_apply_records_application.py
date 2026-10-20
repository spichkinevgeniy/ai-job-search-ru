"""Guards for /apply's tracker recording step (Step 6b).

The step is part of the /apply markdown spec (the spec IS the
implementation), so these tests pin the invariants that would break
silently. Assertions are scoped to the section they belong to, following
the pattern in test_upskill_skill.py: a whole-file `assertIn` for a word
as common as `drafted` passes on any unrelated mention and guards nothing.

The CSV header is the one rule most easily lost: it must stay
byte-identical to /outcome's, which is the entire reason for reusing it.
How each reader treats `drafted` is pinned per reader below, because the
right answer differs between them.
"""
import fnmatch
import re
import subprocess
import sys
import unittest
from pathlib import Path

try:
    import yaml  # noqa: F401 - only probing availability for the lint integration test
    _HAVE_YAML = True
except ImportError:
    _HAVE_YAML = False

REPO = Path(__file__).resolve().parent.parent
COMMANDS = REPO / ".claude" / "commands"
APPLY = COMMANDS / "apply.md"
OUTCOME = COMMANDS / "outcome.md"
GMAIL_SYNC = COMMANDS / "gmail-sync.md"
HTML_REPORT = COMMANDS / "html-report.md"
INTERVIEW = COMMANDS / "interview.md"
SKILL = REPO / ".claude" / "skills" / "job-application-assistant" / "SKILL.md"
SCRAPER = REPO / ".claude" / "skills" / "job-scraper" / "SKILL.md"
DOCS_README = REPO / "documents" / "README.md"

TRACKER_HEADER = (
    "date,company,sector,role,role_type,channel,status,contact_person,"
    "fit_rating,notes,cv_file,cover_letter_file,source,deadline"
)


def section(path, heading):
    """The body of one markdown section, up to the next heading of any depth."""
    text = path.read_text(encoding="utf-8")
    start = text.index(heading) + len(heading)
    rest = text[start:]
    end = re.search(r"^#{1,4} ", rest, re.MULTILINE)
    return rest[: end.start()] if end else rest


# После перевода на русский одно и то же правило в разных файлах иногда
# сформулировано чуть по-разному (в/из, маски/шаблоны) - такие проверки
# заданы регуляркой.
SUBFOLDER_RULE = re.compile(r"по правилу \*\*Subfolder naming\*\* (?:в|из) `documents/README\.md`")


def assert_has(case, needle, haystack, msg):
    if isinstance(needle, re.Pattern):
        case.assertRegex(haystack, needle, msg)
    else:
        case.assertIn(needle, haystack, msg)


class ApplyRecordsApplication(unittest.TestCase):
    """/apply Step 6b writes the row that six other commands read."""

    def setUp(self):
        self.step_6b = section(APPLY, "### Шаг 6b: Запись отклика")

    def test_step_writes_a_drafted_row_with_both_document_paths(self):
        for fragment in (
            "| `status` | `drafted` |",
            "| `cv_file`, `cover_letter_file` | два пути из раздела «Созданные файлы»",
        ):
            self.assertIn(
                fragment,
                self.step_6b,
                f"Step 6b's column table lost {fragment!r} - the row it writes would "
                "no longer identify itself as a draft or point at the documents",
            )

    def test_tracker_header_matches_outcome(self):
        """Byte-identical, or the two commands create incompatible CSVs.

        The exact-equality loop below is load-bearing, not decoration. `assertIn`
        on its own cannot see an *additive* drift: a 13-column header is a
        substring of a 14-column one, so appending a column to `/apply` and
        forgetting `/outcome` passed this test cleanly until the loop was added.

        It is also what makes the constant-only assertions in this class mean
        anything: they reason about TRACKER_HEADER, and this is the test that
        anchors TRACKER_HEADER to what both spec files actually say.
        """
        self.assertIn(TRACKER_HEADER, OUTCOME.read_text(encoding="utf-8"))
        self.assertIn(
            TRACKER_HEADER,
            self.step_6b,
            "Step 6b's header drifted from outcome.md's - whichever command ran "
            "first would decide the schema",
        )
        for name, text in (("outcome.md", OUTCOME.read_text(encoding="utf-8")),
                           ("apply.md Step 6b", self.step_6b)):
            header = next(
                (ln.strip() for ln in text.splitlines() if ln.strip().startswith("date,company,")),
                None,
            )
            self.assertEqual(
                header,
                TRACKER_HEADER,
                f"{name}'s header line is not exactly the canonical header - a column "
                "appended to one file and not the other leaves both containing the "
                "shorter header as a substring, which assertIn alone cannot catch",
            )

    def test_tracker_header_ends_with_deadline(self):
        """/apply appends rows with one field per header column, so inserting
        `deadline` anywhere but the end shifts every value in every existing
        row by one position."""
        self.assertTrue(
            TRACKER_HEADER.endswith(",deadline"),
            "deadline must be the last column - a mid-header insert shifts every "
            "existing row's values by one position",
        )

    def test_migration_appends_the_headers_own_last_column(self):
        """The migration sentence and the create path must name the same column.

        Derived, never copied - the same discipline `HtmlReportTrackerFieldTests`
        already applies to its `CANONICAL_HEADER`. A hardcoded `,deadline` here
        keeps passing after the column is renamed or a fifteenth is appended,
        because the assertion no longer has any connection to the header it is
        supposed to police. A tracker migrated by these commands and one they
        create from scratch would then hold different schemas, which is the exact
        divergence the shared-header rule exists to prevent.
        """
        last_column = TRACKER_HEADER.rsplit(",", 1)[1]
        outcome_step_1 = section(OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик")
        for name, text in (
            ("apply.md Step 6b", section(APPLY, "### Шаг 6b: Запись отклика")),
            ("outcome.md Step 1", outcome_step_1),
        ):
            self.assertIn(
                f"допиши `,{last_column}` только в строку заголовка",
                text,
                f"{name}'s migration does not append the header's own last column "
                f"({last_column!r}) - a tracker migrated by this command would not "
                "match one this command creates from scratch",
            )

    def test_step_runs_before_the_optional_offer_that_ends_the_turn(self):
        """The optional application-form offer asks the user a question.

        Anything after it only runs if the user answers, so recording the
        application there would reproduce the bug this step fixes.
        """
        text = APPLY.read_text(encoding="utf-8")
        self.assertLess(
            text.index("### Шаг 6b: Запись отклика"),
            text.index("### Поля формы отклика"),
            "Step 6b moved after the optional-artifact offer, which ends the turn "
            "on a question - the tracker row would be skipped whenever the user "
            "never answers",
        )

    def test_matched_row_is_never_moved_backwards(self):
        self.assertIn(
            "никогда не двигай её назад",
            self.step_6b,
            "Step 6b lost the rule protecting a submitted row - re-running /apply "
            "to refresh a CV would reset a live interview back to drafted",
        )

    def test_redraft_marker_is_undated(self):
        """/outcome reads the latest dated note as the last activity."""
        self.assertIn(
            "маркер `redrafted` без даты",
            self.step_6b,
            "a dated redraft marker resets /outcome's days-quiet clock, hiding a "
            "genuinely quiet application from the follow-up offer",
        )

    def test_seen_jobs_is_left_alone(self):
        self.assertIn(
            "Не меняй `job_scraper/seen_jobs.json`",
            self.step_6b,
            "drafting is not applying, and that file has no honest value for either",
        )

    def test_skill_defers_to_apply_rather_than_restating(self):
        """/scrape Step 5 routes into the skill, bypassing /apply entirely."""
        step_3b = section(SKILL, "### Шаг 3b: Зафиксируй отклик")
        self.assertIn(
            "`/apply` Шаг 6b",
            step_3b,
            "the skill's recording step no longer points at the canonical rule, so "
            "the two copies can drift",
        )


class DraftedMeansDraftedToEveryReader(unittest.TestCase):
    """`drafted` is non-final, so readers that mean *submitted* must say so.

    Each of these defines its set by exclusion from the final statuses, so
    a new non-final value joins them all silently. The one exception is
    /gmail-sync, which must keep searching for drafted rows: the user
    submitting by hand and not running /outcome is the failure #269 is
    about, and an employer reply is how it gets caught.
    """

    CASES = [
        (HTML_REPORT, None, "`drafted` → **Drafted**",
         "a status with no bucket is dropped from every statistic"),
        (HTML_REPORT, "## Шаг 2: Сводная статистика",
         "исключаются из всей статистики ниже",
         "the headline count would include applications that were never sent"),
        (OUTCOME, "## Шаг 2b: Ветка напоминаний", "ни финальный, ни `drafted`",
         "it would chase an employer who received nothing"),
        (OUTCOME, "## Шаг 4: Обнови трекер",
         "перезапиши колонку `date` реальной датой отправки",
         "the drafting date would be reported as the application date"),
        (GMAIL_SYNC, None, "Строки `drafted` остаются в этом множестве",
         "excluding them discards the row that identifies a submitted-but-"
         "unrecorded application, which is the recovery #269 asks for"),
        (GMAIL_SYNC, "## Шаг 5", "`drafted` -> `applied`, иначе",
         "the acknowledgement is the one email that proves a hand-submitted "
         "application was sent; classified as noise, the recovery never fires"),
        (GMAIL_SYNC, "### Шаг 7a", "поставь также `date` равной дате письма",
         "the row would keep the drafting date after being proved submitted"),
        (GMAIL_SYNC, "## Шаг 9: Проверка на застой", "Строки `drafted` здесь пропускай",
         "an unsent draft reported as a forgotten application"),
        (SCRAPER, None, "не добавляй здесь вторую строку",
         "/scrape would duplicate the row Step 3b just wrote"),
        (APPLY, "### Шаг 6b: Запись отклика", "голым числом, 0–100",
         "/upskill divides by fit_rating, so `72/100` or a verdict word breaks it"),
        (APPLY, "### Шаг 6b: Запись отклика", "добавь новую строку",
         "re-applying after a rejection would overwrite the old application"),
    ]

    def test_every_reader_handles_drafted(self):
        for path, heading, needle, why in self.CASES:
            with self.subTest(file=path.name, rule=needle):
                haystack = section(path, heading) if heading else path.read_text(encoding="utf-8")
                assert_has(self, needle, haystack, why)

    @unittest.skipUnless(
        _HAVE_YAML,
        "PyYAML not installed (the CI Python-test job omits it; the lint job runs lint_skills.py directly)",
    )
    def test_lint_skills_passes(self):
        result = subprocess.run(
            [sys.executable, str(REPO / "tools" / "lint_skills.py")],
            cwd=REPO,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, f"lint_skills.py failed:\n{result.stdout}{result.stderr}")


class ApplyArchivesThePosting(unittest.TestCase):
    """Step 6b must also write the posting text it is holding to the archive."""

    CASES = [
        (APPLY, "## Шаг 0: Разбор ввода",
         "полный текст вакансии дословно",
         "by Step 6b the model may hold only a summary, so the archive gets a "
         "paraphrase - what /outcome Step 3.2 forbids"),
        (APPLY, "### Шаг 6b: Запись отклика",
         "`documents/applications/<company>_<role>/job_posting.md`",
         "the one moment /apply provably holds the posting is spent again, and "
         "a pasted posting has no recovery path at all"),
        (APPLY, "### Шаг 6b: Запись отклика",
         "никогда не свежая загрузка",
         "a model that no longer holds the text would re-fetch to comply, the "
         "dead-URL path this whole item exists to avoid"),
        (APPLY, "### Шаг 6b: Запись отклика",
         "`/outcome` на Шаге 1.4",
         "the derivation is no longer pinned to /outcome's, so a later edit to "
         "either can silently orphan the archive"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик",
         "4. Выведи имя папки архива",
         "apply.md item 7 defers its folder derivation to /outcome Step 1.4 by "
         "number; renumbering Step 1 leaves that citation dangling"),
        (APPLY, "### Шаг 6b: Запись отклика",
         "**Если файл уже есть, не трогай его**",
         "re-running /apply to refresh a CV would overwrite the posting that "
         "was actually applied against"),
        (APPLY, "### Шаг 6b: Запись отклика",
         "сохраняет более старую вакансию",
         "the leave-it rule would read as if the folder is always fresh, hiding "
         "that a re-application to the same role collides with the old archive"),
        (APPLY, "### Шаг 6b: Запись отклика",
         "был оставлен на месте, а не записан",
         "the skip discards the current posting silently, and /interview preps "
         "against the earlier application's posting"),
        (APPLY, "### Шаг 6b: Запись отклика",
         "никогда не восстанавливай его по памяти",
         "a model that reached Step 6b without the text could satisfy none of "
         "item 7's constraints, and would write a remembered posting instead"),
        (SKILL, "### Шаг 1: Исследуй вакансию и оцени соответствие",
         "полный текст вакансии дословно",
         "the /scrape path never runs /apply Step 0, so nothing stops it "
         "compressing the posting before Step 3b archives it"),
        (SKILL, "### Шаг 3b: Зафиксируй отклик",
         "тот же архив вакансии",
         "the /scrape path reaches Step 3b without running /apply, and its "
         "closed enumeration of Step 6b's rules would omit the archive write"),
        (OUTCOME, "## Шаг 3: Заархивируй материалы отклика",
         "если уже есть, не трогай",
         "/outcome would overwrite /apply's archived posting with a re-fetch, "
         "the dead-URL branch the /apply write exists to avoid"),
    ]

    def test_posting_is_archived_where_every_reader_looks(self):
        for path, heading, needle, why in self.CASES:
            with self.subTest(file=path.name, rule=needle):
                assert_has(self, needle, section(path, heading), why)


class DeadlineSurvivesEveryWrite(unittest.TestCase):
    """#319: the deadline is carried through the whole pipeline and never dropped.

    The header migration must be header-line-only (inserting it mid-column
    shifts every value of every existing row), and every path that rewrites
    a tracker row (/outcome Step 4, /gmail-sync Step 7a) must preserve
    fields it does not parse - the deadline is the first such field.
    """

    CASES = [
        (APPLY, "### Шаг 6b: Запись отклика", "допиши `,deadline` только в строку заголовка",
         "a mid-header insert shifts every existing row's values by one position"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик",
         "допиши `,deadline` только в строку заголовка",
         "the two commands must migrate identically, or whichever runs first sets the schema"),
        (APPLY, "## Шаг 0: Разбор ввода", "дедлайн отклика",
         "Step 6b's value is supposed to come from Step 0's extraction, so the extraction "
         "must be stated where the posting text is still held in full"),
        (APPLY, "### Шаг 6b: Запись отклика", "Никогда не угадывай его",
         "the deadline must stay empty when the posting states none - a guessed date is "
         "the urgency clock firing on a date nobody set"),
        (APPLY, "### Шаг 6b: Запись отклика", "не трогай существующий дедлайн",
         "absence is not a correction: a run that extracted no deadline must not blank "
         "the one /apply already wrote"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик", "Срочность по дедлайну",
         "a drafted row has nothing applied so the quiet clock must not run on it - the "
         "deadline is the only clock that applies, and it must not be omitted"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик", "по `drafted` напоминание всё равно никогда не пишется",
         "surfacing the deadline must not drag drafted rows into the follow-up offer"),
        (OUTCOME, "## Шаг 4: Обнови трекер", "сохраняй все остальные поля строки",
         "a status update that rewrites the row would blank the deadline column"),
        (GMAIL_SYNC, "### Шаг 7a: Запиши одобренные обновления", "сохраняй все остальные поля строки",
         "the sync path rewrites the row too - it must carry the same preservation rule"),
        (SKILL, "### Шаг 3b: Зафиксируй отклик", "`deadline` — срок подачи из текста вакансии",
         "the /scrape path reaches Step 3b without running /apply Step 0, so it must "
         "still be told what the field is and where it comes from"),
        # The two properties the migration has to hold. Both are stated in the
        # prose of either file and neither was pinned, so either could be edited
        # away with a green suite - turning an agreed header-line append into a
        # row rewrite, which is a different and far riskier change.
        (APPLY, "### Шаг 6b: Запись отклика", re.compile(r"ни одна строка данных не (?:трогается|меняется)"),
         "a migration that rewrites rows is a different and far riskier change than "
         "one that appends to the header line, and only the second was agreed"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик", re.compile(r"ни одна строка данных не (?:трогается|меняется)"),
         "same rule, stated in both files, because either command may be the one that "
         "meets a legacy tracker first"),
        (APPLY, "### Шаг 6b: Запись отклика", "читаются с пустым дедлайном",
         "rows written before the migration have no fourteenth field; if that is not "
         "stated, a reader may treat the short row as malformed and drop it"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик",
         "читаются с пустым дедлайном",
         "same rule, stated in both files"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик",
         "единственная правка существующего трекера",
         "Step 4 forbids restructuring the CSV, so without this the header append reads "
         "as a violation of the same command's own rule and an implementer has a "
         "documented reason to skip the migration"),
    ]

    def test_deadline_survives_every_write(self):
        for path, heading, needle, why in self.CASES:
            with self.subTest(file=path.name, rule=needle):
                haystack = section(path, heading) if heading else path.read_text(encoding="utf-8")
                assert_has(self, needle, haystack, why)


class FallbackGlobFindsOneRolesDocuments(unittest.TestCase):
    """The `cv_file` fallback must select one role's documents, not one company's.

    `/apply` names drafts `cv/main_<company>_<role><CV_EXT>`, so two roles
    at one company differ only in the role half. When the tracker row's
    `cv_file`/`cover_letter_file` columns are empty - a row written before
    #291, added by hand, or by /outcome's own outside-the-workflow path -
    both readers fall back to a glob. A company-prefix glob matches both
    roles and the first hit wins silently: /outcome copies it to
    `cv_draft.tex`, and its own "leave an existing archived file" rule then
    makes the wrong answer permanent (#443).

    The globs are extracted from the specs rather than restated here, so
    these tests pin what the specs actually say.
    """

    COMPANY = "Acme"
    ROLES = ("Data Scientist", "ML Engineer", "ML Engineer II")

    CASES = [
        (OUTCOME, "## Шаг 3: Заархивируй материалы отклика",
         SUBFOLDER_RULE,
         "the archive locator must derive the stem by the one documented rule, "
         "not invent a second derivation that drifts from it"),
        (OUTCOME, "## Шаг 3: Заархивируй материалы отклика",
         re.compile(r"Никогда не расширяй эти (?:маски|шаблоны) до одной компании"),
         "without the prohibition the next edit relaxes the glob when it finds "
         "no match, which is exactly the wrong-file-recorded-as-submitted case"),
        (INTERVIEW, "## Шаг 1: Загрузка контекста отклика",
         SUBFOLDER_RULE,
         "interview's fallback must resolve the same stem /apply wrote"),
        (INTERVIEW, "## Шаг 1: Загрузка контекста отклика",
         re.compile(r"Никогда не расширяй эти (?:маски|шаблоны) до одной компании"),
         "prep built from the sibling role's CV is a live-conversation failure"),
    ]

    def test_both_readers_glob_the_full_stem(self):
        for path, heading, needle, why in self.CASES:
            with self.subTest(file=path.name, rule=needle):
                assert_has(self, needle, section(path, heading), why)

    @staticmethod
    def globs(path, heading):
        """The two fallback globs exactly as the spec writes them."""
        body = section(path, heading)
        found = re.findall(r"`(cv/main_[^`]+|cover_letters/cover_[^`]+)`", body)
        return [g for g in found if "*" in g]

    def resolve(self, glob, role):
        """Substitute the spec's placeholders the way the reader would."""
        stem = ArchiveNameIsOnePathComponent.derive(self.COMPANY, role)
        company = ArchiveNameIsOnePathComponent.derive(self.COMPANY, "").rstrip("_")
        return glob.replace("<company>_<role>", stem).replace("<company>", company)

    def drafted_files(self, ext=".tex"):
        """Exactly what /apply Step 5 leaves in cv/ for two roles at one company."""
        return [
            "cv/main_%s%s" % (ArchiveNameIsOnePathComponent.derive(self.COMPANY, r), ext)
            for r in self.ROLES
        ]

    def test_the_cv_glob_selects_the_row_s_own_role(self):
        on_disk = self.drafted_files()
        for path, heading in ((OUTCOME, "## Шаг 3: Заархивируй материалы отклика"),
                              (INTERVIEW, "## Шаг 1: Загрузка контекста отклика")):
            cv_glob = next(g for g in self.globs(path, heading) if g.startswith("cv/"))
            for role, expected in zip(self.ROLES, on_disk):
                with self.subTest(file=path.name, role=role):
                    hits = fnmatch.filter(on_disk, self.resolve(cv_glob, role))
                    self.assertEqual(
                        hits, [expected],
                        "%s's fallback glob %r matched %r for role %r. A glob that "
                        "matches both roles hands /outcome whichever the filesystem "
                        "returns first, and it archives that as what was submitted."
                        % (path.name, cv_glob, hits, role),
                    )

    def test_the_glob_finds_a_non_tex_template(self):
        """`/add-template` makes `.typ` a real output; a hardcoded `.tex` misses it."""
        on_disk = self.drafted_files(ext=".typ")
        cv_glob = next(
            g for g in self.globs(OUTCOME, "## Шаг 3: Заархивируй материалы отклика")
            if g.startswith("cv/")
        )
        hits = fnmatch.filter(on_disk, self.resolve(cv_glob, self.ROLES[0]))
        self.assertEqual(
            hits, [on_disk[0]],
            "the fallback hardcodes an extension, so a template registered by "
            "/add-template is invisible to it and /outcome archives nothing",
        )


class ArchiveNameIsOnePathComponent(unittest.TestCase):
    """`<company>_<role>` must derive a single path component.

    `Novo Nordisk A/S` used to derive `novo_nordisk_a/s_<role>/`: every
    command that *derives* the path agrees and keeps working, while the
    two that *enumerate* `documents/applications/*/` (/setup Path A,
    /html-report's glob) silently skip the nested archive. The character
    rule lives in one place - documents/README.md's Subfolder naming
    block - and the derivation sites cite it rather than restating it
    (jakob1379/ai-job-search#22).
    """

    CASES = [
        (DOCS_README, "## applications/",
         "Все символы, кроме букв, цифр и подчёркивания, удаляются",
         "the character rule is stated nowhere else; without it the naming "
         "convention leaves `/` untouched and the archive nests"),
        (DOCS_README, "## applications/",
         "один компонент пути",
         "the sentence that says why the rule exists; without it the next "
         "edit simplifies the rule back to spaces-only"),
        (OUTCOME, "## Шаг 1: Загрузи состояние и найди отклик",
         SUBFOLDER_RULE,
         "Step 1.4 is the derivation every other writer cites; paraphrasing "
         "the rule here is how the two copies drifted apart originally"),
        (APPLY, "### Покрытие требований (оба документа)",
         "тому же, по которому `/outcome` на Шаге 1.4 называет папку архива",
         "CV and cover-letter filenames use the same unsanitised values; a "
         "`/` there sends the draft to a path lualatex never writes a PDF "
         "back to, and the Step 4 compile check fails on a phantom path"),
        (SKILL, "### Шаг 2: Адаптируй резюме",
         SUBFOLDER_RULE,
         "the /scrape path writes its documents before Step 3b consults /apply, "
         "so /apply's filename rule cannot protect it"),
        (GMAIL_SYNC, "## Шаг 2: Загрузи состояние",
         SUBFOLDER_RULE,
         "gmail-sync both locates and creates archives; its old spaces-only "
         "paraphrase would split state across two folders"),
        (INTERVIEW, "## Шаг 1: Загрузка контекста отклика",
         SUBFOLDER_RULE,
         "interview must read the same archive /apply and /outcome wrote"),
        (INTERVIEW, "### 6. Организационные моменты",
         "папке архива, полученной на Шаге 1",
         "interview must reuse its canonical read path when writing the prep pack"),
        (DOCS_README, "## applications/",
         "Если получилось пустое имя",
         "dropping untrusted punctuation can produce no component at all, which "
         "would write files directly under documents/applications"),
    ]

    def test_the_rule_has_one_home_and_every_deriver_cites_it(self):
        for path, heading, needle, why in self.CASES:
            with self.subTest(file=path.name, rule=needle):
                assert_has(self, needle, section(path, heading), why)

    @staticmethod
    def derive(company, role):
        """The Subfolder naming rule, executed exactly as documented:
        lowercase, underscores for spaces, drop every character that is
        not a letter/digit/underscore, collapse runs, trim the ends.
        (\\w is Unicode in Python 3, so Danish letters survive.)"""
        name = f"{company}_{role}".lower().replace(" ", "_")
        name = re.sub(r"[^\w]", "", name)
        name = re.sub(r"_+", "_", name).strip("_")
        return name or None

    DERIVATIONS = [
        ("Novo Nordisk A/S", "Data Scientist", "novo_nordisk_as_data_scientist"),
        ("Acme", "Data Scientist / ML Engineer", "acme_data_scientist_ml_engineer"),
        ("Ørsted A/S", "ML Engineer", "ørsted_as_ml_engineer"),
        # пример из documents/README.md и кириллица (\w в Python 3 - Unicode)
        ("Kaspersky Lab, JSC", "", "kaspersky_lab_jsc"),
        ("Яндекс", "Data Scientist", "яндекс_data_scientist"),
        # company/role reach the derivation from untrusted posting text
        # (apply.md Step 0), so `..` must not survive either
        ("../..", "Data Scientist", "data_scientist"),
        ("../..", "///", None),
    ]

    def test_documented_rule_yields_a_single_path_component(self):
        for company, role, expected in self.DERIVATIONS:
            with self.subTest(company=company, role=role):
                name = self.derive(company, role)
                self.assertEqual(name, expected)
                if name is None:
                    continue
                self.assertNotIn("/", name)
                self.assertNotIn("..", name)


if __name__ == "__main__":
    unittest.main()
