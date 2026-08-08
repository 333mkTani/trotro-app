const model = require('../models/busAlertOperations.model');
const observability = require('../utils/observability');
const { ApiError } = require('../utils/ApiError');

const traceAlert = async (id) => {
  const trace = await model.traceAlert(id);
  if (!trace) throw ApiError.notFound('Bus alert not found');
  return trace;
};

const getMetrics = () => observability.snapshot();
module.exports = { traceAlert, getMetrics };
