export const AUDIT_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCEEDED: "Вход выполнен",
  AUTH_LOGIN_FAILED: "Неудачная попытка входа",
  AUTH_LOGIN_LOCKED: "Вход временно заблокирован",
  AUTH_LOGIN_BLOCKED: "Отклонена попытка входа",
  AUTH_LOGOUT: "Выход выполнен",
  TOURNAMENT_CREATED: "Турнир создан",
  TOURNAMENT_UPDATED: "Турнир изменён",
  TOURNAMENT_STATUS_CHANGED: "Статус турнира изменён",
  TOURNAMENT_COVER_SET: "Обложка турнира установлена",
  TOURNAMENT_COVER_REMOVED: "Обложка турнира удалена",
  TOURNAMENT_DELETED: "Черновик турнира удалён",
  REGISTRATION_ADDED: "Участник добавлен",
  REGISTRATIONS_BULK_ADDED: "Добавлен список участников",
  REGISTRATION_MOVED: "Участник перемещён",
  REGISTRATION_REMOVED: "Участник удалён",
  QUALIFICATION_MATCH_IMPORTED: "Матч квалификации импортирован",
  QUALIFICATION_MATCH_REIMPORTED: "Матч квалификации импортирован повторно",
  COMPLETED_QUALIFICATION_CORRECTED: "Исправлена история квалификации",
  PLAYOFF_CREATED: "Сетка плей-офф создана",
  PLAYOFF_UPDATED: "Настройки сетки изменены",
  PLAYOFF_SEEDS_UPDATED: "Посев сетки изменён",
  PLAYOFF_MATCH_UPDATED: "Матч плей-офф изменён",
  PLAYOFF_PUBLISHED: "Сетка опубликована",
  PLAYOFF_UNPUBLISHED: "Сетка скрыта",
}

export function auditActionLabel(action: string) {
  return AUDIT_LABELS[action] ?? action
}

export function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(value))
}
