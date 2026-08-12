# Datadog — Metrics API: Query timeseries across products (POST /api/v2/query/timeseries)

- Source URL: https://docs.datadoghq.com/api/latest/metrics/query-timeseries-data-across-multiple-products.md
- Accessed: 2026-08-12 (native vendor markdown mirror served by docs.datadoghq.com, fetched verbatim with curl)

---
title: Query timeseries data across multiple products
description: Datadog, the leading service for cloud-scale monitoring.
breadcrumbs: Docs > API Reference > Metrics
---

> For the complete documentation index, see [llms.txt](https://docs.datadoghq.com/llms.txt).

# Query timeseries data across multiple products{% #query-timeseries-data-across-multiple-products %}
Copy pageCopied
{% tab title="v2" %}

| Datadog site      | API endpoint                                               |
| ----------------- | ---------------------------------------------------------- |
| ap1.datadoghq.com | POST https://api.ap1.datadoghq.com/api/v2/query/timeseries |
| ap2.datadoghq.com | POST https://api.ap2.datadoghq.com/api/v2/query/timeseries |
| app.datadoghq.eu  | POST https://api.datadoghq.eu/api/v2/query/timeseries      |
| app.ddog-gov.com  | POST https://api.ddog-gov.com/api/v2/query/timeseries      |
| us2.ddog-gov.com  | POST https://api.us2.ddog-gov.com/api/v2/query/timeseries  |
| uk1.datadoghq.com | POST https://api.uk1.datadoghq.com/api/v2/query/timeseries |
| app.datadoghq.com | POST https://api.datadoghq.com/api/v2/query/timeseries     |
| us3.datadoghq.com | POST https://api.us3.datadoghq.com/api/v2/query/timeseries |
| us5.datadoghq.com | POST https://api.us5.datadoghq.com/api/v2/query/timeseries |

### Overview

Query timeseries data across various data sources and process the data by applying formulas and functions. This endpoint requires the `timeseries_query` permission.

OAuth apps require the `timeseries_query` authorization [scope](https://docs.datadoghq.com/api/latest/scopes.md#metrics) to access this endpoint.



### Request

#### Body Data (required)



{% tab title="Model" %}

| Parent field                       | Field                              | Type            | Description                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ---------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|                                    | data [*required*]             | object          | A single timeseries query to be executed.                                                                                                                                                                                                                                                                                             |
| data                               | attributes [*required*]       | object          | The object describing a timeseries formula request.                                                                                                                                                                                                                                                                                   |
| attributes                         | formulas                           | [object]        | List of formulas to be calculated and returned as responses.                                                                                                                                                                                                                                                                          |
| formulas                           | formula [*required*]          | string          | Formula string, referencing one or more queries with their name property.                                                                                                                                                                                                                                                             |
| formulas                           | limit                              | object          | Message for specifying limits to the number of values returned by a query. This limit is only for scalar queries and has no effect on timeseries queries.                                                                                                                                                                             |
| limit                              | count                              | int32           | The number of results to which to limit.                                                                                                                                                                                                                                                                                              |
| limit                              | order                              | enum            | Direction of sort. Allowed enum values: `asc,desc`                                                                                                                                                                                                                                                                                    |
| attributes                         | from [*required*]             | int64           | Start date (inclusive) of the query in milliseconds since the Unix epoch.                                                                                                                                                                                                                                                             |
| attributes                         | interval                           | int64           | A time interval in milliseconds. May be overridden by a larger interval if the query would result in too many points for the specified timeframe. Defaults to a reasonable interval for the given timeframe.                                                                                                                          |
| attributes                         | queries [*required*]          | [ <oneOf>] | List of queries to be run and used as inputs to the formulas.                                                                                                                                                                                                                                                                         |
| queries                            | Object 1                           | object          | A query against Datadog custom metrics or Cloud Cost data sources.                                                                                                                                                                                                                                                                    |
| Object 1                           | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| Object 1                           | data_source [*required*]      | enum            | A data source that is powered by the Metrics platform. Allowed enum values: `metrics,cloud_cost`                                                                                                                                                                                                                                      |
| Object 1                           | name                               | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| Object 1                           | query [*required*]            | string          | A classic metrics query string.                                                                                                                                                                                                                                                                                                       |
| queries                            | Object 2                           | object          | An individual timeseries query for logs, RUM, traces, CI pipelines, security signals, and other event-based data sources. Use this query type for any data source powered by the Events Platform. See the data_source field for the full list of supported sources.                                                                   |
| Object 2                           | compute [*required*]          | object          | The instructions for what to compute for this query.                                                                                                                                                                                                                                                                                  |
| compute                            | aggregation [*required*]      | enum            | The type of aggregation that can be performed on events-based queries. Allowed enum values: `count,cardinality,pc75,pc90,pc95,pc98,pc99,sum,min,max`                                                                                                                                                                                  |
| compute                            | interval                           | int64           | Interval for compute in milliseconds.                                                                                                                                                                                                                                                                                                 |
| compute                            | metric                             | string          | The "measure" attribute on which to perform the computation.                                                                                                                                                                                                                                                                          |
| Object 2                           | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| Object 2                           | data_source [*required*]      | enum            | A data source that is powered by the Events Platform. Allowed enum values: `logs,spans,network,rum,security_signals,profiles,audit,events,ci_tests,ci_pipelines`                                                                                                                                                                      |
| Object 2                           | group_by                           | [object]        | The list of facets on which to split results.                                                                                                                                                                                                                                                                                         |
| group_by                           | facet [*required*]            | string          | The facet by which to split groups.                                                                                                                                                                                                                                                                                                   |
| group_by                           | limit                              | int32           | The maximum buckets to return for this group by. Note: at most 10000 buckets are allowed. If grouping by multiple facets, the product of limits must not exceed 10000.                                                                                                                                                                |
| group_by                           | sort                               | object          | The dimension by which to sort a query's results.                                                                                                                                                                                                                                                                                     |
| sort                               | aggregation [*required*]      | enum            | The type of aggregation that can be performed on events-based queries. Allowed enum values: `count,cardinality,pc75,pc90,pc95,pc98,pc99,sum,min,max`                                                                                                                                                                                  |
| sort                               | metric                             | string          | The metric's calculated value which should be used to define the sort order of a query's results.                                                                                                                                                                                                                                     |
| sort                               | order                              | enum            | Direction of sort. Allowed enum values: `asc,desc`                                                                                                                                                                                                                                                                                    |
| sort                               | type                               | enum            | The type of sort to use on the calculated value. Allowed enum values: `alphabetical,measure`                                                                                                                                                                                                                                          |
| Object 2                           | indexes                            | [string]        | The indexes in which to search.                                                                                                                                                                                                                                                                                                       |
| Object 2                           | name                               | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| Object 2                           | search                             | object          | Configuration of the search/filter for an events query.                                                                                                                                                                                                                                                                               |
| search                             | query                              | string          | The search/filter string for an events query.                                                                                                                                                                                                                                                                                         |
| queries                            | <data_source=apm_resource_stats>   | object          | A query for APM resource statistics such as latency, error rate, and hit count, grouped by resource name.                                                                                                                                                                                                                             |
| <data_source=apm_resource_stats>   | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| <data_source=apm_resource_stats>   | data_source [*required*]      | enum            | A data source for APM resource statistics queries. Allowed enum values: `apm_resource_stats`                                                                                                                                                                                                                                          |
| <data_source=apm_resource_stats>   | env [*required*]              | string          | The environment to query.                                                                                                                                                                                                                                                                                                             |
| <data_source=apm_resource_stats>   | group_by                           | [string]        | Tag keys to group results by.                                                                                                                                                                                                                                                                                                         |
| <data_source=apm_resource_stats>   | name [*required*]             | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| <data_source=apm_resource_stats>   | operation_name                     | string          | The APM operation name.                                                                                                                                                                                                                                                                                                               |
| <data_source=apm_resource_stats>   | primary_tag_name                   | string          | Name of the second primary tag used within APM. Required when `primary_tag_value` is specified. See [https://docs.datadoghq.com/tracing/guide/setting_primary_tags_to_scope/#add-a-second-primary-tag-in-datadog](https://docs.datadoghq.com/tracing/guide/setting_primary_tags_to_scope.md#add-a-second-primary-tag-in-datadog)      |
| <data_source=apm_resource_stats>   | primary_tag_value                  | string          | Value of the second primary tag by which to filter APM data. `primary_tag_name` must also be specified.                                                                                                                                                                                                                               |
| <data_source=apm_resource_stats>   | resource_name                      | string          | The resource name to filter by.                                                                                                                                                                                                                                                                                                       |
| <data_source=apm_resource_stats>   | service [*required*]          | string          | The service name to filter by.                                                                                                                                                                                                                                                                                                        |
| <data_source=apm_resource_stats>   | stat [*required*]             | enum            | The APM resource statistic to query. Allowed enum values: `error_rate,errors,hits,latency_avg,latency_max,latency_p50,latency_p75,latency_p90,latency_p95,latency_p99`                                                                                                                                                                |
| queries                            | <data_source=apm_metrics>          | object          | A query for APM trace metrics such as hits, errors, and latency percentiles, aggregated across services.                                                                                                                                                                                                                              |
| <data_source=apm_metrics>          | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| <data_source=apm_metrics>          | data_source [*required*]      | enum            | A data source for APM metrics queries. Allowed enum values: `apm_metrics`                                                                                                                                                                                                                                                             |
| <data_source=apm_metrics>          | group_by                           | [string]        | Optional fields to group the query results by.                                                                                                                                                                                                                                                                                        |
| <data_source=apm_metrics>          | name [*required*]             | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| <data_source=apm_metrics>          | operation_mode                     | string          | Optional operation mode to aggregate across operation names.                                                                                                                                                                                                                                                                          |
| <data_source=apm_metrics>          | operation_name                     | string          | Name of operation on service. If not provided, the primary operation name is used.                                                                                                                                                                                                                                                    |
| <data_source=apm_metrics>          | peer_tags                          | [string]        | Tags to query for a specific downstream entity (peer.service, peer.db_instance, peer.s3, peer.s3.bucket, etc.).                                                                                                                                                                                                                       |
| <data_source=apm_metrics>          | query_filter                       | string          | Additional filters for the query using metrics query syntax (for example, env, primary_tag).                                                                                                                                                                                                                                          |
| <data_source=apm_metrics>          | resource_hash                      | string          | The resource hash for exact matching.                                                                                                                                                                                                                                                                                                 |
| <data_source=apm_metrics>          | resource_name                      | string          | The full name of a specific resource to filter by.                                                                                                                                                                                                                                                                                    |
| <data_source=apm_metrics>          | service                            | string          | The service name to filter by.                                                                                                                                                                                                                                                                                                        |
| <data_source=apm_metrics>          | span_kind                          | enum            | Describes the relationship between the span, its parents, and its children in a trace. Allowed enum values: `consumer,server,client,producer,internal`                                                                                                                                                                                |
| <data_source=apm_metrics>          | stat [*required*]             | enum            | The APM metric statistic to query. Allowed enum values: `error_rate,errors,errors_per_second,hits,hits_per_second,apdex,latency_avg,latency_max,latency_p50,latency_p75`                                                                                                                                                              |
| queries                            | <data_source=apm_dependency_stats> | object          | A query for APM dependency statistics between services, such as call latency and error rates.                                                                                                                                                                                                                                         |
| <data_source=apm_dependency_stats> | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| <data_source=apm_dependency_stats> | data_source [*required*]      | enum            | A data source for APM dependency statistics queries. Allowed enum values: `apm_dependency_stats`                                                                                                                                                                                                                                      |
| <data_source=apm_dependency_stats> | env [*required*]              | string          | The environment to query.                                                                                                                                                                                                                                                                                                             |
| <data_source=apm_dependency_stats> | is_upstream                        | boolean         | Determines whether stats for upstream or downstream dependencies should be queried.                                                                                                                                                                                                                                                   |
| <data_source=apm_dependency_stats> | name [*required*]             | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| <data_source=apm_dependency_stats> | operation_name [*required*]   | string          | The APM operation name.                                                                                                                                                                                                                                                                                                               |
| <data_source=apm_dependency_stats> | primary_tag_name                   | string          | The name of the second primary tag used within APM; required when `primary_tag_value` is specified. See [https://docs.datadoghq.com/tracing/guide/setting_primary_tags_to_scope/#add-a-second-primary-tag-in-datadog](https://docs.datadoghq.com/tracing/guide/setting_primary_tags_to_scope.md#add-a-second-primary-tag-in-datadog). |
| <data_source=apm_dependency_stats> | primary_tag_value                  | string          | Filter APM data by the second primary tag. `primary_tag_name` must also be specified.                                                                                                                                                                                                                                                 |
| <data_source=apm_dependency_stats> | resource_name [*required*]    | string          | The resource name to filter by.                                                                                                                                                                                                                                                                                                       |
| <data_source=apm_dependency_stats> | service [*required*]          | string          | The service name to filter by.                                                                                                                                                                                                                                                                                                        |
| <data_source=apm_dependency_stats> | stat [*required*]             | enum            | The APM dependency statistic to query. Allowed enum values: `avg_duration,avg_root_duration,avg_spans_per_trace,error_rate,pct_exec_time,pct_of_traces,total_traces_count`                                                                                                                                                            |
| queries                            | <data_source=slo>                  | object          | A query for SLO status, error budget, and burn rate metrics.                                                                                                                                                                                                                                                                          |
| <data_source=slo>                  | additional_query_filters           | string          | Additional filters applied to the SLO query.                                                                                                                                                                                                                                                                                          |
| <data_source=slo>                  | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| <data_source=slo>                  | data_source [*required*]      | enum            | A data source for SLO queries. Allowed enum values: `slo`                                                                                                                                                                                                                                                                             |
| <data_source=slo>                  | group_mode                         | enum            | How SLO results are grouped in the response. Allowed enum values: `overall,components`                                                                                                                                                                                                                                                |
| <data_source=slo>                  | measure [*required*]          | enum            | The SLO measurement to retrieve. Allowed enum values: `good_events,bad_events,slo_status,error_budget_remaining,error_budget_remaining_history,error_budget_burndown,burn_rate,slo_status_history,good_minutes,bad_minutes`                                                                                                           |
| <data_source=slo>                  | name                               | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| <data_source=slo>                  | slo_id [*required*]           | string          | The unique identifier of the SLO to query.                                                                                                                                                                                                                                                                                            |
| <data_source=slo>                  | slo_query_type                     | enum            | The type of SLO definition being queried. Allowed enum values: `metric,time_slice,monitor`                                                                                                                                                                                                                                            |
| queries                            | <data_source=process>              | object          | A query for host-level process metrics such as CPU and memory usage.                                                                                                                                                                                                                                                                  |
| <data_source=process>              | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| <data_source=process>              | data_source [*required*]      | enum            | A data source for process-level infrastructure metrics. Allowed enum values: `process`                                                                                                                                                                                                                                                |
| <data_source=process>              | is_normalized_cpu                  | boolean         | Whether CPU metrics should be normalized by core count.                                                                                                                                                                                                                                                                               |
| <data_source=process>              | limit                              | int64           | Maximum number of results to return.                                                                                                                                                                                                                                                                                                  |
| <data_source=process>              | metric [*required*]           | string          | The process metric to query.                                                                                                                                                                                                                                                                                                          |
| <data_source=process>              | name [*required*]             | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| <data_source=process>              | sort                               | enum            | Direction of sort. Allowed enum values: `asc,desc`                                                                                                                                                                                                                                                                                    |
| <data_source=process>              | tag_filters                        | [string]        | Tag filters to narrow down processes.                                                                                                                                                                                                                                                                                                 |
| <data_source=process>              | text_filter                        | string          | A full-text search filter to match process names or commands.                                                                                                                                                                                                                                                                         |
| queries                            | <data_source=container>            | object          | A query for container-level metrics such as CPU and memory usage.                                                                                                                                                                                                                                                                     |
| <data_source=container>            | cross_org_uuids                    | [string]        | Organization UUIDs to query when using [cross-organization visibility](https://docs.datadoghq.com/account_management/org_settings/cross_org_visibility.md). Limited to one organization UUID.                                                                                                                                         |
| <data_source=container>            | data_source [*required*]      | enum            | A data source for container-level infrastructure metrics. Allowed enum values: `container`                                                                                                                                                                                                                                            |
| <data_source=container>            | is_normalized_cpu                  | boolean         | Whether CPU metrics should be normalized by core count.                                                                                                                                                                                                                                                                               |
| <data_source=container>            | limit                              | int64           | Maximum number of results to return.                                                                                                                                                                                                                                                                                                  |
| <data_source=container>            | metric [*required*]           | string          | The container metric to query.                                                                                                                                                                                                                                                                                                        |
| <data_source=container>            | name [*required*]             | string          | The variable name for use in formulas.                                                                                                                                                                                                                                                                                                |
| <data_source=container>            | sort                               | enum            | Direction of sort. Allowed enum values: `asc,desc`                                                                                                                                                                                                                                                                                    |
| <data_source=container>            | tag_filters                        | [string]        | Tag filters to narrow down containers.                                                                                                                                                                                                                                                                                                |
| <data_source=container>            | text_filter                        | string          | A full-text search filter to match container names.                                                                                                                                                                                                                                                                                   |
| attributes                         | to [*required*]               | int64           | End date (exclusive) of the query in milliseconds since the Unix epoch.                                                                                                                                                                                                                                                               |
| data                               | type [*required*]             | enum            | The type of the resource. The value should always be timeseries_request. Allowed enum values: `timeseries_request`                                                                                                                                                                                                                    |

{% /tab %}

{% tab title="Example" %}
##### 

```json
{
  "data": {
    "attributes": {
      "formulas": [
        {
          "formula": "a",
          "limit": {
            "count": 10,
            "order": "desc"
          }
        }
      ],
      "from": 1636625471000,
      "interval": 5000,
      "queries": [
        {
          "data_source": "metrics",
          "query": "avg:datadog.estimated_usage.metrics.custom{*}",
          "name": "a"
        }
      ],
      "to": 1636629071000
    },
    "type": "timeseries_request"
  }
}
```

##### 

```json
{
  "data": {
    "attributes": {
      "formulas": [
        {
          "formula": "a",
          "limit": {
            "count": 10,
            "order": "desc"
          }
        }
      ],
      "from": 1636625471000,
      "interval": 5000,
      "queries": [
        {
          "data_source": "rum",
          "name": "a",
          "compute": {
            "aggregation": "count"
          },
          "search": {
            "query": "*"
          },
          "indexes": [
            "*"
          ]
        }
      ],
      "to": 1636629071000
    },
    "type": "timeseries_request"
  }
}
```

##### 

```json
{
  "data": {
    "attributes": {
      "formulas": [
        {
          "formula": "a",
          "limit": {
            "count": 10,
            "order": "desc"
          }
        }
      ],
      "from": 1636625471000,
      "interval": 5000,
      "queries": [
        {
          "data_source": "apm_dependency_stats",
          "name": "a",
          "env": "ci",
          "service": "cassandra",
          "stat": "avg_duration",
          "operation_name": "cassandra.query",
          "resource_name": "DELETE FROM monitor_history.monitor_state_change_history WHERE org_id = ? AND monitor_id IN ? AND group = ?",
          "primary_tag_name": "datacenter",
          "primary_tag_value": "edge-eu1.prod.dog"
        }
      ],
      "to": 1636629071000
    },
    "type": "timeseries_request"
  }
}
```

{% /tab %}

### Response

{% tab title="200" %}
OK
{% tab title="Model" %}
A message containing one response to a timeseries query made with timeseries formula query request.

| Parent field | Field        | Type      | Description                                                                                                                                                                                                                                                                              |
| ------------ | ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|              | data         | object    | A message containing the response to a timeseries query.                                                                                                                                                                                                                                 |
| data         | attributes   | object    | The object describing a timeseries response.                                                                                                                                                                                                                                             |
| attributes   | series       | [object]  | Array of response series. The index here corresponds to the index in the `formulas` or `queries` array from the request.                                                                                                                                                                 |
| series       | group_tags   | [string]  | List of tags that apply to a single response value.                                                                                                                                                                                                                                      |
| series       | query_index  | int32     | The index of the query in the "formulas" array (or "queries" array if no "formulas" was specified).                                                                                                                                                                                      |
| series       | unit         | [object]  | Detailed information about the unit. The first element describes the "primary unit" (for example, `bytes` in `bytes per second`). The second element describes the "per unit" (for example, `second` in `bytes per second`). If the second element is not present, the API returns null. |
| unit         | family       | string    | Unit family, allows for conversion between units of the same family, for scaling.                                                                                                                                                                                                        |
| unit         | name         | string    | Unit name                                                                                                                                                                                                                                                                                |
| unit         | plural       | string    | Plural form of the unit name.                                                                                                                                                                                                                                                            |
| unit         | scale_factor | double    | Factor for scaling between units of the same family.                                                                                                                                                                                                                                     |
| unit         | short_name   | string    | Abbreviation of the unit.                                                                                                                                                                                                                                                                |
| attributes   | times        | [integer] | Array of times, 1-1 match with individual values arrays.                                                                                                                                                                                                                                 |
| attributes   | values       | [array]   | Array of value-arrays. The index here corresponds to the index in the `formulas` or `queries` array from the request.                                                                                                                                                                    |
| data         | type         | enum      | The type of the resource. The value should always be timeseries_response. Allowed enum values: `timeseries_response`                                                                                                                                                                     |
|              | errors       | string    | The error generated by the request.                                                                                                                                                                                                                                                      |

{% /tab %}

{% tab title="Example" %}

```json
{
  "data": {
    "attributes": {
      "series": [
        {
          "group_tags": [
            "env:production"
          ],
          "query_index": 0,
          "unit": [
            {
              "family": "time",
              "name": "minute",
              "plural": "minutes",
              "scale_factor": 60,
              "short_name": "min"
            }
          ]
        }
      ],
      "times": [],
      "values": [
        1575317847,
        0.5
      ]
    },
    "type": "timeseries_response"
  },
  "errors": "string"
}
```

{% /tab %}

{% /tab %}

{% tab title="400" %}
Bad Request
{% tab title="Model" %}
API error response.

| Field                    | Type     | Description       |
| ------------------------ | -------- | ----------------- |
| errors [*required*] | [string] | A list of errors. |

{% /tab %}

{% tab title="Example" %}

```json
{
  "errors": [
    "Bad Request"
  ]
}
```

{% /tab %}

{% /tab %}

{% tab title="401" %}
Unauthorized
{% tab title="Model" %}
API error response.

| Field                    | Type     | Description       |
| ------------------------ | -------- | ----------------- |
| errors [*required*] | [string] | A list of errors. |

{% /tab %}

{% tab title="Example" %}

```json
{
  "errors": [
    "Bad Request"
  ]
}
```

{% /tab %}

{% /tab %}

{% tab title="403" %}
Forbidden
{% tab title="Model" %}
API error response.

| Field                    | Type     | Description       |
| ------------------------ | -------- | ----------------- |
| errors [*required*] | [string] | A list of errors. |

{% /tab %}

{% tab title="Example" %}

```json
{
  "errors": [
    "Bad Request"
  ]
}
```

{% /tab %}

{% /tab %}

{% tab title="429" %}
Too many requests
{% tab title="Model" %}
API error response.

| Field                    | Type     | Description       |
| ------------------------ | -------- | ----------------- |
| errors [*required*] | [string] | A list of errors. |

{% /tab %}

{% tab title="Example" %}

```json
{
  "errors": [
    "Bad Request"
  ]
}
```

{% /tab %}

{% /tab %}

### Code Example

##### 
                          \## default
# 
 \# Curl command curl -X POST "https://api.datadoghq.com/api/v2/query/timeseries" \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
-d @- << EOF
{
  "data": {
    "attributes": {
      "formulas": [
        {
          "formula": "a+b",
          "limit": {
            "count": 10
          }
        }
      ],
      "from": 1568899800000,
      "interval": 5000,
      "queries": [
        {
          "data_source": "metrics",
          "query": "avg:system.cpu.user{*} by {env}"
        }
      ],
      "to": 1568923200000
    },
    "type": "timeseries_request"
  }
}
EOF 
                        
##### 
                          \## default
# 
 \# Curl command curl -X POST "https://api.datadoghq.com/api/v2/query/timeseries" \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
-d @- << EOF
{
  "data": {
    "attributes": {
      "formulas": [
        {
          "formula": "a+b",
          "limit": {
            "count": 10
          }
        }
      ],
      "from": 1568899800000,
      "interval": 5000,
      "queries": [
        {
          "data_source": "metrics",
          "query": "avg:system.cpu.user{*} by {env}"
        }
      ],
      "to": 1568923200000
    },
    "type": "timeseries_request"
  }
}
EOF 
                        
##### 
                          \## default
# 
 \# Curl command curl -X POST "https://api.datadoghq.com/api/v2/query/timeseries" \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
-d @- << EOF
{
  "data": {
    "attributes": {
      "formulas": [
        {
          "formula": "a+b",
          "limit": {
            "count": 10
          }
        }
      ],
      "from": 1568899800000,
      "interval": 5000,
      "queries": [
        {
          "data_source": "metrics",
          "query": "avg:system.cpu.user{*} by {env}"
        }
      ],
      "to": 1568923200000
    },
    "type": "timeseries_request"
  }
}
EOF 
                        
##### 

```go
// Timeseries cross product query returns "OK" response

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
)

func main() {
	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				Formulas: []datadogV2.QueryFormula{
					{
						Formula: "a",
						Limit: &datadogV2.FormulaLimit{
							Count: datadog.PtrInt32(10),
							Order: datadogV2.QUERYSORTORDER_DESC.Ptr(),
						},
					},
				},
				From:     1636625471000,
				Interval: datadog.PtrInt64(5000),
				Queries: []datadogV2.TimeseriesQuery{
					datadogV2.TimeseriesQuery{
						MetricsTimeseriesQuery: &datadogV2.MetricsTimeseriesQuery{
							DataSource: datadogV2.METRICSDATASOURCE_METRICS,
							Query:      "avg:datadog.estimated_usage.metrics.custom{*}",
							Name:       datadog.PtrString("a"),
						}},
				},
				To: 1636629071000,
			},
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
		},
	}
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewMetricsApi(apiClient)
	resp, r, err := api.QueryTimeseriesData(ctx, body)

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MetricsApi.QueryTimeseriesData`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `MetricsApi.QueryTimeseriesData`:\n%s\n", responseContent)
}
```

##### 

```go
// Timeseries cross product query with RUM data source returns "OK" response

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
)

func main() {
	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				Formulas: []datadogV2.QueryFormula{
					{
						Formula: "a",
						Limit: &datadogV2.FormulaLimit{
							Count: datadog.PtrInt32(10),
							Order: datadogV2.QUERYSORTORDER_DESC.Ptr(),
						},
					},
				},
				From:     1636625471000,
				Interval: datadog.PtrInt64(5000),
				Queries: []datadogV2.TimeseriesQuery{
					datadogV2.TimeseriesQuery{
						EventsTimeseriesQuery: &datadogV2.EventsTimeseriesQuery{
							DataSource: datadogV2.EVENTSDATASOURCE_RUM,
							Name:       datadog.PtrString("a"),
							Compute: datadogV2.EventsCompute{
								Aggregation: datadogV2.EVENTSAGGREGATION_COUNT,
							},
							Search: &datadogV2.EventsSearch{
								Query: datadog.PtrString("*"),
							},
							Indexes: []string{
								"*",
							},
						}},
				},
				To: 1636629071000,
			},
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
		},
	}
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewMetricsApi(apiClient)
	resp, r, err := api.QueryTimeseriesData(ctx, body)

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MetricsApi.QueryTimeseriesData`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `MetricsApi.QueryTimeseriesData`:\n%s\n", responseContent)
}
```

##### 

```go
// Timeseries cross product query with apm_dependency_stats data source returns "OK" response

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
)

func main() {
	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				Formulas: []datadogV2.QueryFormula{
					{
						Formula: "a",
						Limit: &datadogV2.FormulaLimit{
							Count: datadog.PtrInt32(10),
							Order: datadogV2.QUERYSORTORDER_DESC.Ptr(),
						},
					},
				},
				From:     1636625471000,
				Interval: datadog.PtrInt64(5000),
				Queries: []datadogV2.TimeseriesQuery{
					datadogV2.TimeseriesQuery{
						ApmDependencyStatsQuery: &datadogV2.ApmDependencyStatsQuery{
							DataSource:      datadogV2.APMDEPENDENCYSTATSDATASOURCE_APM_DEPENDENCY_STATS,
							Name:            "a",
							Env:             "ci",
							Service:         "cassandra",
							Stat:            datadogV2.APMDEPENDENCYSTATNAME_AVG_DURATION,
							OperationName:   "cassandra.query",
							ResourceName:    "DELETE FROM monitor_history.monitor_state_change_history WHERE org_id = ? AND monitor_id IN ? AND group = ?",
							PrimaryTagName:  datadog.PtrString("datacenter"),
							PrimaryTagValue: datadog.PtrString("edge-eu1.prod.dog"),
						}},
				},
				To: 1636629071000,
			},
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
		},
	}
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewMetricsApi(apiClient)
	resp, r, err := api.QueryTimeseriesData(ctx, body)

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MetricsApi.QueryTimeseriesData`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `MetricsApi.QueryTimeseriesData`:\n%s\n", responseContent)
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=go) and then save the example to `main.go` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" go run "main.go"
##### 

