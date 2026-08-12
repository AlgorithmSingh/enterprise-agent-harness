Source: https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/ and https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-space/
Accessed: 2026-08-12
Note: Operation details extracted from the OpenAPI spec embedded in the fetched pages (REST API v2). Server base: https://{your-domain}/wiki/api/v2

---

# Confluence Cloud REST v2 - Pages and Spaces (verified from embedded OpenAPI spec)

Server: `https://{your-domain}/wiki/api/v2` (spec `servers[0].url`).

## GET /pages — 'Get pages' (full path /wiki/api/v2/pages)
OAuth scope: read:page:confluence.
Params: id (array, comma-separated page ids); space-id (array); sort; status (default current,archived); title; body-format; subtype (live|page); cursor ('opaque cursor ... returned in the next URL in the Link response header'); limit (integer, default 25, min 1, max 250).

## GET /pages/{id} — 'Get page by id'
Params: id; body-format; get-draft (default false); status; version (retrieve a previously published version); include-labels/include-properties/include-operations/include-likes/include-versions (all default false, limited to 50 results); include-version (default true); include-favorited-by-current-user-status, include-webresources, include-collaborators, include-direct-children (default false).

## GET /spaces — 'Get spaces'
Params: ids, keys (comma-separated); type (global|collaboration|knowledge_base|personal|system|onboarding|xflow_sample_space); status (current|archived); labels; favorited-by; not-favorited-by; sort; description-format; include-icon (default false); cursor; limit (default 25, min 1, max 250).

## GET /spaces/{id} — 'Get space by id'
Params: id; description-format; include-icon; include-operations/properties/permissions/role-assignments/labels (default false).

## body-format enums (schemas)
- PrimaryBodyRepresentation (multi-result fetches): storage, atlas_doc_format
- PrimaryBodyRepresentationSingle (single-item fetches): storage, atlas_doc_format, view, export_view, anonymous_export_view, styled_view, editor
- SpaceDescriptionBodyRepresentation: plain, view
