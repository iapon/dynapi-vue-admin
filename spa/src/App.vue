<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

interface Book {
  id: string;
  title: string;
  author: string;
  year: number | null;
  status: string;
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

// Данные, которые сервер вложил в страницу при заходе (шаблон admin.liquid):
// member — сессия из куки, email — результат graphql-узла сценария.
const boot =
  (window as unknown as { __BOOT__?: { member?: MemberSession | null; email?: string | null } })
    .__BOOT__ ?? {};

const roleLabels: Record<string, string> = {
  reader: "Читатель",
  librarian: "Библиотекарь",
};

const memberName = computed(() => boot.member?.name || boot.email || "сотрудник");
const memberRole = computed(() => roleLabels[boot.member?.role ?? ""] ?? "Читатель");
// Права видны из сессии: кнопку удаления рисуем только библиотекарю.
const isLibrarian = computed(() => boot.member?.role === "librarian");

const books = ref<Book[]>([]);
const total = ref(0);
const pages = ref(1);
const page = ref(1);
const loading = ref(true);
const error = ref("");
const adding = ref(false);
const form = ref({ title: "", author: "", year: "" });
const serverMessage = ref("");
const invalidField = ref("");

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
    error.value = "Не удалось загрузить каталог.";
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

function fieldClass(name: string): string {
  return invalidField.value === name ? "invalid" : "";
}

async function add() {
  adding.value = true;
  serverMessage.value = "";
  invalidField.value = "";
  try {
    const res = await fetch("/api/books/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        title: form.value.title,
        author: form.value.author,
        year: form.value.year ? Number(form.value.year) : null,
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
        serverMessage.value = data.message ?? "Проверьте заполнение полей.";
      } else {
        serverMessage.value = "Не удалось добавить книгу.";
      }
      return;
    }
    form.value = { title: "", author: "", year: "" };
    page.value = 1;
    await load();
  } catch {
    serverMessage.value = "Не удалось добавить книгу.";
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
      serverMessage.value = data?.message ?? "Не удалось удалить книгу.";
      return;
    }
    await load();
  } catch {
    serverMessage.value = "Не удалось удалить книгу.";
  }
}

function statusLabel(status: string): string {
  return status === "on_loan" ? "На руках" : "В наличии";
}

onMounted(load);
</script>

<template>
  <div class="wrap">
    <header class="top">
      <div>
        <div class="kicker">Библиотека</div>
        <h1>Каталог книг</h1>
      </div>
      <div>
        <span class="who">{{ memberName }} · {{ memberRole }}</span>
        <a class="logout" href="/logout">Выйти</a>
      </div>
    </header>

    <p v-if="serverMessage" class="error">{{ serverMessage }}</p>

    <section class="panel">
      <h2>Новая книга</h2>
      <form class="form" @submit.prevent="add">
        <input v-model="form.title" :class="fieldClass('title')" placeholder="Название" />
        <input v-model="form.author" :class="fieldClass('author')" placeholder="Автор" />
        <input v-model="form.year" :class="fieldClass('year')" placeholder="Год" inputmode="numeric" />
        <button type="submit" :disabled="adding">Добавить</button>
      </form>
    </section>

    <section class="panel">
      <div class="bar">
        <h2>Книг: {{ total }}</h2>
        <div class="filters">
          <input
            v-model="query.q"
            class="search"
            type="search"
            placeholder="Название или автор"
            @input="onSearch"
          />
          <select v-model="query.status" class="sel" @change="onFilter">
            <option value="">Все статусы</option>
            <option value="in_stock">В наличии</option>
            <option value="on_loan">На руках</option>
          </select>
          <select v-model="query.sort" class="sel" @change="onFilter">
            <option value="">По году</option>
            <option value="title">По названию</option>
            <option value="author">По автору</option>
          </select>
        </div>
      </div>
      <p v-if="loading" class="muted">Загрузка…</p>
      <p v-else-if="books.length === 0" class="muted">Ничего не найдено — смягчите фильтры.</p>
      <table v-else class="books">
        <thead>
          <tr>
            <th>Название</th>
            <th>Автор</th>
            <th class="num">Год</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in books" :key="b.id">
            <td class="title">{{ b.title }}</td>
            <td>{{ b.author }}</td>
            <td class="num">{{ b.year ?? "—" }}</td>
            <td>
              <span class="pill" :class="b.status === 'on_loan' ? 'loan' : 'stock'">
                {{ statusLabel(b.status) }}
              </span>
            </td>
            <td class="num">
              <button v-if="isLibrarian" class="del" @click="remove(b.id)">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="pages > 1" class="pager">
        <button class="page" :disabled="page <= 1" @click="goTo(page - 1)">← Назад</button>
        <span class="muted">Страница {{ page }} из {{ pages }}</span>
        <button class="page" :disabled="page >= pages" @click="goTo(page + 1)">Вперёд →</button>
      </div>
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
.form { display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 8px; }
.form input { padding: 9px 10px; font-size: 14px; background: var(--panel); color: var(--text);
              border: 1px solid var(--border-strong); border-radius: 8px; }
.form input.invalid { border-color: var(--danger); background: var(--invalid); }
.form button, .del { padding: 9px 14px; font-size: 13px; font-weight: 600; color: #fff; background: var(--primary); border: 0; border-radius: 8px; cursor: pointer; }
.del { background: transparent; color: var(--danger); padding: 4px 8px; }
.books { width: 100%; border-collapse: collapse; font-size: 14px; }
.books th { text-align: left; font-size: 12px; color: var(--muted); padding: 8px 8px 8px 0; border-bottom: 1px solid var(--border); }
.books td { padding: 10px 8px 10px 0; border-bottom: 1px solid var(--row-line); }
.books tr:last-child td { border-bottom: 0; }
.num { text-align: right; }
.title { font-weight: 600; }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.pill.stock { background: var(--pill-stock-bg); color: var(--pill-stock-fg); }
.pill.loan { background: var(--pill-loan-bg); color: var(--pill-loan-fg); }
.pager { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.page { padding: 7px 12px; font-size: 13px; font-weight: 600; color: var(--primary); background: transparent;
        border: 1px solid var(--border-strong); border-radius: 8px; cursor: pointer; }
.page:disabled { color: var(--muted); border-color: var(--border); cursor: default; }
.muted { color: var(--muted); font-size: 14px; }
.error { color: var(--danger); font-size: 14px; }
</style>
