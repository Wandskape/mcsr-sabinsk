# MCSR Сабинск

Веб-приложение для квалификаций и плей-офф турниров MCSR Сабинск. Проект
развивается по спецификациям из каталога [`documentation`](documentation/).

## Структура

```text
apps/
  frontend/   Astro + React
  backend/    NestJS + Prisma
packages/
  shared/     общие TypeScript-контракты и перечисления
documentation/
compose.yaml  PostgreSQL и MinIO для локальной разработки
```

## Требования

- Node.js 22.12 или новее (рекомендуется Node.js 24 LTS);
- Corepack и pnpm 11;
- Docker Desktop с командой `docker-compose`;
- свободные порты `3000`, `4321`, `5432`, `9000`, `9001`.

## Первый запуск

В терминале WebStorm из корня проекта:

```powershell
corepack enable
pnpm install
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
docker-compose up -d postgres minio
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Первого администратора безопаснее создать отдельной командой. Укажите в
`apps/backend/.env` уникальный логин и пароль длиной не менее 12 символов:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=придумайте-длинный-пароль
```

Затем выполните:

```powershell
pnpm admin:bootstrap
```

Команда не перезаписывает пароль существующего администратора. После запуска
приложений вход доступен по адресу <http://localhost:4321/admin/login>.

По умолчанию seed не добавляет демонстрационный турнир и не создаёт
администратора с шаблонным паролем. Для локального демо измените в
`apps/backend/.env`:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=придумайте-длинный-пароль
SEED_DEMO=true
```

После изменения снова выполните:

```powershell
pnpm db:seed
```

## Запуск

### Оба приложения одной командой

```powershell
pnpm dev
```

### В отдельных терминалах WebStorm

Backend:

```powershell
pnpm dev:backend
```

Frontend:

```powershell
pnpm dev:frontend
```

Адреса после запуска:

- frontend: <http://localhost:4321>;
- backend: <http://localhost:3000/api/v1>;
- Swagger: <http://localhost:3000/api/docs>;
- MinIO Console: <http://localhost:9001>.
- админ-панель: <http://localhost:4321/admin>.

## База данных

```powershell
# запустить PostgreSQL и MinIO
docker-compose up -d postgres minio

# остановить, сохранив данные
docker-compose down

# создать новую миграцию после изменения schema.prisma
pnpm db:migrate

# открыть Prisma Studio
pnpm db:studio
```

Данные PostgreSQL и MinIO находятся в именованных Docker volumes и не
удаляются командой `docker-compose down`.

## Проверки

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Текущее состояние реализации

Готов первый рабочий вертикальный срез:

- pnpm-монорепозиторий и CI;
- PostgreSQL и MinIO для локальной разработки;
- полная базовая Prisma-модель турниров, квалификации и плей-офф;
- health endpoints и публичный API турниров/лидерборда/матчей;
- русская публичная страница с переключением турниров и дивизионов;
- панели участника и завершённого матча на сохранённых данных;
- защищённая админская авторизация с Argon2id, серверными сессиями, CSRF,
  ограничением попыток входа и журналом действий;
- русские страницы входа и обзора админ-панели.

Следующий этап по [`documentation/11-roadmap.md`](documentation/11-roadmap.md) —
CRUD турниров и управление их тремя дивизионами.
