# Развёртывание и эксплуатация

## 1. Окружения

### Local

- frontend dev server;
- backend dev server;
- PostgreSQL в Docker;
- MinIO в Docker;
- mock Ranked API для тестов;
- реальный Ranked API только для ручной разработки.

### Staging

- production-подобные сборки;
- отдельная БД и bucket;
- тестовые администраторы;
- не индексируется поисковиками;
- используется для приёмки миграций и визуальных изменений.

### Production

- отдельная PostgreSQL;
- production object storage;
- HTTPS;
- ежедневные backups;
- централизованные логи и health checks.

## 2. Компоненты production

```text
Internet
  │
  ▼
Reverse proxy / CDN
  ├── /assets, Astro frontend
  └── /api/v1 → NestJS
                  ├── PostgreSQL
                  ├── S3-compatible storage
                  └── api.mcsrranked.com
```

Frontend и backend должны выглядеть для браузера как один origin.

## 3. Контейнеры

Обязательные Docker images:

- `mcsr-sabinsk-frontend`;
- `mcsr-sabinsk-backend`.

PostgreSQL и MinIO могут запускаться Docker Compose локально. Production managed-сервисы предпочтительнее контейнеров на одном сервере.

Images:

- multi-stage build;
- non-root user;
- только production dependencies;
- immutable tag по commit SHA;
- healthcheck.

## 4. Конфигурация

### Backend

Минимальные переменные:

```text
NODE_ENV
PORT
DATABASE_URL
PUBLIC_APP_URL
SESSION_SECRET
CSRF_SECRET
RANKED_API_BASE_URL
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_PUBLIC_BASE_URL
LOG_LEVEL
```

### Frontend

```text
PUBLIC_API_BASE_URL
PUBLIC_APP_NAME
```

Timezone процесса не используется как источник отображения. Приложение явно форматирует `Europe/Moscow`.

## 5. Миграции

Deployment order:

1. backup БД;
2. проверить migration status;
3. выполнить backward-compatible миграцию;
4. развернуть backend;
5. проверить health;
6. развернуть frontend;
7. выполнить smoke test.

Destructive migration требует отдельного плана и rehearsal на staging.

## 6. Seed администратора

Первый администратор создаётся одноразовой CLI-командой:

```text
admin:create --username <name>
```

Пароль передаётся интерактивно или через краткоживущий secret, но не аргументом командной строки и не сохраняется в shell history.

## 7. Health endpoints

### `GET /health/live`

Проверяет, что процесс отвечает.

### `GET /health/ready`

Проверяет:

- PostgreSQL;
- Prisma migration state;
- доступность настроек object storage.

Ranked API не блокирует readiness: публичный сайт должен работать при его недоступности.

## 8. Backup

### PostgreSQL

- ежедневный полный backup;
- retention минимум 30 дней;
- шифрование;
- ежемесячная проверка восстановления;
- перед миграциями — отдельный snapshot.

### Object storage

- versioning bucket;
- lifecycle для удалённых/заменённых обложек;
- backup либо replication согласно выбранному провайдеру.

RPO: 24 часа. Целевой RTO: 4 часа.

Локальная проверка процедуры:

```powershell
pnpm db:backup
pnpm db:restore:rehearsal -- backups/<имя-файла>.dump --confirm
```

Backup создаётся через `pg_dump` в custom format и получает SHA-256 checksum.
Rehearsal принимает только файл внутри `backups/`, восстанавливает его во
временную БД `mcsr_sabinsk_restore_rehearsal`, проверяет таблицу миграций Prisma
и всегда удаляет временную БД. Команда никогда не восстанавливает данные поверх
рабочей БД. Каталог `backups/` исключён из git.

## 9. Логи и мониторинг

Сигналы:

- backend readiness;
- HTTP 5xx;
- latency p95;
- заполнение диска/БД;
- ошибки Prisma;
- неуспешные импорты;
- Ranked 429/5xx;
- неуспешные входы;
- срок последнего успешного backup.

HTTP-лог backend имеет JSON-формат и содержит `requestId`, `method`, `path`,
`statusCode` и `durationMs`. Значение request ID возвращается клиенту заголовком
`X-Request-Id`, что позволяет связать пользовательскую ошибку с серверным логом.
Query string и тела запросов намеренно не логируются.

Alert:

- readiness недоступен 5 минут;
- 5xx > 5% за 10 минут;
- backup старше 36 часов;
- серия из 10+ неуспешных входов;
- повторяющиеся Ranked 429.

## 10. Ranked API rate limit

- Импорт вызывается только администратором.
- Preview имеет короткий server cache по `match_id`.
- Подтверждение использует payload preview, если token ещё действителен.
- Один public page view не вызывает Ranked API.
- При 429 администратору показывается время безопасного повтора.

## 11. Rollback

- Frontend откатывается на предыдущий image.
- Backend откатывается только если схема БД совместима.
- Необратимая миграция требует roll-forward fix.
- После rollback выполняются health и критический публичный smoke test.

## 12. Smoke checklist

- публичный список турниров;
- выбор дивизиона;
- лидерборд;
- окно участника;
- окно матча;
- опубликованная сетка;
- вход администратора;
- загрузка страницы редактирования;
- health endpoints.

## 13. Рекомендуемый начальный hosting

Документация не привязывает проект к конкретному провайдеру. Минимальная production-конфигурация:

- один небольшой контейнерный хост для frontend/backend;
- managed PostgreSQL;
- S3-compatible object storage;
- CDN/reverse proxy.

При росте первым независимо масштабируется backend. Отдельный worker/queue вводится только если импорт начнёт превышать HTTP timeout или появятся автоматические задачи.
