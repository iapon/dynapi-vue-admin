# Закрытая админка на site flows DynapiCMS

Повторяй за мной: за один вечер соберём **закрытый каталог книг** — страницу входа, JSON-API и админку на Vue, — не написав ни строчки серверного кода. Всё работает на site flows DynapiCMS: сценарии (flows) вешаются на маршруты, маршруты публикуются, шаблоны и статика заливаются командами `flowctl`.

Что получится в конце:

- `/login` — страница входа: Liquid-шаблон + пресет-сценарий `login` (проверка пароля через bcrypt, сессия в куке);
- `/logout` — выход;
- `/api/books`, `/api/books/add`, `/api/books/delete` — JSON-API каталога, только для авторизованных;
- `/admin` — закрытая админка: Vue SPA, которой сервер при рендере подкладывает профиль читателя в `window.__BOOT__`;
- обложки книг из медиатеки проекта: тумбы в каталоге, пикер в форме и добавление по ссылке;
- типы контента `book` и `member`, десять сеяных книг и один читатель.

## Требования

- Проект на dynapi.ru (с включённым сайтом).
- API-ключ вида `dca_...`. Он живёт **только** в переменной окружения — в репозитории ключей нет:
  ```bash
  export DYNAPI_APIKEY="dca_ваш_ключ"
  ```
- `flowctl` — CLI binaries: <https://dynapi.ru/cms/agent-skill/>
- Node 20+ (пригодится на шаге 4 для сборки SPA).
- WSL или любая Linux-оболочка.

## Как идти по репозиторию

Каждый шаг статьи — ветка, в которой уже лежит всё предыдущее:

| Ветка | Что внутри |
|---|---|
| `step-2-auth` | пресет `login`, сценарии `/login` и `/logout`, шаблон страницы входа |
| `step-3-api` | + сценарии JSON-API (`books_list` / `books_add` / `books_delete`) и полная карта маршрутов `files/routes.json` |
| `step-4-spa` | + шаблон админки `templates/admin.liquid` и исходники Vue-приложения `spa/` |
| `step-5-accounts` | + аккаунты читателей до конца: регистрация с подтверждением email, сброс пароля по ссылке, поле роли и гейт «удалять может только библиотекарь» (статья №2 журнала) |
| `step-6-api` | + API со вкусом: фильтры `?status=`/`?q=`, сортировка `?sort=` по белому списку, пагинация по 5 книг с `?page=`, конверт `{items, total, pages}`, валидация POST с 400 по полям (статья №3 журнала) |
| `step-7-media` | + обложки: поле `cover` у книги, сценарии `/api/media` (список + добавление по ссылке), пикер в форме и тумбы в каталоге (статья №4 журнала) |
| `step-8-locale` | + два языка: локаль проекта ru по умолчанию, локализованное `description` у книги, `books_list` с `description_locales`, `books_add` с картой `{ru,en}`, переключатель RU/EN в каталоге (статья №5 журнала) |
| `step-9-external` | + внешние сервисы: секреты `printshop_key`/`printshop_signing`, исходящий `http_post` из `books_add` (заказ в типографию), входящий подписанный вебхук `/api/printshop/webhook` с гейтом `digest_matches`, пометка печати в каталоге (статья №6 журнала) |
| `main` | + сиды данных `seed/`, сценарий страницы админки `flows/admin_page.dynflow.json`, этот README |

Переключайтесь по мере прохождения:

```bash
git checkout step-2-auth   # шаг 2
git checkout step-3-api    # шаг 3
git checkout step-4-spa    # шаги 4–5 (шаблон и статика)
git checkout step-5-accounts # статья №2: регистрация, сброс пароля, роли
git checkout step-6-api      # статья №3: фильтры, пагинация, ошибки, отладка
git checkout step-7-media    # статья №4: обложки и медиатека
git checkout step-8-locale   # статья №5: два языка из одной записи
git checkout step-9-external # статья №6: заказ в типографию и подписанный вебхук
git checkout main          # шаги 5–6 до конца
```

## Шаг 1. Типы контента

В админке (`<поддомен>.dynapi.ru/cms` → Сущности) создайте два типа. Через UI это пара минут.

**`book`** — книга:

| Поле | Тип | Прочее |
|---|---|---|
| `title` | string | required |
| `author` | string | required |
| `year` | int | |
| `status` | select | options: `in_stock` «В наличии», `on_loan` «На руках»; по умолчанию `in_stock` |

**`member`** — читатель:

| Поле | Тип | Прочее |
|---|---|---|
| `email` | string | required |
| `password` | bcrypt | значение хешируется автоматически при записи |
| `verified` | boolean | |

## Шаг 2. Вход и выход

Пресет входа:

```bash
flowctl apply presets/login.dynflow.json --publish
```

Пресет создаёт хэндл `login` и маршрут `/login` POST: сценарий ищет member по email, сверяет пароль узлом `bcrypt_matches`, ставит сессию-куку `member` и редиректит.

