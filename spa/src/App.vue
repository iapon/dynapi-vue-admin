<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

interface Book {
  id: string;
  title: string;
  author: string;
  year: number | null;
  status: string;
  description?: string | null;
  // Поле `_locales` приезжает строкой: '{"ru":"…","en":"…"}'.
  description_locales?: string | null;
  cover?: { id: string; url: string } | null;
  // Состояние заказа в типографии: пусто — заказа нет, ordered/ready — едет.
  print?: string | null;
}

interface MediaItem {
  id: string;
  name: string;
  url: string;
}

interface Page {
  items: Book[];
  total: number;
  pages: number;
}

interface MemberSession {
  id: string;
  name?: string | null;
  role?: string | null;
}

// Выдача: активная запись журнала — книга у читателя до даты.
interface Loan {
  id: string;
  due_date: string;
  status: string;
  book?: { title: string } | null;
  member?: { email: string } | null;
}

// Читатель для селекта выдачи: id + подпись.
interface MemberLite {
  id: string;
  name?: string | null;
  email: string;
}

// Данные, которые сервер вложил в страницу при заходе (шаблон admin.liquid):
// member — сессия из куки, email — результат graphql-узла сценария.
const boot =
  (window as unknown as { __BOOT__?: { member?: MemberSession | null; email?: string | null } })
    .__BOOT__ ?? {};

// Язык контента и интерфейса: хранится в localStorage, по умолчанию русский.
type Lang = "ru" | "en";
const lang = ref<Lang>(localStorage.getItem("biblio-lang") === "en" ? "en" : "ru");
function setLang(l: Lang) {
  lang.value = l;
  localStorage.setItem("biblio-lang", l);
}

