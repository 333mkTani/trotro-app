'use strict';
// Expo Push Notification service — sends via https://exp.host/--/api/v2/push/send
// No extra dependencies: uses Node 18+ built-in fetch.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a single push notification.
 * Silently skips if token is absent or not an Expo token.
 */
const send = async (token, { title, body, data = {} }) => {
  if (!token || !String(token).startsWith('ExponentPushToken')) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    });
    const json = await res.json();
    if (json?.data?.status === 'error') {
      console.error('[push] Expo error:', json.data.message);
    } else {
      console.log('[push] sent to', token.slice(0, 30) + '…');
    }
  } catch (err) {
    console.error('[push] send failed:', err.message);
  }
};

module.exports = { send };
