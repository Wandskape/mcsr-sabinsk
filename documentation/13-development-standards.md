# Стандарты разработки

## 1. Базовые требования

- TypeScript strict mode во всех packages.
- Node.js active LTS.
- `pnpm` через Corepack.
- Один lockfile в корне.
- Форматирование выполняется Prettier.
- Статический анализ выполняется ESLint.
- Код не принимается при ошибках typecheck, lint, test или build.

## 2. Именование

### Код

- TypeScript-файлы: `kebab-case.ts`.
- React-компоненты: `PascalCase`.
- Функции/переменные: `camelCase`.
- Константы: `UPPER_SNAKE_CASE`, если это настоящая глобальная константа.
- DTO: суффиксы `Request`, `Response`, `Dto` согласно слою.
- Prisma models: singular `PascalCase`.

### API и БД

- REST paths: plural kebab-case.
- JSON fields: camelCase.
- Database columns Prisma: camelCase в модели, согласованный mapping при snake_case в PostgreSQL.
- Enum values: `UPPER_SNAKE_CASE`.

## 3. Границы модулей

- Один NestJS-модуль не обращается к Prisma-моделям другого домена напрямую через произвольные запросы.
- Межмодульное взаимодействие идёт через экспортированный application service.
- Controller не содержит бизнес-правил.
- Prisma repository не рассчитывает очки.
- Формула очков и нормализация timeline являются чистыми domain-функциями.
- React-компоненты не импортируют backend-код.
- `packages/shared` не содержит секретов, database entities или framework-specific decorators.

## 4. Backend layering

Внутри модуля:

```text
controller → application service → domain functions → repository/adapter
```

- Controller: HTTP, auth, DTO, status codes.
- Application service: use case и транзакция.
- Domain: правила и вычисления.
- Repository: PostgreSQL.
- Adapter: Ranked API, S3 и другие внешние системы.

Исключения документируются в коде и ADR/`12-decisions.md`.

## 5. Frontend layering

```text
page/layout
  → feature container
    → query/mutation hooks
      → API client
    → presentational components
```

- API-вызовы не размещаются непосредственно в визуальных компонентах.
- Компонент не знает DTO Prisma.
- Серверные ошибки преобразуются в русские пользовательские сообщения централизованно.
- URL является источником истины для выбранного турнира, дивизиона и режима.

### Стили frontend

- `global.css` содержит только шрифты, design tokens, reset и действительно глобальные правила.
- Стили публичной страницы и админ-панели подключаются только из соответствующего layout.
- Крупные функциональные области хранятся в отдельных CSS-файлах.
- Новые стили компонента размещаются рядом с его feature-файлом либо в CSS Module.
- Порядок импортов считается частью каскада и изменяется только после визуальной проверки.

## 6. Контракты

- NestJS генерирует OpenAPI.
- `packages/shared` содержит согласованные enums и схемы запросов там, где это не создаёт связанность.
- Frontend не полагается на незадокументированные поля.
- Поле удаляется только через deprecation и версионирование API.

## 7. Ошибки

- Не использовать `throw new Error` как публичный контракт.
- Каждая ожидаемая доменная ошибка имеет стабильный code.
- Не показывать stack trace пользователю.
- В логах ошибка содержит request ID и безопасный контекст.
- Catch без обработки или повторного выброса запрещён.

## 8. Транзакции

Транзакция обязательна для:

- применения импорта;
- повторного импорта;
- пересчёта регистраций;
- перехода статуса с побочными изменениями;
- изменения опубликованной сетки;
- записи основного audit event.

Внешний HTTP-вызов Ranked API выполняется до транзакции. Транзакция не удерживается во время сети.

## 9. Время и числа

- В БД и API даты UTC.
- Форматирование `Europe/Moscow` только на границе UI.
- Длительности — integer milliseconds.
- Никаких floating-point значений для очков.
- Среднее хранится как integer milliseconds с явно определённым округлением до ближайшего целого после деления.
- Ranked match ID не преобразуется в JavaScript `number`.

## 10. Миграции

- Схема Prisma изменяется вместе с миграцией.
- Миграция проверяется на пустой и заполненной тестовой БД.
- Ручное изменение production schema запрещено.
- Backfill идёт отдельным idempotent script/command.
- Destructive migration не объединяется с функциональным изменением без плана rollout.

## 11. Коммиты и pull request

- Один PR решает одну связанную задачу.
- Generated files не редактируются вручную.
- PR содержит:
  - цель;
  - затронутые правила;
  - миграции;
  - тесты;
  - скриншоты для UI;
  - изменение документации.
- Коммит не содержит `.env`, credentials, dumps или raw production payload.

## 12. Definition of Done

Задача завершена, когда:

- выполнены acceptance criteria;
- код отформатирован и типизирован;
- добавлены unit/integration tests;
- API/DB/UI docs обновлены;
- миграция обратимо разворачивается либо имеет rollout plan;
- пользовательские ошибки на русском;
- аудит добавлен для административной мутации;
- нет новых критических accessibility/security проблем;
- staging или локальная production-сборка проверена.
