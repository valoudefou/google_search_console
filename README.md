# SEO Console API

Mini Search Console style API that you can stand up behind your own OAuth2 server and data warehouse. The OpenAPI document (`openapi.yaml`) captures the surface area so you can scaffold servers, SDKs, tests, and mocks.

## Highlights

- **OAuth2 bearer tokens** with the `search-console` scope secure every call.
- **Consistent error envelope** (`error.code`, `error.message`, `error.details`) across all endpoints.
- **4 feature areas** aligned with Search Console: sites, search analytics, URL inspection, and sitemaps.
- **Strict data models** that mirror the Google Search Console concepts so you can map directly to your own tables.
- **Site-agnostic fixtures** that rewrite the canned responses so you can test any property, not just the sample `https://example.com/` domain.

## Endpoints overview

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/sites` | List `SiteProperty` records the caller can access. |
| `POST` | `/sites/{siteId}/searchAnalytics:query` | Query aggregated metrics constrained by dates, dimensions, and filters. |
| `POST` | `/sites/{siteId}/urlInspection:index` | Return the latest crawl and index state for a URL. |
| `GET` | `/sites/{siteId}/sitemaps` | List sitemap submissions with processing stats. |

See `openapi.yaml` for the full schema definitions, field requirements, validation ranges (e.g., `rowLimit <= 25000`), and reusable error responses.

## Sample data

The sample fixture in the `fixtures/` directory returns canned analytics rows for the property `https://example.com/`. The server uses a regular expression to swap that base URL for whichever site you request so you can validate with any property while reusing the same JSON. If you stub `/sites/https://example.com/searchAnalytics:query` to read that file you will respond with:

```json
{
  "search_console_rows": [
    {
      "date": "2025-01-15",
      "page": "https://example.com/pricing",
      "query": "feature flag tool",
      "country": "GB",
      "device": "mobile",
      "impressions": 5400,
      "clicks": 110,
      "position": 3.2
    },
    {
      "date": "2025-01-15",
      "page": "https://example.com/docs/getting-started",
      "query": "ab testing setup",
      "country": "FR",
      "device": "desktop",
      "impressions": 820,
      "clicks": 9,
      "position": 11.4
    },
    {
      "date": "2025-01-15",
      "page": "https://example.com/enterprise",
      "query": "enterprise optimisation platform",
      "country": "DE",
      "device": "mobile",
      "impressions": 2600,
      "clicks": 55,
      "position": 6.7
    }
  ]
}
```

Use this to validate your client code without touching a real warehouse.

## Run locally

1. Install dependencies: `npm install`
2. Start the server: `npm start` (exposes `http://localhost:4000/v1`)

### Fetching fake data for any site

Because the `siteId` contains reserved URL characters, encode it when calling the API. Example request that returns the `search_console_rows` payload above:

```bash
curl -X POST \
  http://localhost:4000/v1/sites/https%3A%2F%2Fexample.com%2F/searchAnalytics:query \
  -H "Content-Type: application/json" \
  -d '{
        "startDate": "2025-01-01",
        "endDate": "2025-01-31",
        "dimensions": ["date","page","query"]
      }'
```

The response body mirrors the fixture:

```json
{
  "search_console_rows": [
    {
      "date": "2025-01-15",
      "page": "https://example.com/pricing",
      "query": "feature flag tool",
      "country": "GB",
      "device": "mobile",
      "impressions": 5400,
      "clicks": 110,
      "position": 3.2
    },
    {
      "date": "2025-01-15",
      "page": "https://example.com/docs/getting-started",
      "query": "ab testing setup",
      "country": "FR",
      "device": "desktop",
      "impressions": 820,
      "clicks": 9,
      "position": 11.4
    },
    {
      "date": "2025-01-15",
      "page": "https://example.com/enterprise",
      "query": "enterprise optimisation platform",
      "country": "DE",
      "device": "mobile",
      "impressions": 2600,
      "clicks": 55,
      "position": 6.7
    }
  ]
}
```

You can swap the encoded `siteId` for any other property (for example, `https%3A%2F%2Fexample.com%2F`). The server uses a regular expression to rewrite the fixture URLs before responding so you always get realistic looking data for the site you are testing.

## Wiring to your backend

1. **Auth**: issue OAuth2 access tokens scoped to the site IDs the user can access. Reject requests when scope/site mappings fail.
2. **Sites**: back `/sites` with your ownership table (e.g., `site_properties`). Return only the `id`, `displayName`, and `type`.
3. **Search analytics**:
   - Store daily aggregates keyed by `site_id`, `date`, and requested dimensions.
   - Validate requested dimensions/operators before building the query.
   - Apply `rowLimit`/`startRow` for pagination. Use your DB for sorting (e.g., impressions desc).
4. **URL inspection**: source data from crawl logs, rendered HTML snapshots, or indexer metadata. Populate `mobileIssues` and `richResultTypes` arrays from your analyzers.
5. **Sitemaps**: hydrate from submissions table and processing jobs. Include discovery vs. indexed counts.

## Example Express handler

```ts
app.post("/v1/sites/:siteId/searchAnalytics:query", authenticate, async (req, res, next) => {
  try {
    const siteId = req.params.siteId;
    const payload = validateSearchAnalyticsRequest(req.body); // schema validation
    await ensureUserHasAccess(req.user, siteId);
    const rows = await querySearchAnalytics(siteId, payload); // hit your warehouse
    res.json({ rows });
  } catch (err) {
    next(err);
  }
});
```

Use the `ErrorResponse` schema to normalize failures in your Express error middleware so clients always receive the documented JSON envelope.


