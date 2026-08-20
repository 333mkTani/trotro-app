# CORS origin policy

Issue #26 replaces the production wildcard with one shared explicit origin policy for Express HTTP requests and Socket.IO realtime connections. `CORS_ORIGIN` is a comma-separated list of exact browser origins, for example:

```text
https://passenger.example,https://driver.example,https://admin.example
```

The production and staging Render Blueprints store this value through `sync: false`; operators must enter the actual deployed web origins in Render configuration storage. The mobile Passenger and Driver apps are native clients and normally do not send a browser `Origin` header, so native requests remain valid without adding app bundle identifiers to the browser CORS list. If mobile web builds are deployed, add their exact HTTPS origins to the same list.

| Request type | Behavior |
|---|---|
| Configured passenger origin | Allowed for HTTP and Socket.IO. |
| Configured driver origin | Allowed for HTTP and Socket.IO. |
| Configured admin origin | Allowed for HTTP and Socket.IO. |
| Unknown browser origin | No CORS permission is returned; the browser blocks the response. |
| No `Origin` header | Allowed for native clients, server-to-server calls, webhooks, and health checks. |
| `*` in production or staging | Rejected during backend startup. |

The HTTP and realtime transports use `src/config/cors.js`, which trims entries and performs exact string matching. It does not use substring matching, wildcard subdomains, or reflected request origins. Credentials remain enabled because the API supports authenticated browser requests; therefore wildcard origins are not acceptable in production.

## Deployment procedure

Set `CORS_ORIGIN` in the Render API service or shared environment group to the actual HTTPS origins before deploying. Do not include a trailing slash, path, or whitespace. If Cloudflare or another proxy fronts the admin site, configure the browser-visible origin rather than the proxy’s internal hostname. The schedule worker does not need a browser origin but receives the production configuration group for consistent startup validation.

After deployment, verify each configured origin with an authenticated browser request and verify an unconfigured origin is rejected by checking that the response lacks `Access-Control-Allow-Origin`. Repeat the same checks for the Socket.IO handshake at `/socket.io`. The CORS unit tests cover parsing, exact allow-list matching, native requests without an origin, wildcard semantics in development, and production wildcard rejection.

Issue #26 does not change CSRF protections for cookie-based sessions because the current mobile/API authentication model uses bearer tokens. If browser cookie authentication is introduced later, add CSRF protection before enabling it.
