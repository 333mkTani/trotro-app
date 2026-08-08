const { z } = require('zod');

const DriverResponseSchema = z.object({
  reason: z.string().trim().min(2).max(300).optional(),
}).strict();

module.exports = { DriverResponseSchema };
