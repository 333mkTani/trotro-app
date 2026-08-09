export const getScheduleNotificationRoute = (data: Record<string, unknown>): string | null => {
  if (typeof data.type !== 'string' || !data.type.startsWith('schedule_')) return null;
  return typeof data.occurrenceId === 'string'
    ? `/future-requests?occurrenceId=${encodeURIComponent(data.occurrenceId)}`
    : '/future-requests';
};

type LastResponse = { notification: { request: { content: { data: Record<string, unknown> } } } };
type NotificationResponseApi = {
  getLastNotificationResponseAsync: () => Promise<LastResponse | null>;
  clearLastNotificationResponseAsync: () => Promise<void>;
};

export const processColdStartNotification = async (
  notifications: NotificationResponseApi,
  handleData: (data: Record<string, unknown>) => void,
) => {
  const response = await notifications.getLastNotificationResponseAsync();
  if (!response) return false;
  handleData(response.notification.request.content.data);
  await notifications.clearLastNotificationResponseAsync();
  return true;
};
