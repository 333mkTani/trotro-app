const model = require('../models/scheduleOperations.model');
const observability = require('../utils/observability');
const { ApiError } = require('../utils/ApiError');

const traceOccurrence = async (id) => {
  const trace = await model.traceOccurrence(id);
  if (!trace) throw ApiError.notFound('Scheduled occurrence not found');
  return trace;
};

const getMetrics = () => observability.snapshot();

module.exports = { traceOccurrence, getMetrics };
