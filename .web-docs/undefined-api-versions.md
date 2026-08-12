Source: https://docs.github.com/en/rest/about-the-rest-api/api-versions
Accessed: 2026-08-12

# GitHub REST API versioning

- Header name: `X-GitHub-Api-Version`
- Supported versions as of 2026-08-12: `2026-03-10` (end of support not yet scheduled) and `2022-11-28` (end of support 2028-03-10).
- Requests without the `X-GitHub-Api-Version` header default to the `2022-11-28` version.
- Specifying a version that is no longer supported returns a `410 Gone` response.