> **Нюанс.** Узел `a_ok` в пресете по умолчанию редиректит на `/`. В демо он изменён на `/admin`, чтобы после входа попадать сразу в каталог. Увидеть и поправить это можно в редакторе сценариев: откройте хэндл `login`, выберите узел `a_ok` и поменяйте `location` — либо через Экспорт/Импорт.

Страница входа:

```bash
flowctl apply flows/login_page.dynflow.json --publish
```

GET `/login` рендерит `templates/login.liquid`, но сам шаблон мы зальём на шаге 4 — до этого страница скажет «шаблон не найден». Это нормально, идём дальше.

Выход:

```bash
flowctl apply flows/logout.dynflow.json --publish
```

GET `/logout` стирает куку `member` и возвращает на страницу входа.

## Шаг 3. JSON-API

Три сценария — список, добавление, удаление:

```bash
flowctl apply flows/books_list.dynflow.json --publish
flowctl apply flows/books_add.dynflow.json --publish
flowctl apply flows/books_delete.dynflow.json --publish
```

Все три маршрута должны быть `membersOnly` — неавторизованного такой маршрут отправляет на страницу входа. Права живут не в сценарии, а в карте маршрутов. Вот она целиком, файл `files/routes.json`:

```json
[
  { "path": "/login", "methods": ["GET", "POST"], "cache": { "defaultTtl": 0 },
    "flows": [ { "handle": "login_page", "methods": ["GET"] }, { "handle": "login", "methods": ["POST"] } ] },
  { "path": "/logout", "methods": ["GET"], "cache": { "defaultTtl": 0 },
    "flows": [ { "handle": "logout", "methods": ["GET"] } ] },
  { "path": "/admin", "methods": ["GET"], "cache": { "defaultTtl": 0 },
    "membersOnly": true, "loginPath": "/login",
    "flows": [ { "handle": "admin_page", "methods": ["GET"] } ] },
  { "path": "/api/books", "methods": ["GET"], "cache": { "defaultTtl": 0 },
    "membersOnly": true, "loginPath": "/login",
    "flows": [ { "handle": "books_list", "methods": ["GET"] } ] },
  { "path": "/api/books/add", "methods": ["POST"], "cache": { "defaultTtl": 0 },
    "membersOnly": true, "loginPath": "/login",
    "flows": [ { "handle": "books_add", "methods": ["POST"] } ] },
  { "path": "/api/books/delete", "methods": ["POST"], "cache": { "defaultTtl": 0 },
    "membersOnly": true, "loginPath": "/login",
    "flows": [ { "handle": "books_delete", "methods": ["POST"] } ] }
]
```

Примените полную карту одной командой — она перекрывает маршруты шагов 2–3:

```bash
flowctl route save files/routes.json --publish
```

После неё на сайте шесть маршрутов: `/login`, `/logout`, `/admin`, `/api/books`, `/api/books/add`, `/api/books/delete`; всё, кроме `/login` и `/logout`, — `membersOnly` с `loginPath: "/login"`.

## Шаг 4. Шаблоны и статика

Заливаем Liquid-шаблоны из каталога `templates/`:

```bash
flowctl files push templates --as template --publish
```

Собираем SPA:

```bash
cd spa && npm install && npm run build
```

Vite настроен так, что на выходе — стабильные имена `admin.js` и `admin.css`: именно их подключает `admin.liquid`. Заливаем статику:

```bash
flowctl files push spa/dist --as static --publish
```

## Шаг 5. Страница админки

```bash
flowctl apply flows/admin_page.dynflow.json --publish
```

GET `/admin`, `membersOnly`: graphql-узел берёт профиль читателя по `{{ member.id }}` (id приходит из сессии-куки), затем render-узел рендерит `admin.liquid`, подкладывая результат в `window.__BOOT__` — Vue-приложение стартует уже зная, кто вошёл, и отдельный whoami-запрос не нужен.

## Шаг 6. Данные

Сеем читателя и книги. Пароль `chitalka-2026` хешируется полем `bcrypt` автоматически — в сиде лежит plaintext:

```bash
flowctl entity create member seed/reader.json
flowctl entity create book seed/book1.json
flowctl entity create book seed/book2.json
flowctl entity create book seed/book3.json
flowctl entity create book seed/book4.json
flowctl entity create book seed/book5.json
flowctl entity create book seed/book6.json
flowctl entity create book seed/book7.json
flowctl entity create book seed/book8.json
flowctl entity create book seed/book9.json
flowctl entity create book seed/book10.json
```

## Шаг 7. Обложки и медиатека (статья №4)

Поле для обложки добавляется в редакторе типа `book`: поле `cover`, тип «Тип контента», цель `media`. Затем заливаем обложки из каталога `covers/` в медиатеку и применяем новые сценарии:

```bash
flowctl media push covers/cover-*.png
flowctl apply flows/media_list.dynflow.json --publish
flowctl apply flows/media_add.dynflow.json --publish
```

