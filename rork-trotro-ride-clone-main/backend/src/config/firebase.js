'use strict';
// Firebase Admin SDK — initialised once from the service account JSON.
// Set FIREBASE_SERVICE_ACCOUNT env var to the raw JSON string, OR
// set FIREBASE_SERVICE_ACCOUNT_PATH to a file path.

let admin = null;

function getAdmin() {
  if (admin) return admin;

  try {
    admin = require('firebase-admin');

    if (admin.apps.length > 0) return admin; // already initialised

    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      credential = admin.credential.cert(serviceAccount);
    } else {
      console.warn('[firebase] No service account configured — push notifications disabled.');
      return null;
    }

    admin.initializeApp({ credential });
    console.log('[firebase] Admin SDK initialised');
    return admin;
  } catch (err) {
    console.error('[firebase] Init failed:', err.message);
    return null;
  }
}

module.exports = { getAdmin };
