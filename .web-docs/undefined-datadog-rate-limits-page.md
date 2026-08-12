# Datadog docs — Rate Limits (full main-content extract)

- Source URL: https://docs.datadoghq.com/api/latest/rate-limits/
- Accessed: 2026-08-12 (curl + pandoc html->gfm; site navigation stripped, body text verbatim)

## Rate Limits

Many API endpoints are rate limited. Once you exceed a certain number of
requests in a specific period, Datadog returns an error.

If you are rate limited, you can see a 429 in the response code. You can
either wait the designated time by the `X-RateLimit-Period` before
making calls again, or switch to making calls at a frequency slightly
longer than the `X-RateLimit-Limit` or `X-RateLimit-Period`.

Rate limits can be increased from the defaults by contacting the
Datadog support team (https://docs.datadoghq.com/help/).

Regarding the API rate limit policy:

- Datadog **does not rate limit** on data point/metric submission (see
  metrics section for more info on how the metric submission rate is handled).
  Limits encounter is dependent on the quantity of custom metrics based on
  your agreement.
- The API for sending logs is not rate limited.
- The rate limit for event submission is `250,000` events per minute per
  organization.
- The rate limits for endpoints vary and are included in the headers
  detailed below. These can be extended on demand.

> (alert) The list above is not comprehensive of all rate limits on Datadog APIs.
> If you are experiencing rate limiting, reach out to support for more
> information about the APIs you're using and their limits.

| Rate Limit Headers | Description |
|----|----|
| `X-RateLimit-Limit` | number of requests allowed in a time period. |
| `X-RateLimit-Period` | length of time in seconds for resets (calendar aligned). |
| `X-RateLimit-Remaining` | number of allowed requests left in the current time period. |
| `X-RateLimit-Reset` | time in seconds until next reset. |
| `X-RateLimit-Name` | name of the rate limit for increase requests. |

## Datadog API usage metrics

All Datadog APIs have a usage limit for a given period of time. APIs can
have unique, distinct rate limit buckets or be grouped together into a
single bucket depending on the resource(s) being used. For example, the
monitor status API has a rate limit that allows a human or automation
script to query only so many times per minute. The endpoint rejects
excess requests with a 429 response code and a hint to back off until a
reset period has expired. API usage metrics allow Datadog users to
self-service and audit API rate limit consumption for API endpoints
(excluding metrics, logs, and event submission endpoints).

### Available metrics

| Dimension | Usage metric | Description |
|---|---|---|
| Org | `datadog.apis.usage.per_org` | The organization-wide rate limit of the number of API requests made to a specific endpoint |
| Org | `datadog.apis.usage.per_org_ratio` | Ratio of API requests by available dimensions to total number of requests (`limit_count`) allowed. |
| User (UUID) | `datadog.apis.usage.per_user` | Number of API requests made for a specific API endpoint that is rate limited per unique user. |
| User (UUID) | `datadog.apis.usage.per_user_ratio` | Ratio variant. |
| API Key | `datadog.apis.usage.per_api_key` | Number of API requests made for a specific API endpoint that is rate limited per unique API Key used |
| API Key | `datadog.apis.usage.per_api_key_ratio` | Ratio variant. |

Available tags on all of the above: `app_key_id`, `child_org` (on parent only),
`limit_count`, `limit_name`, `limit_period`, `rate_limit_status`, `user_uuid`.

### Tag key

| Tag name | Description |
|---|---|
| `app_key_id` | Application Key ID used by API client. Can be `N/A` for web or mobile users and open endpoints. |
| `child_org` | Name of child org, if viewing from the parent org. Otherwise `N/A`. Same datacenter only. |
| `limit_count` | Number of requests available to each rate limit name during a request period. |
| `limit_name` | Name of rate limit. Different endpoints can share the same name. |
| `limit_period` | Time in seconds for each rate limit name before the consumption count is reset. |
| `rate_limit_status` | `passed`: Request was not blocked. `blocked`: Request was blocked due to rate limits breached. |
| `user_uuid` | UUID of user for API consumption. |

Rollup guidance: "Metric visualizations should generally be rolled up to the
minute using sum(60s) to aggregate the total number of requests per minute.
Ratio metrics are already normalized to the corresponding `limit_period`."

Example query (requests by rate limit name):
`default_zero(sum:datadog.apis.usage.per_org{*} by {limit_name}) + default_zero(sum:datadog.apis.usage.per_user{*} by {limit_name}) + default_zero(sum:datadog.apis.usage.per_api_key{*} by {limit_name})`

## Increase your rate limit

You can request increased rate limits by creating a Support ticket
(Help > New Support Ticket) including: endpoint, example use cases/queries,
motivation, desired target rate limit. "Upon receiving a rate limit increase,
our Support Engineering team reviews the request on a case-by-case basis...
Note that there is a maximum to how much a rate limit can be increased due to
the SaaS nature of Datadog. Datadog Support reserves the right to reject rate
limit increases based on use cases and Engineering recommendations."

## Audit logs

Audit Trail offers granular visibility into API activity (IP address and
geolocation, actor type, API vs. app key authentication, correlated events)
to troubleshoot rate limit issues.
