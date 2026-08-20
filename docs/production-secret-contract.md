# Production secret contract

Issue #25 establishes a strict startup contract for production-like backend processes. When `NODE_ENV` is `production` or `staging`, the backend refuses to start if `JWT_SECRET` is missing, is a known development placeholder, or is shorter than 32 characters. It also requires `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, `MAPBOX_ACCESS_TOKEN`, and either `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_SERVICE_ACCOUNT_PATH`. The error contains requirement names only; it never prints secret values.

> Local development remains intentionally frictionless. The development JWT placeholder may still be used when `NODE_ENV=development`, but it must never be copied into a deployed environment.

| Secret/configuration | API | Schedule worker | Storage rule |
|---|---:|---:|---|
| `JWT_SECRET` | Required | Required for production-like startup contract | Use one generated value shared by all backend processes that verify or issue custom JWTs. |
| `DATABASE_URL` | Required | Required | Use the provider-managed connection reference; do not commit it. |
| `REDIS_URL` | Required when `REQUIRE_REDIS=true` | Required when `REQUIRE_REDIS=true` | Use the provider-managed Redis/Key Value reference. |
| `PAYSTACK_SECRET_KEY` | Required | Declared for a consistent process contract | Use Paystack test mode in staging and live mode only in production. |
| `MAPBOX_ACCESS_TOKEN` | Required | Declared for a consistent process contract | Keep server-side; never expose through an Expo public environment variable. |
| `FIREBASE_SERVICE_ACCOUNT` or path | Required | Required for notification/schedule behavior | Store service-account JSON or a protected mounted path in the deployment secret manager. |
| `CORS_ORIGIN` | Required operational configuration | Not used for worker requests | Use explicit passenger, driver, and admin origins; wildcard replacement is tracked separately in issue #26. |

## Render configuration

The production [`render.yaml`](../render.yaml) and staging [`render.staging.yaml`](../render.staging.yaml) declare the required provider secrets and worker variables. The API uses a generated JWT value in the production Blueprint. The worker must receive the same JWT value as the API rather than generating a different signing key. Enter synchronized values through the Render Dashboard or a shared environment group; never paste them into the repository.

The API should be redeployed after any secret rotation. Existing tokens signed with the previous JWT value will stop verifying after rotation, so coordinate rotation with client session expiry and communicate the forced re-authentication window. Paystack, Firebase, and Mapbox rotations should be tested in staging with `npm run verify:staging` before production changes.

## Safe checks

Configuration unit tests cover placeholder rejection, minimum JWT length, missing provider secrets, development-only defaults, and the fact that secret values are absent from thrown errors. The process-level test is:

```bash
NODE_ENV=production \
JWT_SECRET=... \
DATABASE_URL=... \
PAYSTACK_SECRET_KEY=... \
MAPBOX_ACCESS_TOKEN=... \
FIREBASE_SERVICE_ACCOUNT='...' \
node -e "require('./src/config/env'); console.log('production configuration accepted')"
```

Do not include real values in shell history or CI output. Prefer the deployment provider’s secret manager and a masked CI environment. If startup fails, fix the missing or invalid key in secret storage and redeploy; do not weaken the validator or restore the development placeholder.
