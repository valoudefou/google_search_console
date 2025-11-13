const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const fixturesDir = path.join(__dirname, "fixtures");
const analyticsFixturePath = path.join(
  fixturesDir,
  "accu_co_uk_search_console.json"
);
const analyticsFixture = JSON.parse(
  fs.readFileSync(analyticsFixturePath, "utf-8")
);

const SITES = [
  {
    id: "https://accu.co.uk/",
    displayName: "Accu",
    type: "URL_PREFIX",
  },
  {
    id: "sc-domain:example.com",
    displayName: "Example",
    type: "DOMAIN",
  },
];

const SITEMAPS = {
  "https://accu.co.uk/": [
    {
      path: "/sitemap.xml",
      type: "SITEMAP",
      lastSubmitted: "2025-01-01T00:00:00Z",
      lastProcessed: "2025-01-01T01:00:00Z",
      discoveredUrls: 1200,
      indexedUrls: 1100,
    },
  ],
};

const DEFAULT_URL_INSPECTION = {
  url: "https://accu.co.uk/blue-shoes",
  indexStatus: "INDEXED",
  lastCrawlTime: "2025-01-27T10:23:15Z",
  robotsState: "ALLOWED",
  canonicalUrl: "https://accu.co.uk/blue-shoes",
  mobileFriendly: true,
  mobileIssues: [],
  richResultTypes: ["PRODUCT"],
};

const SITE_ALIASES = {
  "https://accu.co.uk/": new Set(["https://accu.co.uk/", "accu.co.uk", "accu"]),
};

const resolveSiteId = (input) => {
  if (!input) return null;
  const decoded = decodeURIComponent(input);
  for (const [canonical, aliases] of Object.entries(SITE_ALIASES)) {
    if (aliases.has(decoded)) {
      return canonical;
    }
  }
  return decoded;
};

const sendError = (res, code, message, details = "") =>
  res.status(code).json({ error: { code, message, details } });

app.get("/v1/sites", (_req, res) => {
  res.json({ sites: SITES });
});

app.post("/v1/sites/:siteId/searchAnalytics:query", (req, res) => {
  const siteId = resolveSiteId(req.params.siteId);
  if (!siteId) return sendError(res, 400, "Missing siteId");
  if (siteId !== analyticsFixture.site) {
    return sendError(res, 404, "Site not found", `${siteId} has no fixture`);
  }
  res.json({ search_console_rows: analyticsFixture.search_console_rows });
});

app.post("/v1/sites/:siteId/urlInspection:index", (req, res) => {
  const siteId = resolveSiteId(req.params.siteId);
  if (!siteId) return sendError(res, 400, "Missing siteId");
  if (siteId !== analyticsFixture.site) {
    return sendError(res, 404, "Site not found", `${siteId} has no fixture`);
  }
  const inspectionUrl = req.body?.inspectionUrl || DEFAULT_URL_INSPECTION.url;
  res.json({
    result: {
      ...DEFAULT_URL_INSPECTION,
      url: inspectionUrl,
      canonicalUrl: inspectionUrl,
    },
  });
});

app.get("/v1/sites/:siteId/sitemaps", (req, res) => {
  const siteId = resolveSiteId(req.params.siteId);
  if (!siteId) return sendError(res, 400, "Missing siteId");
  const sitemaps = SITEMAPS[siteId];
  if (!sitemaps) {
    return sendError(res, 404, "Sitemaps not found", `${siteId} has no data`);
  }
  res.json({ sitemaps });
});

app.use((req, res) => {
  sendError(res, 404, "Not found", `${req.method} ${req.originalUrl}`);
});

app.listen(PORT, () => {
  console.log(`SEO Console API listening on http://localhost:${PORT}/v1`);
});