```java
// Timeseries cross product query returns "OK" response

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v2.api.MetricsApi;
import com.datadog.api.client.v2.model.FormulaLimit;
import com.datadog.api.client.v2.model.MetricsDataSource;
import com.datadog.api.client.v2.model.MetricsTimeseriesQuery;
import com.datadog.api.client.v2.model.QueryFormula;
import com.datadog.api.client.v2.model.QuerySortOrder;
import com.datadog.api.client.v2.model.TimeseriesFormulaQueryRequest;
import com.datadog.api.client.v2.model.TimeseriesFormulaQueryResponse;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequest;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequestAttributes;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequestType;
import com.datadog.api.client.v2.model.TimeseriesQuery;
import java.util.Collections;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    MetricsApi apiInstance = new MetricsApi(defaultClient);

    TimeseriesFormulaQueryRequest body =
        new TimeseriesFormulaQueryRequest()
            .data(
                new TimeseriesFormulaRequest()
                    .attributes(
                        new TimeseriesFormulaRequestAttributes()
                            .formulas(
                                Collections.singletonList(
                                    new QueryFormula()
                                        .formula("a")
                                        .limit(
                                            new FormulaLimit()
                                                .count(10)
                                                .order(QuerySortOrder.DESC))))
                            .from(1636625471000L)
                            .interval(5000L)
                            .queries(
                                Collections.singletonList(
                                    new TimeseriesQuery(
                                        new MetricsTimeseriesQuery()
                                            .dataSource(MetricsDataSource.METRICS)
                                            .query("avg:datadog.estimated_usage.metrics.custom{*}")
                                            .name("a"))))
                            .to(1636629071000L))
                    .type(TimeseriesFormulaRequestType.TIMESERIES_REQUEST));

    try {
      TimeseriesFormulaQueryResponse result = apiInstance.queryTimeseriesData(body);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MetricsApi#queryTimeseriesData");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

##### 

```java
// Timeseries cross product query with RUM data source returns "OK" response

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v2.api.MetricsApi;
import com.datadog.api.client.v2.model.EventsAggregation;
import com.datadog.api.client.v2.model.EventsCompute;
import com.datadog.api.client.v2.model.EventsDataSource;
import com.datadog.api.client.v2.model.EventsSearch;
import com.datadog.api.client.v2.model.EventsTimeseriesQuery;
import com.datadog.api.client.v2.model.FormulaLimit;
import com.datadog.api.client.v2.model.QueryFormula;
import com.datadog.api.client.v2.model.QuerySortOrder;
import com.datadog.api.client.v2.model.TimeseriesFormulaQueryRequest;
import com.datadog.api.client.v2.model.TimeseriesFormulaQueryResponse;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequest;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequestAttributes;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequestType;
import com.datadog.api.client.v2.model.TimeseriesQuery;
import java.util.Collections;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    MetricsApi apiInstance = new MetricsApi(defaultClient);

    TimeseriesFormulaQueryRequest body =
        new TimeseriesFormulaQueryRequest()
            .data(
                new TimeseriesFormulaRequest()
                    .attributes(
                        new TimeseriesFormulaRequestAttributes()
                            .formulas(
                                Collections.singletonList(
                                    new QueryFormula()
                                        .formula("a")
                                        .limit(
                                            new FormulaLimit()
                                                .count(10)
                                                .order(QuerySortOrder.DESC))))
                            .from(1636625471000L)
                            .interval(5000L)
                            .queries(
                                Collections.singletonList(
                                    new TimeseriesQuery(
                                        new EventsTimeseriesQuery()
                                            .dataSource(EventsDataSource.RUM)
                                            .name("a")
                                            .compute(
                                                new EventsCompute()
                                                    .aggregation(EventsAggregation.COUNT))
                                            .search(new EventsSearch().query("*"))
                                            .indexes(Collections.singletonList("*")))))
                            .to(1636629071000L))
                    .type(TimeseriesFormulaRequestType.TIMESERIES_REQUEST));

    try {
      TimeseriesFormulaQueryResponse result = apiInstance.queryTimeseriesData(body);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MetricsApi#queryTimeseriesData");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

##### 

```java
// Timeseries cross product query with apm_dependency_stats data source returns "OK" response

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v2.api.MetricsApi;
import com.datadog.api.client.v2.model.ApmDependencyStatName;
import com.datadog.api.client.v2.model.ApmDependencyStatsDataSource;
import com.datadog.api.client.v2.model.ApmDependencyStatsQuery;
import com.datadog.api.client.v2.model.FormulaLimit;
import com.datadog.api.client.v2.model.QueryFormula;
import com.datadog.api.client.v2.model.QuerySortOrder;
import com.datadog.api.client.v2.model.TimeseriesFormulaQueryRequest;
import com.datadog.api.client.v2.model.TimeseriesFormulaQueryResponse;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequest;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequestAttributes;
import com.datadog.api.client.v2.model.TimeseriesFormulaRequestType;
import com.datadog.api.client.v2.model.TimeseriesQuery;
import java.util.Collections;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    MetricsApi apiInstance = new MetricsApi(defaultClient);

    TimeseriesFormulaQueryRequest body =
        new TimeseriesFormulaQueryRequest()
            .data(
                new TimeseriesFormulaRequest()
                    .attributes(
                        new TimeseriesFormulaRequestAttributes()
                            .formulas(
                                Collections.singletonList(
                                    new QueryFormula()
                                        .formula("a")
                                        .limit(
                                            new FormulaLimit()
                                                .count(10)
                                                .order(QuerySortOrder.DESC))))
                            .from(1636625471000L)
                            .interval(5000L)
                            .queries(
                                Collections.singletonList(
                                    new TimeseriesQuery(
                                        new ApmDependencyStatsQuery()
                                            .dataSource(
                                                ApmDependencyStatsDataSource.APM_DEPENDENCY_STATS)
                                            .name("a")
                                            .env("ci")
                                            .service("cassandra")
                                            .stat(ApmDependencyStatName.AVG_DURATION)
                                            .operationName("cassandra.query")
                                            .resourceName(
                                                "DELETE FROM"
                                                    + " monitor_history.monitor_state_change_history"
                                                    + " WHERE org_id = ? AND monitor_id IN ? AND"
                                                    + " group = ?")
                                            .primaryTagName("datacenter")
                                            .primaryTagValue("edge-eu1.prod.dog"))))
                            .to(1636629071000L))
                    .type(TimeseriesFormulaRequestType.TIMESERIES_REQUEST));

    try {
      TimeseriesFormulaQueryResponse result = apiInstance.queryTimeseriesData(body);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MetricsApi#queryTimeseriesData");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=java) and then save the example to `Example.java` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" java "Example.java"
##### 

```python
"""
Timeseries cross product query returns "OK" response
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.metrics_api import MetricsApi
from datadog_api_client.v2.model.formula_limit import FormulaLimit
from datadog_api_client.v2.model.metrics_data_source import MetricsDataSource
from datadog_api_client.v2.model.metrics_timeseries_query import MetricsTimeseriesQuery
from datadog_api_client.v2.model.query_formula import QueryFormula
from datadog_api_client.v2.model.query_sort_order import QuerySortOrder
from datadog_api_client.v2.model.timeseries_formula_query_request import TimeseriesFormulaQueryRequest
from datadog_api_client.v2.model.timeseries_formula_request import TimeseriesFormulaRequest
from datadog_api_client.v2.model.timeseries_formula_request_attributes import TimeseriesFormulaRequestAttributes
from datadog_api_client.v2.model.timeseries_formula_request_queries import TimeseriesFormulaRequestQueries
from datadog_api_client.v2.model.timeseries_formula_request_type import TimeseriesFormulaRequestType

body = TimeseriesFormulaQueryRequest(
    data=TimeseriesFormulaRequest(
        attributes=TimeseriesFormulaRequestAttributes(
            formulas=[
                QueryFormula(
                    formula="a",
                    limit=FormulaLimit(
                        count=10,
                        order=QuerySortOrder.DESC,
                    ),
                ),
            ],
            _from=1636625471000,
            interval=5000,
            queries=TimeseriesFormulaRequestQueries(
                [
                    MetricsTimeseriesQuery(
                        data_source=MetricsDataSource.METRICS,
                        query="avg:datadog.estimated_usage.metrics.custom{*}",
                        name="a",
                    ),
                ]
            ),
            to=1636629071000,
        ),
        type=TimeseriesFormulaRequestType.TIMESERIES_REQUEST,
    ),
)

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = MetricsApi(api_client)
    response = api_instance.query_timeseries_data(body=body)

    print(response)
```

##### 

```python
"""
Timeseries cross product query with RUM data source returns "OK" response
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.metrics_api import MetricsApi
from datadog_api_client.v2.model.events_aggregation import EventsAggregation
from datadog_api_client.v2.model.events_compute import EventsCompute
from datadog_api_client.v2.model.events_data_source import EventsDataSource
from datadog_api_client.v2.model.events_search import EventsSearch
from datadog_api_client.v2.model.events_timeseries_query import EventsTimeseriesQuery
from datadog_api_client.v2.model.formula_limit import FormulaLimit
from datadog_api_client.v2.model.query_formula import QueryFormula
from datadog_api_client.v2.model.query_sort_order import QuerySortOrder
from datadog_api_client.v2.model.timeseries_formula_query_request import TimeseriesFormulaQueryRequest
from datadog_api_client.v2.model.timeseries_formula_request import TimeseriesFormulaRequest
from datadog_api_client.v2.model.timeseries_formula_request_attributes import TimeseriesFormulaRequestAttributes
from datadog_api_client.v2.model.timeseries_formula_request_queries import TimeseriesFormulaRequestQueries
from datadog_api_client.v2.model.timeseries_formula_request_type import TimeseriesFormulaRequestType

body = TimeseriesFormulaQueryRequest(
    data=TimeseriesFormulaRequest(
        attributes=TimeseriesFormulaRequestAttributes(
            formulas=[
                QueryFormula(
                    formula="a",
                    limit=FormulaLimit(
                        count=10,
                        order=QuerySortOrder.DESC,
                    ),
                ),
            ],
            _from=1636625471000,
            interval=5000,
            queries=TimeseriesFormulaRequestQueries(
                [
                    EventsTimeseriesQuery(
                        data_source=EventsDataSource.RUM,
                        name="a",
                        compute=EventsCompute(
                            aggregation=EventsAggregation.COUNT,
                        ),
                        search=EventsSearch(
                            query="*",
                        ),
                        indexes=[
                            "*",
                        ],
                    ),
                ]
            ),
            to=1636629071000,
        ),
        type=TimeseriesFormulaRequestType.TIMESERIES_REQUEST,
    ),
)

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = MetricsApi(api_client)
    response = api_instance.query_timeseries_data(body=body)

    print(response)
```

##### 

```python
"""
Timeseries cross product query with apm_dependency_stats data source returns "OK" response
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.metrics_api import MetricsApi
from datadog_api_client.v2.model.apm_dependency_stat_name import ApmDependencyStatName
from datadog_api_client.v2.model.apm_dependency_stats_data_source import ApmDependencyStatsDataSource
from datadog_api_client.v2.model.apm_dependency_stats_query import ApmDependencyStatsQuery
from datadog_api_client.v2.model.formula_limit import FormulaLimit
from datadog_api_client.v2.model.query_formula import QueryFormula
from datadog_api_client.v2.model.query_sort_order import QuerySortOrder
from datadog_api_client.v2.model.timeseries_formula_query_request import TimeseriesFormulaQueryRequest
from datadog_api_client.v2.model.timeseries_formula_request import TimeseriesFormulaRequest
from datadog_api_client.v2.model.timeseries_formula_request_attributes import TimeseriesFormulaRequestAttributes
from datadog_api_client.v2.model.timeseries_formula_request_queries import TimeseriesFormulaRequestQueries
from datadog_api_client.v2.model.timeseries_formula_request_type import TimeseriesFormulaRequestType

body = TimeseriesFormulaQueryRequest(
    data=TimeseriesFormulaRequest(
        attributes=TimeseriesFormulaRequestAttributes(
            formulas=[
                QueryFormula(
                    formula="a",
                    limit=FormulaLimit(
                        count=10,
                        order=QuerySortOrder.DESC,
                    ),
                ),
            ],
            _from=1636625471000,
            interval=5000,
            queries=TimeseriesFormulaRequestQueries(
                [
                    ApmDependencyStatsQuery(
                        data_source=ApmDependencyStatsDataSource.APM_DEPENDENCY_STATS,
                        name="a",
                        env="ci",
                        service="cassandra",
                        stat=ApmDependencyStatName.AVG_DURATION,
                        operation_name="cassandra.query",
                        resource_name="DELETE FROM monitor_history.monitor_state_change_history WHERE org_id = ? AND monitor_id IN ? AND group = ?",
                        primary_tag_name="datacenter",
                        primary_tag_value="edge-eu1.prod.dog",
                    ),
                ]
            ),
            to=1636629071000,
        ),
        type=TimeseriesFormulaRequestType.TIMESERIES_REQUEST,
    ),
)

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = MetricsApi(api_client)
    response = api_instance.query_timeseries_data(body=body)

    print(response)
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=python) and then save the example to `example.py` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" python3 "example.py"
##### 

```ruby
# Timeseries cross product query returns "OK" response

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::MetricsAPI.new

body = DatadogAPIClient::V2::TimeseriesFormulaQueryRequest.new({
  data: DatadogAPIClient::V2::TimeseriesFormulaRequest.new({
    attributes: DatadogAPIClient::V2::TimeseriesFormulaRequestAttributes.new({
      formulas: [
        DatadogAPIClient::V2::QueryFormula.new({
          formula: "a",
          limit: DatadogAPIClient::V2::FormulaLimit.new({
            count: 10,
            order: DatadogAPIClient::V2::QuerySortOrder::DESC,
          }),
        }),
      ],
      from: 1636625471000,
      interval: 5000,
      queries: [
        DatadogAPIClient::V2::MetricsTimeseriesQuery.new({
          data_source: DatadogAPIClient::V2::MetricsDataSource::METRICS,
          query: "avg:datadog.estimated_usage.metrics.custom{*}",
          name: "a",
        }),
      ],
      to: 1636629071000,
    }),
    type: DatadogAPIClient::V2::TimeseriesFormulaRequestType::TIMESERIES_REQUEST,
  }),
})
p api_instance.query_timeseries_data(body)
```

##### 

```ruby
# Timeseries cross product query with RUM data source returns "OK" response

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::MetricsAPI.new

body = DatadogAPIClient::V2::TimeseriesFormulaQueryRequest.new({
  data: DatadogAPIClient::V2::TimeseriesFormulaRequest.new({
    attributes: DatadogAPIClient::V2::TimeseriesFormulaRequestAttributes.new({
      formulas: [
        DatadogAPIClient::V2::QueryFormula.new({
          formula: "a",
          limit: DatadogAPIClient::V2::FormulaLimit.new({
            count: 10,
            order: DatadogAPIClient::V2::QuerySortOrder::DESC,
          }),
        }),
      ],
      from: 1636625471000,
      interval: 5000,
      queries: [
        DatadogAPIClient::V2::EventsTimeseriesQuery.new({
          data_source: DatadogAPIClient::V2::EventsDataSource::RUM,
          name: "a",
          compute: DatadogAPIClient::V2::EventsCompute.new({
            aggregation: DatadogAPIClient::V2::EventsAggregation::COUNT,
          }),
          search: DatadogAPIClient::V2::EventsSearch.new({
            query: "*",
          }),
          indexes: [
            "*",
          ],
        }),
      ],
      to: 1636629071000,
    }),
    type: DatadogAPIClient::V2::TimeseriesFormulaRequestType::TIMESERIES_REQUEST,
  }),
})
p api_instance.query_timeseries_data(body)
```

##### 

```ruby
# Timeseries cross product query with apm_dependency_stats data source returns "OK" response

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::MetricsAPI.new

body = DatadogAPIClient::V2::TimeseriesFormulaQueryRequest.new({
  data: DatadogAPIClient::V2::TimeseriesFormulaRequest.new({
    attributes: DatadogAPIClient::V2::TimeseriesFormulaRequestAttributes.new({
      formulas: [
        DatadogAPIClient::V2::QueryFormula.new({
          formula: "a",
          limit: DatadogAPIClient::V2::FormulaLimit.new({
            count: 10,
            order: DatadogAPIClient::V2::QuerySortOrder::DESC,
          }),
        }),
      ],
      from: 1636625471000,
      interval: 5000,
      queries: [
        DatadogAPIClient::V2::ApmDependencyStatsQuery.new({
          data_source: DatadogAPIClient::V2::ApmDependencyStatsDataSource::APM_DEPENDENCY_STATS,
          name: "a",
          env: "ci",
          service: "cassandra",
          stat: DatadogAPIClient::V2::ApmDependencyStatName::AVG_DURATION,
          operation_name: "cassandra.query",
          resource_name: "DELETE FROM monitor_history.monitor_state_change_history WHERE org_id = ? AND monitor_id IN ? AND group = ?",
          primary_tag_name: "datacenter",
          primary_tag_value: "edge-eu1.prod.dog",
        }),
      ],
      to: 1636629071000,
    }),
    type: DatadogAPIClient::V2::TimeseriesFormulaRequestType::TIMESERIES_REQUEST,
  }),
})
p api_instance.query_timeseries_data(body)
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=ruby) and then save the example to `example.rb` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" rb "example.rb"
##### 

```rust
// Timeseries cross product query returns "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_metrics::MetricsAPI;
use datadog_api_client::datadogV2::model::FormulaLimit;
use datadog_api_client::datadogV2::model::MetricsDataSource;
use datadog_api_client::datadogV2::model::MetricsTimeseriesQuery;
use datadog_api_client::datadogV2::model::QueryFormula;
use datadog_api_client::datadogV2::model::QuerySortOrder;
use datadog_api_client::datadogV2::model::TimeseriesFormulaQueryRequest;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequest;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequestAttributes;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequestType;
use datadog_api_client::datadogV2::model::TimeseriesQuery;

#[tokio::main]
async fn main() {
    let body = TimeseriesFormulaQueryRequest::new(TimeseriesFormulaRequest::new(
        TimeseriesFormulaRequestAttributes::new(
            1636625471000,
            vec![TimeseriesQuery::MetricsTimeseriesQuery(Box::new(
                MetricsTimeseriesQuery::new(
                    MetricsDataSource::METRICS,
                    "avg:datadog.estimated_usage.metrics.custom{*}".to_string(),
                )
                .name("a".to_string()),
            ))],
            1636629071000,
        )
        .formulas(vec![QueryFormula::new("a".to_string())
            .limit(FormulaLimit::new().count(10).order(QuerySortOrder::DESC))])
        .interval(5000),
        TimeseriesFormulaRequestType::TIMESERIES_REQUEST,
    ));
    let configuration = datadog::Configuration::new();
    let api = MetricsAPI::with_config(configuration);
    let resp = api.query_timeseries_data(body).await;
    if let Ok(value) = resp {
        println!("{:#?}", value);
    } else {
        println!("{:#?}", resp.unwrap_err());
    }
}
```

##### 

```rust
// Timeseries cross product query with RUM data source returns "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_metrics::MetricsAPI;
use datadog_api_client::datadogV2::model::EventsAggregation;
use datadog_api_client::datadogV2::model::EventsCompute;
use datadog_api_client::datadogV2::model::EventsDataSource;
use datadog_api_client::datadogV2::model::EventsSearch;
use datadog_api_client::datadogV2::model::EventsTimeseriesQuery;
use datadog_api_client::datadogV2::model::FormulaLimit;
use datadog_api_client::datadogV2::model::QueryFormula;
use datadog_api_client::datadogV2::model::QuerySortOrder;
use datadog_api_client::datadogV2::model::TimeseriesFormulaQueryRequest;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequest;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequestAttributes;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequestType;
use datadog_api_client::datadogV2::model::TimeseriesQuery;

#[tokio::main]
async fn main() {
    let body = TimeseriesFormulaQueryRequest::new(TimeseriesFormulaRequest::new(
        TimeseriesFormulaRequestAttributes::new(
            1636625471000,
            vec![TimeseriesQuery::EventsTimeseriesQuery(Box::new(
                EventsTimeseriesQuery::new(
                    EventsCompute::new(EventsAggregation::COUNT),
                    EventsDataSource::RUM,
                )
                .indexes(vec!["*".to_string()])
                .name("a".to_string())
                .search(EventsSearch::new().query("*".to_string())),
            ))],
            1636629071000,
        )
        .formulas(vec![QueryFormula::new("a".to_string())
            .limit(FormulaLimit::new().count(10).order(QuerySortOrder::DESC))])
        .interval(5000),
        TimeseriesFormulaRequestType::TIMESERIES_REQUEST,
    ));
    let configuration = datadog::Configuration::new();
    let api = MetricsAPI::with_config(configuration);
    let resp = api.query_timeseries_data(body).await;
    if let Ok(value) = resp {
        println!("{:#?}", value);
    } else {
        println!("{:#?}", resp.unwrap_err());
    }
}
```

##### 

```rust
// Timeseries cross product query with apm_dependency_stats data source returns
// "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_metrics::MetricsAPI;
use datadog_api_client::datadogV2::model::ApmDependencyStatName;
use datadog_api_client::datadogV2::model::ApmDependencyStatsDataSource;
use datadog_api_client::datadogV2::model::ApmDependencyStatsQuery;
use datadog_api_client::datadogV2::model::FormulaLimit;
use datadog_api_client::datadogV2::model::QueryFormula;
use datadog_api_client::datadogV2::model::QuerySortOrder;
use datadog_api_client::datadogV2::model::TimeseriesFormulaQueryRequest;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequest;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequestAttributes;
use datadog_api_client::datadogV2::model::TimeseriesFormulaRequestType;
use datadog_api_client::datadogV2::model::TimeseriesQuery;

#[tokio::main]
async fn main() {
    let body =
        TimeseriesFormulaQueryRequest::new(
            TimeseriesFormulaRequest::new(
                TimeseriesFormulaRequestAttributes::new(
                    1636625471000,
                    vec![
                        TimeseriesQuery::ApmDependencyStatsQuery(
                            Box::new(
                                ApmDependencyStatsQuery::new(
                                    ApmDependencyStatsDataSource::APM_DEPENDENCY_STATS,
                                    "ci".to_string(),
                                    "a".to_string(),
                                    "cassandra.query".to_string(),
                                    "DELETE FROM monitor_history.monitor_state_change_history WHERE org_id = ? AND monitor_id IN ? AND group = ?".to_string(),
                                    "cassandra".to_string(),
                                    ApmDependencyStatName::AVG_DURATION,
                                )
                                    .primary_tag_name("datacenter".to_string())
                                    .primary_tag_value("edge-eu1.prod.dog".to_string()),
                            ),
                        )
                    ],
                    1636629071000,
                )
                    .formulas(
                        vec![
                            QueryFormula::new(
                                "a".to_string(),
                            ).limit(FormulaLimit::new().count(10).order(QuerySortOrder::DESC))
                        ],
                    )
                    .interval(5000),
                TimeseriesFormulaRequestType::TIMESERIES_REQUEST,
            ),
        );
    let configuration = datadog::Configuration::new();
    let api = MetricsAPI::with_config(configuration);
    let resp = api.query_timeseries_data(body).await;
    if let Ok(value) = resp {
        println!("{:#?}", value);
    } else {
        println!("{:#?}", resp.unwrap_err());
    }
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=rust) and then save the example to `src/main.rs` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" cargo run
##### 

```typescript
/**
 * Timeseries cross product query returns "OK" response
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.MetricsApi(configuration);

const params: v2.MetricsApiQueryTimeseriesDataRequest = {
  body: {
    data: {
      attributes: {
        formulas: [
          {
            formula: "a",
            limit: {
              count: 10,
              order: "desc",
            },
          },
        ],
        from: 1636625471000,
        interval: 5000,
        queries: [
          {
            dataSource: "metrics",
            query: "avg:datadog.estimated_usage.metrics.custom{*}",
            name: "a",
          },
        ],
        to: 1636629071000,
      },
      type: "timeseries_request",
    },
  },
};

apiInstance
  .queryTimeseriesData(params)
  .then((data: v2.TimeseriesFormulaQueryResponse) => {
    console.log(
      "API called successfully. Returned data: " + JSON.stringify(data)
    );
  })
  .catch((error: any) => console.error(error));
```

##### 

```typescript
/**
 * Timeseries cross product query with RUM data source returns "OK" response
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.MetricsApi(configuration);

const params: v2.MetricsApiQueryTimeseriesDataRequest = {
  body: {
    data: {
      attributes: {
        formulas: [
          {
            formula: "a",
            limit: {
              count: 10,
              order: "desc",
            },
          },
        ],
        from: 1636625471000,
        interval: 5000,
        queries: [
          {
            dataSource: "rum",
            name: "a",
            compute: {
              aggregation: "count",
            },
            search: {
              query: "*",
            },
            indexes: ["*"],
          },
        ],
        to: 1636629071000,
      },
      type: "timeseries_request",
    },
  },
};

apiInstance
  .queryTimeseriesData(params)
  .then((data: v2.TimeseriesFormulaQueryResponse) => {
    console.log(
      "API called successfully. Returned data: " + JSON.stringify(data)
    );
  })
  .catch((error: any) => console.error(error));
```

##### 

```typescript
/**
 * Timeseries cross product query with apm_dependency_stats data source returns "OK" response
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.MetricsApi(configuration);

const params: v2.MetricsApiQueryTimeseriesDataRequest = {
  body: {
    data: {
      attributes: {
        formulas: [
          {
            formula: "a",
            limit: {
              count: 10,
              order: "desc",
            },
          },
        ],
        from: 1636625471000,
        interval: 5000,
        queries: [
          {
            dataSource: "apm_dependency_stats",
            name: "a",
            env: "ci",
            service: "cassandra",
            stat: "avg_duration",
            operationName: "cassandra.query",
            resourceName:
              "DELETE FROM monitor_history.monitor_state_change_history WHERE org_id = ? AND monitor_id IN ? AND group = ?",
            primaryTagName: "datacenter",
            primaryTagValue: "edge-eu1.prod.dog",
          },
        ],
        to: 1636629071000,
      },
      type: "timeseries_request",
    },
  },
};

apiInstance
  .queryTimeseriesData(params)
  .then((data: v2.TimeseriesFormulaQueryResponse) => {
    console.log(
      "API called successfully. Returned data: " + JSON.stringify(data)
    );
  })
  .catch((error: any) => console.error(error));
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=typescript) and then save the example to `example.ts` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" tsc "example.ts"
{% /tab %}
