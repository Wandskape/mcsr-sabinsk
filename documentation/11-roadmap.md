# Поэтапный план разработки

## Принцип

Новый этап начинается после выполнения критериев готовности предыдущего. UI не подключается к временной структуре данных, если контракт уже можно определить.

## Этап 0. Утверждение документации

Работы:

- прочитать весь комплект;
- закрыть замечания;
- утвердить решения;
- зафиксировать первую версию документации.

Готово, когда:

- нет открытых продуктовых вопросов первой версии;
- формула и статусы утверждены;
- API и модель данных не противоречат друг другу.

## Этап 1. Scaffolding монорепозитория

Работы:

- workspace;
- Astro + React frontend;
- NestJS backend;
- shared package;
- Prisma + PostgreSQL;
- ESLint, Prettier, strict TypeScript;
- Docker Compose local;
- CI skeleton.

Готово, когда:

- все packages собираются;
- frontend вызывает backend health;
- миграция создаёт пустую БД;
- lint/typecheck/test/build проходят.

## Этап 2. Безопасность и админский каркас

Работы:

- AdminUser/AdminSession;
- Argon2id;
- login/logout/me;
- cookie, CSRF, rate limit;
- admin layout;
- bootstrap CLI;
- AuditLog foundation.

Готово, когда:

- закрытые endpoints недоступны без сессии;
- login E2E проходит;
- пароли и cookie соответствуют security spec.

## Этап 3. Турниры, дивизионы и медиа

Работы:

- Tournament/Division migrations;
- CRUD;
- status transitions;
- S3/MinIO;
- upload обложки;
- публичный каталог и selector.

Готово, когда:

- администратор публикует будущий турнир;
- публичная страница показывает название, даты, описание, обложку и только участвующие дивизионы;
- черновик публично недоступен.

## Этап 4. Участники

Работы:

- Participant/Registration;
- Ranked user adapter;
- single/bulk resolve;
- unique tournament participation;
- roster lock;
- админские формы.

Готово, когда:

- ник подтверждается UUID;
- один UUID нельзя добавить в два дивизиона;
- пакетный preview показывает ошибки до записи.

## Этап 5. Импорт квалификации

Работы:

- match adapter;
- runtime validation;
- preview;
- import versions;
- COMPLETED/DNF/MISSED;
- формула;
- timeline normalization;
- transaction;
- reimport и diff;
- correction completed.

Готово, когда:

- fixtures покрывают все статусы;
- повторный импорт атомарно меняет результаты;
- исторический raw payload хранится;
- публичный просмотр не вызывает Ranked API.

## Этап 6. Публичная квалификация

Работы:

- desktop layout;
- лидерборд;
- список матчей;
- окно участника;
- окно результата;
- mobile tabs/drawer;
- URL state;
- loading/error/empty states.

Готово, когда:

- визуальные тесты утверждены;
- референсные сценарии работают на desktop/mobile;
- keyboard и accessibility smoke tests проходят.

## Этап 7. Плей-офф

Статус: реализован в первой версии — backend-контракты, ручной редактор,
публикация и публичная адаптивная сетка.

Работы:

- schema bracket/seed/match;
- создание 4/8/16;
- ручной редактор;
- validation warnings;
- publish/unpublish;
- optional third place;
- публичная responsive сетка.

Готово, когда:

- администратор вручную заполняет весь турнир;
- исправляет ранний результат;
- публикует сетку;
- сетки всех размеров визуально корректны.

## Этап 8. Завершение и аудит

Статус: реализовано.

Работы:

- completed locks;
- correction workflow;
- audit UI;
- final checklists;
- historical lock behavior.

Готово, когда:

- обычная запись в completed отклоняется;
- correction требует reason/confirm;
- публичная история обновляется после коррекции;
- diff доступен в аудите.

## Этап 9. Hardening — реализован

Работы:

- полный E2E;
- performance;
- security tests;
- CSP;
- error observability;
- backup/restore rehearsal;
- dependency audit.

Готово, когда:

- CI gates зелёные;
- цели производительности выполнены;
- staging restore подтверждён;
- критических security findings нет.

Реализовано:

- Playwright smoke/E2E для публичного и административного сценариев;
- автоматический p95 performance budget публичного API;
- строгие security headers и CSP;
- request ID и структурированные HTTP/error logs;
- CI quality и E2E gates;
- безопасные backup и restore rehearsal;
- production dependency audit.

## Этап 10. Production release — следующий и последний этап MVP

Работы:

- production infrastructure;
- secrets;
- migrations;
- bootstrap admin;
- smoke;
- monitoring/alerts;
- runbook.

Готово, когда:

- production health стабилен;
- публичный сценарий и вход проверены;
- backup создан;
- rollback image доступен.

## После первой версии

Приоритеты рассматриваются отдельно:

1. Discord OAuth/бот;
2. расписание плей-офф;
3. автоматический посев;
4. live-матчи;
5. роли;
6. санкции и ручные корректировки очков;
7. мультиязычность.
