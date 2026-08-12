Source: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
Accessed: 2026-08-12
Note: Extract via WebFetch (model-summarized; verified claims only).

---

# Confluence Cloud REST API v2 - Intro (extract)

- Base path: /wiki/api/v2/
- Auth: apps use JWT or OAuth 2.0; direct API calls use Basic authentication. Authorization via scopes (apps) or the authenticated user's permissions (direct calls).
- Pagination: cursor-based, using `limit` and `cursor` query params. The `Link` response header contains the URL for the next page, e.g. `</wiki/api/v2/pages?limit=5&cursor=<cursor token>>; rel="next"`. The response body `_links.next` property mirrors the Link header. When there are no further results, the Link header and `_links.next` are absent.
- Multiple relations in Link header separated by semicolons; multiple URLs separated by commas.
- API groups include: Pages, Spaces, Blog Posts, Comments, Attachments, Labels, Tasks, Whiteboards, Versions, Custom Content.
