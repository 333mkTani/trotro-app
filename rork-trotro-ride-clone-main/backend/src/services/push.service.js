'use strict';
// Push notification service — sends via Firebase Cloud Messaging (FCM)
// using the Firebase Admin SDK.  Falls back to Expo Push API for tokens
// that still start with "ExponentPushToken" (transition period).

const { getAdmin } = require('../config/firebase');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to a single device token.
 * Accepts both raw FCM tokens and legacy ExponentPushToken[…] strings.
 */
const send = async (token, { title, body, data = {} }) => {
  if (!token) return;

  // Legacy Expo token — route through Expo relay
  if (String(token).startsWith('ExponentPushToken')) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'high' }),
      });
      const json = await res.json();
      if (json?.data?.status === 'error') console.error('[push/expo] error:', json.data.message);
      else console.log('[push/expo] sent to', token.slice(0, 32) + '…');
    } catch (err) {
      console.error('[push/expo] failed:', err.message);
    }
    return;
  }

  // Raw FCM token — send directly via Firebase Admin SDK
  const admin = getAdmin();
  if (!admin) {
    console.warn('[push/fcm] Firebase not configured, skipping notification');
    return;
  }

  try {
    const messageId = await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    console.log('[push/fcm] sent, messageId:', messageId);
  } catch (err) {
    // FCM error codes that mean the token is stale — safe to ignore
    const stale = ['messaging/registration-token-not-registered',
                   'messaging/invalid-registration-token'];
    if (stale.includes(err.code)) {
      console.warn('[push/fcm] stale token, skipping:', token.slice(0, 20));
    } else {
      console.error('[push/fcm] failed:', err.message);
    }
  }
};

module.exports = { send };
