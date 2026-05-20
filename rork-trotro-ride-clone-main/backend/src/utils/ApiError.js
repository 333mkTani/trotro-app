class ApiError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} message
   * @param {any} [details]
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(msg = 'Bad Request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Unauthorized') { return new ApiError(401, msg); }
  static forbidden(msg = 'Forbidden') { return new ApiError(403, msg); }
  static notFound(msg = 'Not Found') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict') { return new ApiError(409, msg); }
  static internal(msg = 'Internal Server Error') { return new ApiError(500, msg); }
}

module.exports = { ApiError };
