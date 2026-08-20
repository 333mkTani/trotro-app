# Authenticated staging E2E tests

Issue #32 adds a guarded Playwright API-level E2E suite at `backend/e2e/staging-authenticated.spec.mjs`. It runs against the deployed staging API and uses a seeded passenger account rather than registering a new test user during every run. The suite verifies passenger login, authenticated profile access, wallet access, booking collection access, seeded route lookup, ordered route stops, and rejection of a protected request without a token.

The suite is deliberately blocked unless all safety gates are satisfied:

| Variable | Required value or purpose |
|---|---|
| `E2E_STAGING_BASE_URL` | HTTPS staging API origin, without `/api`; production Render origin is rejected. |
| `E2E_ENV` | Must equal `staging`. |
| `E2E_CONFIRM` | Must equal `I_UNDERSTAND_STAGING_E2E`. |
| `E2E_PASSENGER_PHONE` | Seeded staging passenger phone, supplied through secret storage. |
| `E2E_PASSENGER_PASSWORD` | Seeded staging passenger password, supplied through secret storage. |
| `E2E_ROUTE_ID` | Optional seeded route UUID; defaults to the reference route. |
| `E2E_REPORT` | Optional sanitized Playwright JSON report path. |

Credentials are read only from environment variables and are never printed or committed. The test suite does not target production and does not create payments or destructive booking mutations by default.

## Run against staging

From the backend directory:

```bash
E2E_STAGING_BASE_URL=https://trotro-staging-api.onrender.com \
E2E_ENV=staging \
E2E_CONFIRM=I_UNDERSTAND_STAGING_E2E \
E2E_PASSENGER_PHONE=... \
E2E_PASSENGER_PASSWORD=... \
npm run test:e2e:staging
```

The seeded account must exist in the staging database and have the passenger role. The staging deployment must already have migrations applied, reference seed data loaded, and `/ready` returning healthy. If the route seed differs from the default, provide `E2E_ROUTE_ID` explicitly.

The suite uses Playwright’s API request context, so it does not require a browser binary for these authenticated API flows. Browser-level UI journeys can be added later when a deployable web client and stable staging UI fixtures are available. Attach the sanitized JSON report, deployment identifier, migration ledger evidence, and test timestamp to issue #32. Never attach the seeded password, bearer token, or raw secret environment file.

## CI guidance

Run the suite only in a staging CI job with protected secret variables and an explicit staging environment approval. Keep the job out of pull-request runs that do not have staging credentials. A failed readiness check, authentication failure, or unexpected 5xx should fail the job; a missing credential must fail before any network request is attempted.

## References

[1]: https://playwright.dev/docs/test-api-testing "Playwright API testing documentation"

[2]: https://playwright.dev/docs/test-configuration "Playwright test configuration documentation"
