# GitHub REST API — Using pagination in the REST API

- Source URL: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch).

## Link header (quoted example)

```
link: <https://api.github.com/repositories/1300192/issues?page=2>; rel="prev", <https://api.github.com/repositories/1300192/issues?page=4>; rel="next", <https://api.github.com/repositories/1300192/issues?page=515>; rel="last", <https://api.github.com/repositories/1300192/issues?page=1>; rel="first"
```

`rel` values: `prev` (previous page), `next` (next page), `last` (final page), `first` (initial page). Not all links appear in every response (e.g., no `prev` on the first page).

## Parameters

- `per_page` controls results per page; "the maximum value of `per_page` is `100`" for most endpoints. Exceeding the maximum is silently clamped (no error).
- Page selection is via `page`, or `before`/`after`, or `since`, depending on the endpoint.

## Practice

Follow the `link` header URLs verbatim instead of constructing page URLs manually.
