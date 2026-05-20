const crypto = require('crypto');

/**
 * Generate a short alphanumeric boarding code (no ambiguous chars).
 * @param {number} length
 */
const generateBoardingCode = (length = 6) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
};

/**
 * Build the QR payload string for a booking.
 * @param {{ bookingId: string, code: string, validUntil: string }} input
 */
const buildQrPayload = ({ bookingId, code, validUntil }) => {
  return JSON.stringify({ v: 1, b: bookingId, c: code, exp: validUntil });
};

module.exports = { generateBoardingCode, buildQrPayload };