// Словарь интерфейса: тоггл в шапке переключает и подписи, и данные.
const dict = {
  ru: {
    kicker: "Библиотека",
    h1: "Каталог книг",
    staff: "сотрудник",
    roles: { reader: "Читатель", librarian: "Библиотекарь" } as Record<string, string>,
    logout: "Выйти",
    newBook: "Новая книга",
    phTitle: "Название",
    phAuthor: "Автор",
    phYear: "Год",
    noCover: "Без обложки",
    add: "Добавить",
    byUrlHint: "Нет файла в библиотеке?",
    byUrlName: "Имя в библиотеке",
    byUrlAdd: "В библиотеку",
    booksTotal: (n: number) => `Книг: ${n}`,
    search: "Название или автор",
    allStatuses: "Все статусы",
    inStock: "В наличии",
    onLoan: "На руках",
    byYear: "По году",
    byTitle: "По названию",
    byAuthor: "По автору",
    loading: "Загрузка…",
    empty: "Ничего не найдено — смягчите фильтры.",
    thTitle: "Название",
    thAuthor: "Автор",
    thYear: "Год",
    thStatus: "Статус",
    del: "Удалить",
    prev: "← Назад",
    next: "Вперёд →",
    pageOf: (p: number, total: number) => `Страница ${p} из ${total}`,
    status: (s: string) => (s === "on_loan" ? "На руках" : "В наличии"),
    print: (p: string) => (p === "ready" ? "Готова к выдаче" : "В типографии"),
    coverAlt: (title: string) => `Обложка: ${title}`,
    noCoverTitle: "Обложка не назначена",
    printAccepted: (id: string) => `Типография приняла заказ ${id}`,
    printSilent: "Книга добавлена, но типография не ответила — заказ не отправлен.",
    loadFailed: "Не удалось загрузить каталог.",
    addFailed: "Не удалось добавить книгу.",
    checkFields: "Проверьте заполнение полей.",
    delFailed: "Не удалось удалить книгу.",
    coverFailed: "Не удалось добавить обложку.",
    loansTotal: (n: number) => `Выдачи: ${n}`,
    loansEmpty: "Активных выдач нет.",
    thReader: "Читатель",
    thDue: "Вернуть до",
    giveBack: "Вернул",
    issue: "Выдать",
    issueOk: "Готово",
    issueCancel: "Отмена",
    pickReader: "Читатель…",
    issueFailed: "Не удалось оформить выдачу.",
    loanRef: "Книга или читатель не найдены.",
    returnFailed: "Не удалось принять возврат.",
    loansLoadFailed: "Не удалось загрузить выдачи.",
  },
  en: {
    kicker: "Library",
    h1: "Book catalog",
    staff: "staff member",
    roles: { reader: "Reader", librarian: "Librarian" } as Record<string, string>,
    logout: "Sign out",
    newBook: "New book",
    phTitle: "Title",
    phAuthor: "Author",
    phYear: "Year",
    noCover: "No cover",
    add: "Add",
    byUrlHint: "No file in the library?",
    byUrlName: "Name in the library",
    byUrlAdd: "Upload",
    booksTotal: (n: number) => `Books: ${n}`,
    search: "Title or author",
    allStatuses: "All statuses",
    inStock: "In stock",
    onLoan: "On loan",
    byYear: "By year",
    byTitle: "By title",
    byAuthor: "By author",
    loading: "Loading…",
    empty: "Nothing found — try broader filters.",
    thTitle: "Title",
    thAuthor: "Author",
    thYear: "Year",
    thStatus: "Status",
    del: "Delete",
    prev: "← Prev",
    next: "Next →",
    pageOf: (p: number, total: number) => `Page ${p} of ${total}`,
    status: (s: string) => (s === "on_loan" ? "On loan" : "In stock"),
    print: (p: string) => (p === "ready" ? "Ready for pickup" : "At the print shop"),
    coverAlt: (title: string) => `Cover: ${title}`,
    noCoverTitle: "No cover assigned",
    printAccepted: (id: string) => `The print shop accepted order ${id}`,
    printSilent: "The book was added, but the print shop did not respond — no order sent.",
    loadFailed: "Failed to load the catalog.",
    addFailed: "Failed to add the book.",
    checkFields: "Check the fields.",
    delFailed: "Failed to remove the book.",
    coverFailed: "Failed to add the cover.",
    loansTotal: (n: number) => `Loans: ${n}`,
    loansEmpty: "No active loans.",
    thReader: "Reader",
    thDue: "Due",
    giveBack: "Returned",
    issue: "Issue",
    issueOk: "Done",
    issueCancel: "Cancel",
    pickReader: "Reader…",
    issueFailed: "Failed to issue the book.",
    loanRef: "Book or reader not found.",
    returnFailed: "Failed to record the return.",
    loansLoadFailed: "Failed to load the loans.",
  },
};
const t = computed(() => dict[lang.value]);

const memberName = computed(() => boot.member?.name || boot.email || t.value.staff);
const memberRole = computed(() => t.value.roles[boot.member?.role ?? ""] ?? t.value.roles.reader);
// Права видны из сессии: кнопку удаления рисуем только библиотекарю.
const isLibrarian = computed(() => boot.member?.role === "librarian");

const books = ref<Book[]>([]);
const total = ref(0);
const pages = ref(1);
const page = ref(1);
const loading = ref(true);
const error = ref("");
const adding = ref(false);
const form = ref({ title: "", author: "", year: "", cover: "", descriptionRu: "", descriptionEn: "" });
const serverMessage = ref("");
const invalidField = ref("");
// Ответ внешнего сервиса на добавление книги: номер заказа типографии.
const printNotice = ref("");

// Медиатека проекта: то же хранилище, что и «Медиа» в админке платформы.
const covers = ref<MediaItem[]>([]);
const byUrl = ref({ url: "", name: "" });
const addingUrl = ref(false);

// Журнал выдач: активные записи и читатели для селекта. Выдача открывается
// из строки каталога: ищем книгу глазами, читателя выбираем из списка.
const loans = ref<Loan[]>([]);
const members = ref<MemberLite[]>([]);
const issuingFor = ref("");
const loanForm = ref({ member_id: "", due_date: "" });
const issuing = ref(false);
const returning = ref("");

