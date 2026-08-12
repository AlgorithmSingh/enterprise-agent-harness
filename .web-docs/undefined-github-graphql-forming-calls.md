Source: https://docs.github.com/en/graphql/guides/forming-calls-with-graphql
Accessed: 2026-08-12
Note: faithful extraction (quotes are verbatim from the page); not a full-page mirror.

# Forming calls with GraphQL (GitHub Docs)

- Single endpoint: `https://api.github.com/graphql`
- HTTP verb: always POST — "In GraphQL, you'll provide a JSON-encoded body whether you're performing a query or a mutation, so the HTTP verb is POST."
- Authorization header format used in examples: `Authorization: bearer TOKEN`
- Example curl call:

```shell
curl -H "Authorization: bearer TOKEN" -X POST \
  -d '{"query":"query { viewer { login }}"}' \
  https://api.github.com/graphql
```

- Scopes/permissions depend on the data requested (e.g. fine-grained "issues:read" to read issues; classic `public_repo` scope for public repository access). If the token lacks permissions, "the API will return an error message that states the scopes or permissions your token needs."