`media_list` отдаёт библиотеку (`GET /api/media`), `media_add` принимает ссылку `https://` и создаёт запись через `createMedia` (`POST /api/media`). Оба маршрута — `membersOnly`; они уже описаны в `files/routes.json`, поэтому перекрываем карту целиком:

```bash
flowctl route save files/routes.json --publish
```

Сценарии каталога тоже обновились — `books_list` выбирает `cover { id url }`, `books_add` принимает проверенный `cover`-id. Перепримените их:

```bash
flowctl apply flows/books_list.dynflow.json --publish
flowctl apply flows/books_add.dynflow.json --publish
```

Привяжите обложки к книгам: `flowctl entity update book <id книги> '{"cover": "<id записи в медиатеке>"}'`. Напоследок пересоберите и залейте SPA:

```bash
cd spa && npm run build && cd ..
flowctl files push spa/dist --as static --publish
```

## Шаг 8. Два языка из одной записи (статья №5)

Сначала языки проекта: в админке платформы «Настройки» → «Локализация» выставьте локаль `ru` по умолчанию (en остаётся в списке). Затем в редакторе типа `book` добавьте поле `description`, тип «Текст», с флажком «Локализованное поле» — схема перестроится, и у записи появятся табы ru/en.

Сценарии каталога этой ветки уже двуязычные: `books_list` выбирает `description description_locales` (скаляр локали по умолчанию плюс полная карта JSON-строкой), `books_add` принимает описание картой через переменную `$description: JSON`:

```bash
flowctl apply flows/books_list.dynflow.json --publish
flowctl apply flows/books_add.dynflow.json --publish
flowctl route save files/routes.json --publish
```

Заполните описания существующих книг картой:

```bash
flowctl entity update book <id книги> '{"description": {"ru": "…", "en": "…"}}'
```

Пересоберите и залейте SPA — в шапке появятся кнопки RU/EN:

```bash
cd spa && npm run build && cd ..
flowctl files push spa/dist --as static --publish
```

## Шаг 9. Заказ в типографию и подписанный вебхук (статья №6)

Два секрета в хранилище («Сайт» → «Секреты» или `flowctl secret set`): `printshop_key` — ключ, под которым каталог зовёт типографию, `printshop_signing` — общий секрет для подписи её вебхуков. Значения ваши; в документах сценариев они нигде не лежат — только ссылки `secret://имя`.

Сценарии ветки:

- `books_add` после создания книги вызывает `http_post` на `/api/printshop/orders` с заголовком `X-Printshop-Key: secret://printshop_key` и складывает ответ в `results.printshop` — номер заказа едет клиенту рядом с книгой;
- `printshop_orders` — приёмник заказов: пускает только запросы с верным ключом (`headers.X-Printshop-Key` = `secret://printshop_key`), отвечает `{"accepted": true, "order_id": "P-…"}`;
- `printshop_webhook` — входящий колбэк типографии: узел-условие с `digest_matches` проверяет `X-Printshop-Signature` как `hmac-sha256` от точного тела запроса с ключом `secret://printshop_signing`, на then — `updateBook` ставит книге `print: ready`, на else — 403.

В редакторе типа `book` добавьте select-поле `print` с вариантами `ordered` («В типографии») и `ready` («Готова к выдаче»).

```bash
flowctl apply flows/books_add.dynflow.json --publish
flowctl apply flows/printshop_orders.dynflow.json --publish
flowctl apply flows/printshop_webhook.dynflow.json --publish
flowctl route save files/routes.json --publish
```

Пересоберите SPA — у добавленных книг под статусом появится пометка печати, а после вебхука она позеленеет («Готова к выдаче»):

```bash
cd spa && npm run build && cd ..
flowctl files push spa/dist --as static --publish
```

Проверить вебхук руками можно тем же скриптом, что в статье: подпишите HMAC-SHA256 от точного тела запроса и отправьте POST на `/api/printshop/webhook` с заголовком `X-Printshop-Signature`. Подпись не сойдётся — сценарий ответит 403 и не тронет данные.

## Проверка

Откройте `https://<поддомен>.dynapi.ru/login` и войдите читателем:

- email: `reader@biblio.test`
- пароль: `chitalka-2026`

После входа вас перекинет в каталог на `/admin`: добавляйте и удаляйте книги, статусы «В наличии» / «На руках» — из сеяных данных, кнопки RU/EN в шапке переключают язык описаний. Разлогиниться — «Выйти» в шапке. Попытка открыть `/admin` или `/api/books` без сессии вернёт на страницу входа.

## Секреты

В репозитории ключей нет: `dca_`-ключ живёт в переменной окружения `DYNAPI_APIKEY` и нигде не коммитится. `.gitignore` исключает `node_modules/`, `dist/` и `.env`.

## Лицензия

MIT — см. [LICENSE](LICENSE).