async function loadLoans() {
  try {
    const res = await fetch("/api/loans", { headers: { Accept: "application/json" } });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      serverMessage.value = t.value.loansLoadFailed;
      return;
    }
    const data = await res.json();
    loans.value = data.loans ?? [];
  } catch {
    serverMessage.value = t.value.loansLoadFailed;
  }
}

async function loadMembers() {
  try {
    const res = await fetch("/api/members", { headers: { Accept: "application/json" } });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    members.value = data.members ?? [];
  } catch {
    /* селект читателей останется пустым */
  }
}

function openIssue(bookId: string) {
  issuingFor.value = bookId;
  loanForm.value = { member_id: "", due_date: "" };
  serverMessage.value = "";
  invalidField.value = "";
}

function memberLabel(m: MemberLite): string {
  return m.name ? `${m.name} · ${m.email}` : m.email;
}

async function issue(bookId: string) {
  issuing.value = true;
  serverMessage.value = "";
  invalidField.value = "";
  try {
    const res = await fetch("/api/loans/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        book_id: bookId,
        member_id: loanForm.value.member_id,
        due_date: loanForm.value.due_date,
      }),
    });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (res.status === 400 && data?.field) {
        invalidField.value = data.field;
        serverMessage.value = data.message ?? t.value.checkFields;
      } else if (data?.error === "REF_NOT_FOUND") {
        serverMessage.value = t.value.loanRef;
      } else {
        serverMessage.value = t.value.issueFailed;
      }
      return;
    }
    issuingFor.value = "";
    await loadLoans();
  } catch {
    serverMessage.value = t.value.issueFailed;
  } finally {
    issuing.value = false;
  }
}

async function giveBack(loanId: string) {
  returning.value = loanId;
  serverMessage.value = "";
  try {
    const res = await fetch("/api/loans/return", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ loan_id: loanId }),
    });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      serverMessage.value = t.value.returnFailed;
      return;
    }
    await loadLoans();
  } catch {
    serverMessage.value = t.value.returnFailed;
  } finally {
    returning.value = "";
  }
}

async function loadCovers() {
  try {
    const res = await fetch("/api/media", { headers: { Accept: "application/json" } });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    covers.value = data.items ?? [];
  } catch {
    /* библиотека не ответила — пикер просто останется пустым */
  }
}

// «cover-master…png» → «master i margarita»: имя файла в читабельный подпись.
function coverLabel(m: MediaItem): string {
  return m.name.replace(/\.[a-z0-9]+$/i, "").replace(/^cover[-_]/, "").replace(/[-_]+/g, " ");
}

async function addByUrl() {
  addingUrl.value = true;
  serverMessage.value = "";
  try {
    const res = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url: byUrl.value.url.trim(), name: byUrl.value.name.trim() }),
    });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      serverMessage.value = data?.message ?? t.value.coverFailed;
      return;
    }
    byUrl.value = { url: "", name: "" };
    await loadCovers();
    if (data?.media?.id) form.value.cover = data.media.id;
  } catch {
    serverMessage.value = t.value.coverFailed;
  } finally {
    addingUrl.value = false;
  }
}

// Параметры каталога — всё уезжает в строку запроса эндпоинта.
const query = ref({ q: "", status: "", sort: "" });
let searchTimer: ReturnType<typeof setTimeout> | undefined;

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams();
    if (query.value.q.trim()) params.set("q", query.value.q.trim());
    if (query.value.status) params.set("status", query.value.status);
    if (query.value.sort) params.set("sort", query.value.sort);
    if (page.value > 1) params.set("page", String(page.value));
    const qs = params.toString();
    const res = await fetch("/api/books" + (qs ? `?${qs}` : ""), {
      headers: { Accept: "application/json" },
    });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) throw new Error(`${res.status}`);
    const data: Page = await res.json();
    books.value = data.items;
    total.value = data.total;
    pages.value = Math.max(data.pages, 1);
    if (page.value > pages.value) {
      // Страница исчезла (например, удалили последнюю книгу на ней) — переходим.
      page.value = pages.value;
      return load();
    }
  } catch {
    error.value = t.value.loadFailed;
  } finally {
    loading.value = false;
  }
}

