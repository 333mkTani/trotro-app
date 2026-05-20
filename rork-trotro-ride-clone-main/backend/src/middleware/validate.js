/**
 * Validate `req` parts (body/query/params) against zod schemas.
 * Replaces the validated values on the request so controllers see typed input.
 *
 * Usage:
 *   router.post('/x', validate({ body: SomeSchema }), handler);
 *
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { validate };
