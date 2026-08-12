Source: https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/
Accessed: 2026-08-12
Note: Extract via WebFetch (model-summarized; verified claims only).

---

# Basic auth for REST APIs (extract)

- Construct header: base64-encode `useremail:api_token`, send `Authorization: Basic <encoded>`.
- Or use curl's `-u` flag: `curl -u fred@example.com:freds_api_token -X GET https://your-domain.atlassian.net/rest/api/2/issue/createmeta`
- Create API tokens from Atlassian Account settings (id.atlassian.com API tokens page).
- Authentication using passwords has been deprecated; API tokens are required.
- Repeated failed auth attempts can trigger CAPTCHA, after which REST API authentication is denied until the CAPTCHA is cleared.
- Atlassian recommends OAuth 2.0 (3LO) / Forge / Connect for production; basic auth for simple scripts and manual calls.