// Поиск отправляем с паузой: один запрос на остановку набора, а не на клавишу.
function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    load();
  }, 300);
}

function onFilter() {
  page.value = 1;
  load();
}

function goTo(p: number) {
  if (p < 1 || p > pages.value || p === page.value) return;
  page.value = p;
  load();
}

// Описание книги в выбранном языке: карта локалей с откатом на дефолтную.
// Пустая строка в карте считается «перевода нет» — берём скаляр.
function descOf(b: Book): string {
  let loc: Record<string, string> = {};
  try {
    loc = JSON.parse(b.description_locales || "{}");
  } catch {
    /* карта не распарсилась — остаёмся на скаляре */
  }
  return loc[lang.value] || b.description || "";
}

function fieldClass(name: string): string {
  return invalidField.value === name ? "invalid" : "";
}

async function add() {
  adding.value = true;
  serverMessage.value = "";
  printNotice.value = "";
  invalidField.value = "";
  try {
    const res = await fetch("/api/books/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        title: form.value.title,
        author: form.value.author,
        year: form.value.year ? Number(form.value.year) : null,
        cover: form.value.cover || null,
        description: {
          ru: form.value.descriptionRu.trim(),
          en: form.value.descriptionEn.trim(),
        },
      }),
    });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    // Контракт валидации живёт на сервере: пустые поля доходят до сценария
    // и возвращаются кодом 400 с именем поля и сообщением.
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (res.status === 400 && data?.field) {
        invalidField.value = data.field;
        serverMessage.value = data.message ?? t.value.checkFields;
      } else {
        serverMessage.value = t.value.addFailed;
      }
      return;
    }
    const data = await res.json().catch(() => null);
    form.value = { title: "", author: "", year: "", cover: "", descriptionRu: "", descriptionEn: "" };
    // Сценарий после создания книги вызвал внешний сервис: его ответ едет
    // рядом с книгой. Нет ответа — типография не приняла заказ, говорим честно.
    if (data?.printshop?.order_id) {
      printNotice.value = t.value.printAccepted(data.printshop.order_id);
    } else if (data?.printshop === null) {
      printNotice.value = t.value.printSilent;
    }
    page.value = 1;
    await load();
  } catch {
    serverMessage.value = t.value.addFailed;
  } finally {
    adding.value = false;
  }
}

async function remove(id: string) {
  serverMessage.value = "";
  try {
    const res = await fetch("/api/books/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.redirected || res.status === 302) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      serverMessage.value = data?.message ?? t.value.delFailed;
      return;
    }
    await load();
  } catch {
    serverMessage.value = t.value.delFailed;
  }
}

onMounted(() => {
  load();
  loadCovers();
  loadLoans();
  loadMembers();
});
</script>

