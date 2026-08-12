Source: https://community.developer.atlassian.com/t/api-token-rate-limiting/92292
Accessed: 2026-08-12
Note: Official Atlassian announcement post on developer community; extract via WebFetch.

---

# API Token Rate Limiting announcement (extract)

- "Starting November 22, 2025, Atlassian will implement rate limits for API tokens." Earlier enforcement possible for high-impact integrations (Atlassian will contact affected users directly).
- Applies to any apps, scripts, or integrations relying on API tokens; Jira and Confluence Cloud; managed and unmanaged users.
- The announcement itself publishes NO specific numeric limits: "Our team is actively refining these limits and will publish them in the linked documentation in the coming months." (Numbers land in the product rate-limiting docs.)
- Responses carry beta headers in the same format as Marketplace app rate limits: X-Beta-Retry-After, X-Beta-RateLimit-NearLimit, X-Beta-RateLimit-Reason, X-Beta-RateLimit-Reset.
- Links to https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ and https://developer.atlassian.com/cloud/confluence/rate-limiting/#introduction
- Exceeding limits produces 429 Too Many Requests.
