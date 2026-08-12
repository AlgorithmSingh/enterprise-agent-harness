Source: https://developer.atlassian.com/changelog/#CHANGE-2046 (entry no longer in changelog window; corroborated by community/vendor sources)
Accessed: 2026-08-12
Note: Migration/removal facts; primary anchor is the reference doc marking endpoints deprecated. Secondary sources listed below.

---

# Jira classic search endpoints removal (CHANGE-2046)

Primary (verified in fetched v3 reference, 2026-08-12):
- GET /rest/api/3/search and POST /rest/api/3/search are `deprecated: true`, summary "Currently being removed. Search for issues using JQL (GET/POST)", description links to https://developer.atlassian.com/changelog/#CHANGE-2046.
- Replacements: GET/POST /rest/api/3/search/jql ("enhanced search"), POST /rest/api/3/search/approximate-count.

Secondary (community/vendor, found via WebSearch 2026-08-12):
- Deprecation announced with removal initially slated May 1, 2025, later moved to August 1, 2025; removal rolled out regionally/phased.
- Removed endpoints return HTTP 410 Gone with guidance to migrate to /rest/api/3/search/jql. Observed by: 
  - https://community.strategy.com/article/KB489535-Data-import-from-Jira-Cloud-Connector-failed-API-removed-410-Gone-Please-migrate-to-rest-api-3-search-jql
  - https://github.com/atlassian/atlassian-mcp-server/issues/70
  - https://repost.aws/questions/QU72Z7DJTyRtiZsrwIZ7evYw/amazon-appflow-jira-cloud-connector-fails-with-410-gone-needs-migration-to-rest-api-3-search-jql
  - https://docs.adaptavist.com/sr4jc/latest/release-notes/breaking-changes/atlassian-rest-api-search-endpoints-deprecation
- The new API drops `total`/`startAt` offset semantics; count via approximate-count; pagination via nextPageToken.
