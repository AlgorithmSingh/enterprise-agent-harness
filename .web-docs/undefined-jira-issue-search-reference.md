Source: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
Accessed: 2026-08-12
Note: Operation details extracted from the OpenAPI spec embedded in the fetched page (REST API v3). Related issue/changelog operations from the same embedded spec (reference pages share one spec).

---

# Jira Cloud REST v3 - Issue search and retrieval operations (verified from embedded OpenAPI spec)
## Operations listed in the Issue search group
GET /rest/api/3/issue/picker | POST /rest/api/3/jql/match | GET /rest/api/3/search (deprecated) | POST /rest/api/3/search (deprecated) | POST /rest/api/3/search/approximate-count | GET /rest/api/3/search/jql | POST /rest/api/3/search/jql

## GET /rest/api/3/search/jql — "Search for issues using JQL enhanced search (GET)"
Scopes: Classic (RECOMMENDED): read:jira-work. Granular: read:issue-details:jira, read:audit-log:jira, read:avatar:jira, read:field-configuration:jira, read:issue-meta:jira. Connect scope: READ.

Parameters (name | schema | description):
- `jql` | {"example": "project = HSP", "type": "string"} | A [JQL](https://confluence.atlassian.com/x/egORLQ) expression. For performance reasons, this parameter requires a bounded query. A bounded query is a query with a search restriction.

 *  Example of an unbounded query: `order by key desc`.
 *  Example of a bounded query: `assignee = currentUser() order by key`.

Additionally, `orderBy` clause can contain a maximum of 7 fields.
- `nextPageToken` | {"example": "<string>", "type": "string"} | The token for a page to fetch that is not the first page. The first page has a `nextPageToken` of `null`. Use the `nextPageToken` to fetch the next page of issues.

Note: The `nextPageToken` field is **not included** in the response for the last page, indicating there is no next page.
- `maxResults` | {"default": 50, "example": 114, "format": "int32", "type": "integer"} | The maximum number of items to return per page. To manage page size, API may return fewer items per page where a large number of fields or properties are requested. The greatest number of items returned per page is achieved when requesting `id` or `key` only. It returns max 5000 issues.
- `fields` | {"items": {"default": "id", "type": "string"}, "type": "array"} | A list of fields to return for each issue, use it to retrieve a subset of fields. This parameter accepts a comma-separated list. Expand options include:

 *  `*all` Returns all fields.
 *  `*navigable` Returns navigable fields.
 *  `id` Returns only issue IDs.
 *  Any issue field, prefixed with a minus to exclude.

The default is `id`.

Examples:

 *  `summary,comment` Returns only the summary and comments fields only.
 *  `-description` Returns all navigable (default) fields except description.
 *  `*all,-comment` Returns all fields except comments.

Multiple `fields` parameters can be included in a request.

Note: By default, this resource returns IDs only. This differs from [GET issue](#api-rest-api-3-issue-issueIdOrKey-get) where the default is all fields.
- `expand` | {"example": "<string>", "type": "string"} | Use [expand](#expansion) to include additional information about issues in the response. Note that, unlike the majority of instances where `expand` is specified, `expand` is defined as a comma-delimited string of values. The expand options are:

 *  `renderedFields` Returns field values rendered in HTML format.
 *  `names` Returns the display name of each field.
 *  `schema` Returns the schema describing a field type.
 *  `transitions` Returns all possible transitions for the issue.
 *  `operations` Returns all possible operations for the issue.
 *  `editmeta` Returns information about how each field can be edited.
 *  `changelog` Returns a list of recent updates to an issue, sorted by date, starting from the most recent.
 *  `versionedRepresentations` Instead of `fields`, returns `versionedRepresentations` a JSON array containing each version of a field's value, with the highest numbered item representing the most recent version.

Examples: `"names,changelog"` Returns the display name of each field as well as a list of recent updates to an issue.
- `properties` | {"items": {"type": "string"}, "type": "array"} | A list of up to 5 issue properties to include in the results. This parameter accepts a comma-separated list.
- `fieldsByKeys` | {"default": false, "type": "boolean"} | Reference fields by their key (rather than ID). The default is `false`.
- `failFast` | {"default": false, "type": "boolean"} | Fail this request early if we can't retrieve all field data.
- `reconcileIssues` | {"items": {"format": "int64", "type": "integer"}, "type": "array"} | Strong consistency issue ids to be reconciled with search results. Accepts max 50 ids. This list of ids should be consistent with each paginated request across different pages.

Responses: 200 SearchAndReconcileResults, 400, 401.

## POST /rest/api/3/search/jql
Body fields: expand (string), fields (array), fieldsByKeys, jql, maxResults, nextPageToken, properties, reconcileIssues. Same semantics as GET.

## SearchAndReconcileResults schema (response)
- isLast: boolean, whether this is the last page
- issues: IssueBean[]
- nextPageToken: 'Continuation token to fetch the next page. If this result represents the last or the only page this token will be null. This token will expire in 7 days.'
- names, schema: field metadata (when expand requested)

## Deprecated classic search
GET /rest/api/3/search and POST /rest/api/3/search are marked deprecated:true with summary 'Currently being removed. Search for issues using JQL (GET/POST)' and description linking to https://developer.atlassian.com/changelog/#CHANGE-2046. Classic params: jql, startAt, maxResults, validateQuery, fields, expand, properties, fieldsByKeys, failFast.

## POST /rest/api/3/search/approximate-count — 'Count issues using JQL'
Body: {"jql": string}. Response 200: JQLCountResultsBean {count: int64, 'Number of issues matching JQL query.'}. Description: 'Provide an estimated count of the issues that match the JQL. Recent updates might not be immediately visible in the returned output. This endpoint requires JQL to be bounded.'

## GET /rest/api/3/issue/{issueIdOrKey} — 'Get issue'
Params: issueIdOrKey; fields (comma-separated; `*all`, `*navigable`, per-field, minus-prefix to exclude; default differs from search: all fields); fieldsByKeys; expand (renderedFields,names,schema,transitions,operations,editmeta,changelog,versionedRepresentations); properties (`*all`, minus-prefix); updateHistory; failFast.

## POST /rest/api/3/issue/bulkfetch — 'Bulk fetch issues'
'Returns the details for a set of requested issues. You can request up to 100 issues.' Issues returned in ascending id order; unmatched issues reported in errors list. Body (BulkFetchIssueRequestBean): issueIdsOrKeys (required), fields, expand (list; expand=changelog 'returns a maximum of 40 changelogs'), fieldsByKeys, properties.

## GET /rest/api/3/issue/{issueIdOrKey}/changelog — 'Get changelogs'
Params: startAt (default 0, page offset), maxResults (default 100). Classic offset pagination.

## POST /rest/api/3/changelog/bulkfetch — 'Bulk fetch changelogs'
'Returns a paginated list of all changelogs for given issues sorted by changelog date and issue IDs, starting from the oldest changelog and smallest issue ID.' 'You can request the changelogs of up to 1000 issues and can filter them by up to 10 field IDs.' Body (BulkChangelogRequestBean): issueIdsOrKeys (required, minItems 1, maxItems 1000), fieldIds (maxItems 10), maxResults (default 1000, min 1, max 10000), nextPageToken ('The cursor for pagination').
