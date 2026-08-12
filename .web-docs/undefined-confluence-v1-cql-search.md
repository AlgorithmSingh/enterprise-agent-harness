Source: https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/
Accessed: 2026-08-12
Note: Operation details extracted from the OpenAPI spec embedded in the fetched page (REST API v1). Server: //your-domain.atlassian.net

---

# Confluence Cloud REST v1 - Search content (CQL) (verified from embedded OpenAPI spec)

## GET /wiki/rest/api/search — 'Search content'
Searches for content using Confluence Query Language (CQL).
Note in doc: "CQL input queries submitted through the /wiki/rest/api/search endpoint no longer support user-specific fields like user, user.fullname, user.accountid, and user.userkey." (see deprecation notice: https://developer.atlassian.com/cloud/confluence/deprecation-notice-search-api/)

Example initial call: /wiki/rest/api/search?cql=type=page&limit=25
Response includes results[], limit, size, and _links.next of the form:
  /rest/api/search?cql=type=page&limit=25&cursor=raNDoMsT...

Parameters:
- cql (string): the CQL query
- cqlcontext (string): spaceKey, contentId, contentStatuses to execute the search against
- cursor (string): "Pointer to a set of search results, returned as part of the next or prev URL from the previous search call"
- next (boolean, default false); prev (boolean, default false)
- limit (int, default 25): "The maximum number of content objects to return per page. Note, this may be restricted by fixed system limits."
- start (int, default 0): start point of the collection
- includeArchivedSpaces (default false); excludeCurrentSpaces (default false)
- excerpt (string, default "highlight"): excerpt strategy
- sitePermissionTypeFilter (default "none")
- expand (array)
