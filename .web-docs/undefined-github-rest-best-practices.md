# GitHub REST API — Best practices for using the REST API

- Source URL: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch).

## Handling rate limit errors

- If `retry-after` header present: "you should not retry your request until after that many seconds has elapsed".
- If `x-ratelimit-remaining` is `0`: "you should not make another request until after the time specified by the `x-ratelimit-reset` header. The `x-ratelimit-reset` header is in UTC epoch seconds".
- Otherwise: "wait for at least one minute before retrying. If your request continues to fail due to a secondary rate limit, wait for an exponentially increasing amount of time between retries".

## Avoiding secondary limits — concurrency

"To avoid exceeding secondary rate limits, you should make requests serially instead of concurrently. To achieve this, you can implement a queue system for requests."

## Conditional requests

- ETag flow: save the `etag` response header value; send it back in the `if-none-match` request header; the API returns `304 Not Modified` when unchanged.
- Last-Modified flow: send the saved `last-modified` value in the `if-modified-since` request header.
- Rate-limit impact (quoted): "Making a conditional request does not count against your primary rate limit if a `304` response is returned and the request was made while correctly authorized with an `Authorization` header."

## Pagination and caching

- Use "link headers to determine what pages of results you can request" rather than constructing page URLs manually.
- Keep sort orders and query parameters stable to maximize `304 Not Modified` hits; smaller, specific requests change less frequently.