<template>
  <div class="wrap">
    <header class="top">
      <div>
        <div class="kicker">{{ t.kicker }}</div>
        <h1>{{ t.h1 }}</h1>
      </div>
      <div>
        <span class="who">{{ memberName }} · {{ memberRole }}</span>
        <span class="lang">
          <button type="button" :class="{ on: lang === 'ru' }" @click="setLang('ru')">RU</button>
          <button type="button" :class="{ on: lang === 'en' }" @click="setLang('en')">EN</button>
        </span>
        <a class="logout" href="/logout">{{ t.logout }}</a>
      </div>
    </header>

    <p v-if="serverMessage" class="error">{{ serverMessage }}</p>
    <p v-if="printNotice" class="notice">{{ printNotice }}</p>

    <section class="panel">
      <h2>{{ t.newBook }}</h2>
      <form class="form" @submit.prevent="add">
        <input v-model="form.title" :class="fieldClass('title')" :placeholder="t.phTitle" />
        <input v-model="form.author" :class="fieldClass('author')" :placeholder="t.phAuthor" />
        <input v-model="form.year" :class="fieldClass('year')" :placeholder="t.phYear" inputmode="numeric" />
        <input
          v-model="form.descriptionRu"
          class="desc"
          :class="fieldClass('description')"
          placeholder="Описание (RU)"
        />
        <input
          v-model="form.descriptionEn"
          class="desc"
          :class="fieldClass('description')"
          placeholder="Description (EN)"
        />
        <select v-model="form.cover" class="sel cover-sel" :class="fieldClass('cover')">
          <option value="">{{ t.noCover }}</option>
          <option v-for="m in covers" :key="m.id" :value="m.id">{{ coverLabel(m) }}</option>
        </select>
        <button type="submit" :disabled="adding">{{ t.add }}</button>
      </form>
      <form class="by-url" @submit.prevent="addByUrl">
        <span class="muted">{{ t.byUrlHint }}</span>
        <input v-model="byUrl.url" placeholder="https://…" />
        <input v-model="byUrl.name" :placeholder="t.byUrlName" />
        <button type="submit" :disabled="addingUrl">{{ t.byUrlAdd }}</button>
      </form>
    </section>

    <section class="panel">
      <div class="bar">
        <h2>{{ t.booksTotal(total) }}</h2>
        <div class="filters">
          <input
            v-model="query.q"
            class="search"
            type="search"
            :placeholder="t.search"
            @input="onSearch"
          />
          <select v-model="query.status" class="sel" @change="onFilter">
            <option value="">{{ t.allStatuses }}</option>
            <option value="in_stock">{{ t.inStock }}</option>
            <option value="on_loan">{{ t.onLoan }}</option>
          </select>
          <select v-model="query.sort" class="sel" @change="onFilter">
            <option value="">{{ t.byYear }}</option>
            <option value="title">{{ t.byTitle }}</option>
            <option value="author">{{ t.byAuthor }}</option>
          </select>
        </div>
      </div>
      <p v-if="loading" class="muted">{{ t.loading }}</p>
      <p v-else-if="books.length === 0" class="muted">{{ t.empty }}</p>
      <table v-else class="books">
        <thead>
          <tr>
            <th></th>
            <th>{{ t.thTitle }}</th>
            <th>{{ t.thAuthor }}</th>
            <th class="num">{{ t.thYear }}</th>
            <th>{{ t.thStatus }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="b in books" :key="b.id">
            <tr>
              <td class="cover-cell">
                <img v-if="b.cover" class="cover-thumb" :src="b.cover.url" :alt="t.coverAlt(b.title)" />
                <span v-else class="cover-none" :title="t.noCoverTitle"></span>
              </td>
              <td class="title">
                {{ b.title }}
                <span v-if="descOf(b)" class="desc">{{ descOf(b) }}</span>
              </td>
              <td>{{ b.author }}</td>
              <td class="num">{{ b.year ?? "—" }}</td>
              <td>
                <span class="pill" :class="b.status === 'on_loan' ? 'loan' : 'stock'">
                  {{ t.status(b.status) }}
                </span>
                <!-- Печатный заказ — аннотация под статусом, а не вторая пилюля:
                     это состояние внешнего процесса, не книги. -->
                <span v-if="b.print" class="print-state" :class="{ ready: b.print === 'ready' }">
                  {{ t.print(b.print) }}
                </span>
              </td>
              <td class="num">
                <button v-if="isLibrarian" class="issue-link" @click="openIssue(b.id)">{{ t.issue }}</button>
                <button v-if="isLibrarian" class="del" @click="remove(b.id)">{{ t.del }}</button>
              </td>
            </tr>
            <tr v-if="issuingFor === b.id" class="issue-row">
              <td colspan="6">
                <form class="issue-form" @submit.prevent="issue(b.id)">
                  <select v-model="loanForm.member_id" class="sel" :class="fieldClass('member_id')">
                    <option value="">{{ t.pickReader }}</option>
                    <option v-for="m in members" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
                  </select>
                  <input v-model="loanForm.due_date" type="date" :class="fieldClass('due_date')" />
                  <button type="submit" :disabled="issuing">{{ t.issue }}</button>
                  <button type="button" class="cancel" @click="issuingFor = ''">{{ t.issueCancel }}</button>
                </form>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-if="pages > 1" class="pager">
        <button class="page" :disabled="page <= 1" @click="goTo(page - 1)">{{ t.prev }}</button>
        <span class="muted">{{ t.pageOf(page, pages) }}</span>
        <button class="page" :disabled="page >= pages" @click="goTo(page + 1)">{{ t.next }}</button>
      </div>
    </section>

    <section class="panel">
      <div class="bar">
        <h2>{{ t.loansTotal(loans.length) }}</h2>
      </div>
      <p v-if="loans.length === 0" class="muted">{{ t.loansEmpty }}</p>
      <table v-else class="books">
        <thead>
          <tr>
            <th>{{ t.thTitle }}</th>
            <th>{{ t.thReader }}</th>
            <th class="num">{{ t.thDue }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in loans" :key="l.id">
            <td class="title">{{ l.book?.title ?? "—" }}</td>
            <td>{{ l.member?.email ?? "—" }}</td>
            <td class="num">{{ l.due_date }}</td>
            <td class="num">
              <button v-if="isLibrarian" class="del" :disabled="returning === l.id" @click="giveBack(l.id)">
                {{ t.giveBack }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style>
* { box-sizing: border-box; }
:root, [data-theme="dynamica-light"] {
  --bg: #f4f5f8; --panel: #fff; --text: #1a2233; --muted: #66708a;
  --border: #e3e6ee; --border-strong: #ccd2e0; --primary: #5564f9;
  --pill-stock-bg: #e5f5ea; --pill-stock-fg: #1d7a3d;
  --pill-loan-bg: #fdf1dc; --pill-loan-fg: #96690f;
  --row-line: #f0f2f7; --danger: #b3261e; --invalid: #fdecec;
}
[data-theme="dynamica-dark"] {
  --bg: #0d1528; --panel: #16203a; --text: #e8ebf4; --muted: #97a2bf;
  --border: #273352; --border-strong: #38466e; --primary: #7c89ff;
  --pill-stock-bg: #163524; --pill-stock-fg: #67d98c;
  --pill-loan-bg: #3a2f14; --pill-loan-fg: #eec27a;
  --row-line: #1d2946; --danger: #ff8a80; --invalid: #3a1a1a;
}
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
.wrap { max-width: 760px; margin: 0 auto; padding: 32px 20px 60px; }
.top { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
.who { font-size: 13px; color: var(--muted); margin-right: 14px; }
.kicker { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--primary); }
h1 { margin: 2px 0 0; font-size: 26px; }
h2 { margin: 0; font-size: 14px; color: var(--muted); font-weight: 600; }
.logout { font-size: 13px; color: var(--primary); text-decoration: none; }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; }
.search { width: 200px; padding: 8px 10px; font-size: 13px; background: var(--panel); color: var(--text);
          border: 1px solid var(--border-strong); border-radius: 8px; }
.sel { padding: 8px 8px; font-size: 13px; background: var(--panel); color: var(--text);
       border: 1px solid var(--border-strong); border-radius: 8px; }
.form { display: flex; flex-wrap: wrap; gap: 8px; }
.form input, .form select { padding: 9px 10px; font-size: 14px; background: var(--panel); color: var(--text);
              border: 1px solid var(--border-strong); border-radius: 8px; }
.form input { flex: 1 1 170px; min-width: 0; }
.form input[placeholder="Год"], .form input[placeholder="Year"] { flex: 0 0 90px; }
.form input.desc { order: 3; flex: 1 1 45%; }
.form .cover-sel { order: 5; flex: 1 1 100%; }
.form button { order: 4; }
.form input.invalid, .form select.invalid { border-color: var(--danger); background: var(--invalid); }
.by-url { display: grid; grid-template-columns: auto 2fr 1.4fr auto; gap: 8px; align-items: center; margin-top: 10px;
          padding-top: 12px; border-top: 1px dashed var(--border); }
.by-url input { padding: 7px 10px; font-size: 13px; background: var(--panel); color: var(--text);
                border: 1px solid var(--border-strong); border-radius: 8px; }
.by-url button { padding: 7px 12px; font-size: 13px; font-weight: 600; color: var(--primary); background: transparent;
                 border: 1px solid var(--border-strong); border-radius: 8px; cursor: pointer; }
.form button, .del { padding: 9px 14px; font-size: 13px; font-weight: 600; color: #fff; background: var(--primary); border: 0; border-radius: 8px; cursor: pointer; }
.del { background: transparent; color: var(--danger); padding: 4px 8px; }
/* Выдача из строки каталога: тихая кнопка-ссылка и раскрытая строка. */
.issue-link { padding: 4px 8px; font-size: 13px; font-weight: 600; color: var(--primary); background: transparent; border: 0; cursor: pointer; }
.issue-row td { background: var(--row-line); border-bottom: 1px solid var(--row-line); }
.issue-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.issue-form select, .issue-form input { padding: 8px 10px; font-size: 13px; background: var(--panel); color: var(--text);
  border: 1px solid var(--border-strong); border-radius: 8px; }
.issue-form select { flex: 1 1 220px; min-width: 0; }
.issue-form button { padding: 8px 14px; font-size: 13px; font-weight: 600; color: #fff; background: var(--primary); border: 0; border-radius: 8px; cursor: pointer; }
.issue-form .cancel { color: var(--muted); background: transparent; border: 1px solid var(--border-strong); }
.issue-form select.invalid, .issue-form input.invalid { border-color: var(--danger); background: var(--invalid); }
.books { width: 100%; border-collapse: collapse; font-size: 14px; }
.cover-cell { width: 44px; padding-right: 0 !important; }
.cover-thumb { width: 36px; height: 52px; object-fit: cover; border-radius: 4px; display: block;
               border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.cover-none { width: 36px; height: 52px; border-radius: 4px; display: block;
              border: 1px dashed var(--border-strong); background: var(--row-line); }
.books th { text-align: left; font-size: 12px; color: var(--muted); padding: 8px 8px 8px 0; border-bottom: 1px solid var(--border); }
.books td { padding: 10px 8px 10px 0; border-bottom: 1px solid var(--row-line); }
.books tr:last-child td { border-bottom: 0; }
.num { text-align: right; }
.title { font-weight: 600; }
.title .desc { display: block; font-weight: 400; font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.45; }
.lang { display: inline-flex; margin-right: 14px; border: 1px solid var(--border-strong); border-radius: 8px; overflow: hidden; }
.lang button { padding: 4px 10px; font-size: 12px; font-weight: 600; color: var(--muted); background: transparent; border: 0; cursor: pointer; }
.lang button.on { color: #fff; background: var(--primary); }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.pill.stock { background: var(--pill-stock-bg); color: var(--pill-stock-fg); }
.pill.loan { background: var(--pill-loan-bg); color: var(--pill-loan-fg); }
/* Печатный заказ — текст-аннотация без коробки: состояние внешнего
   процесса читается как пометка, а не как второй статус. */
.print-state { display: block; margin-top: 4px; font-size: 11px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.print-state.ready { color: var(--pill-stock-fg); }
.notice { color: var(--primary); font-size: 14px; margin: -8px 0 12px; }
.pager { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.page { padding: 7px 12px; font-size: 13px; font-weight: 600; color: var(--primary); background: transparent;
        border: 1px solid var(--border-strong); border-radius: 8px; cursor: pointer; }
.page:disabled { color: var(--muted); border-color: var(--border); cursor: default; }
.muted { color: var(--muted); font-size: 14px; }
.error { color: var(--danger); font-size: 14px; }
</style>
