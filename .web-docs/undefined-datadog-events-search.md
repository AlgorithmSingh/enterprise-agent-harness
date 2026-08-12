# Datadog — Events API: Search events (POST /api/v2/events/search)

- Source URL: https://docs.datadoghq.com/api/latest/events/search-events.md
- Accessed: 2026-08-12 (native vendor markdown mirror served by docs.datadoghq.com, fetched verbatim with curl)

---
title: Search events
description: Datadog, the leading service for cloud-scale monitoring.
breadcrumbs: Docs > API Reference > Events
---

> For the complete documentation index, see [llms.txt](https://docs.datadoghq.com/llms.txt).

# Search events{% #search-events %}
Copy pageCopied
{% tab title="v2" %}

| Datadog site      | API endpoint                                            |
| ----------------- | ------------------------------------------------------- |
| ap1.datadoghq.com | POST https://api.ap1.datadoghq.com/api/v2/events/search |
| ap2.datadoghq.com | POST https://api.ap2.datadoghq.com/api/v2/events/search |
| app.datadoghq.eu  | POST https://api.datadoghq.eu/api/v2/events/search      |
| app.ddog-gov.com  | POST https://api.ddog-gov.com/api/v2/events/search      |
| us2.ddog-gov.com  | POST https://api.us2.ddog-gov.com/api/v2/events/search  |
| uk1.datadoghq.com | POST https://api.uk1.datadoghq.com/api/v2/events/search |
| app.datadoghq.com | POST https://api.datadoghq.com/api/v2/events/search     |
| us3.datadoghq.com | POST https://api.us3.datadoghq.com/api/v2/events/search |
| us5.datadoghq.com | POST https://api.us5.datadoghq.com/api/v2/events/search |

### Overview



List endpoint returns events that match an events search query. [Results are paginated similarly to logs](https://docs.datadoghq.com/logs/guide/collect-multiple-logs-with-pagination.md).

Use this endpoint to build complex events filtering and search.
This endpoint requires the `events_read` permission.


### Request

#### Body Data 



{% tab title="Model" %}

| Parent field | Field      | Type   | Description                                                                                                                               |
| ------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
|              | filter     | object | The search and filter query settings.                                                                                                     |
| filter       | from       | string | The minimum time for the requested events. Supports date math and regular timestamps in milliseconds.                                     |
| filter       | query      | string | The search query following the event search syntax.                                                                                       |
| filter       | to         | string | The maximum time for the requested events. Supports date math and regular timestamps in milliseconds.                                     |
|              | options    | object | The global query options that are used. Either provide a timezone or a time offset but not both, otherwise the query fails.               |
| options      | timeOffset | int64  | The time offset to apply to the query in seconds.                                                                                         |
| options      | timezone   | string | The timezone can be specified as GMT, UTC, an offset from UTC (like UTC+1), or as a Timezone Database identifier (like America/New_York). |
|              | page       | object | Pagination settings.                                                                                                                      |
| page         | cursor     | string | The returned paging point to use to get the next results.                                                                                 |
| page         | limit      | int32  | The maximum number of logs in the response.                                                                                               |
|              | sort       | enum   | The sort parameters when querying events. Allowed enum values: `timestamp,-timestamp`                                                     |

{% /tab %}

{% tab title="Example" %}
##### 

```json
{
  "filter": {
    "query": "datadog-agent",
    "from": "2020-09-17T11:48:36+01:00",
    "to": "2020-09-17T12:48:36+01:00"
  },
  "sort": "timestamp",
  "page": {
    "limit": 5
  }
}
```

##### 

```json
{
  "filter": {
    "from": "now-15m",
    "to": "now"
  },
  "options": {
    "timezone": "GMT"
  },
  "page": {
    "limit": 2
  },
  "sort": "timestamp"
}
```

{% /tab %}

### Response

{% tab title="200" %}
OK
{% tab title="Model" %}
The response object with all events matching the request and pagination information.

| Parent field | Field            | Type      | Description                                                                                                                                                                                                                                                                         |
| ------------ | ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|              | data             | [object]  | An array of events matching the request.                                                                                                                                                                                                                                            |
| data         | attributes       | object    | The object description of an event response attribute.                                                                                                                                                                                                                              |
| attributes   | attributes       | object    | Object description of attributes from your event.                                                                                                                                                                                                                                   |
| attributes   | aggregation_key  | string    | Aggregation key of the event.                                                                                                                                                                                                                                                       |
| attributes   | date_happened    | int64     | POSIX timestamp of the event. Must be sent as an integer (no quotation marks). Limited to events no older than 18 hours.                                                                                                                                                            |
| attributes   | device_name      | string    | A device name.                                                                                                                                                                                                                                                                      |
| attributes   | duration         | int64     | The duration between the triggering of the event and its recovery in nanoseconds.                                                                                                                                                                                                   |
| attributes   | event_object     | string    | The event title.                                                                                                                                                                                                                                                                    |
| attributes   | evt              | object    | The metadata associated with a request.                                                                                                                                                                                                                                             |
| evt          | id               | string    | Event ID.                                                                                                                                                                                                                                                                           |
| evt          | name             | string    | The event name.                                                                                                                                                                                                                                                                     |
| evt          | source_id        | int64     | Event source ID.                                                                                                                                                                                                                                                                    |
| evt          | type             | string    | Event type.                                                                                                                                                                                                                                                                         |
| attributes   | hostname         | string    | Host name to associate with the event. Any tags associated with the host are also applied to this event.                                                                                                                                                                            |
| attributes   | monitor          | object    | Attributes from the monitor that triggered the event.                                                                                                                                                                                                                               |
| monitor      | created_at       | int64     | The POSIX timestamp of the monitor's creation in nanoseconds.                                                                                                                                                                                                                       |
| monitor      | group_status     | int32     | Monitor group status used when there is no `result_groups`.                                                                                                                                                                                                                         |
| monitor      | groups           | [string]  | Groups to which the monitor belongs.                                                                                                                                                                                                                                                |
| monitor      | id               | int64     | The monitor ID.                                                                                                                                                                                                                                                                     |
| monitor      | message          | string    | The monitor message.                                                                                                                                                                                                                                                                |
| monitor      | modified         | int64     | The monitor's last-modified timestamp.                                                                                                                                                                                                                                              |
| monitor      | name             | string    | The monitor name.                                                                                                                                                                                                                                                                   |
| monitor      | query            | string    | The query that triggers the alert.                                                                                                                                                                                                                                                  |
| monitor      | tags             | [string]  | A list of tags attached to the monitor.                                                                                                                                                                                                                                             |
| monitor      | templated_name   | string    | The templated name of the monitor before resolving any template variables.                                                                                                                                                                                                          |
| monitor      | type             | string    | The monitor type.                                                                                                                                                                                                                                                                   |
| attributes   | monitor_groups   | [string]  | List of groups referred to in the event.                                                                                                                                                                                                                                            |
| attributes   | monitor_id       | int64     | ID of the monitor that triggered the event. When an event isn't related to a monitor, this field is empty.                                                                                                                                                                          |
| attributes   | priority         | enum      | The priority of the event's monitor. For example, `normal` or `low`. Allowed enum values: `normal,low`                                                                                                                                                                              |
| attributes   | related_event_id | int64     | Related event ID.                                                                                                                                                                                                                                                                   |
| attributes   | service          | string    | Service that triggered the event.                                                                                                                                                                                                                                                   |
| attributes   | source_type_name | string    | The type of event being posted. For example, `nagios`, `hudson`, `jenkins`, `my_apps`, `chef`, `puppet`, `git` or `bitbucket`. The list of standard source attribute values is [available here](https://docs.datadoghq.com/integrations/faq/list-of-api-source-attribute-value.md). |
| attributes   | sourcecategory   | string    | Identifier for the source of the event, such as a monitor alert, an externally-submitted event, or an integration.                                                                                                                                                                  |
| attributes   | status           | enum      | If an alert event is enabled, its status is one of the following: `failure`, `error`, `warning`, `info`, `success`, `user_update`, `recommendation`, or `snapshot`. Allowed enum values: `failure,error,warning,info,success,user_update,recommendation,snapshot`                   |
| attributes   | tags             | [string]  | A list of tags to apply to the event.                                                                                                                                                                                                                                               |
| attributes   | timestamp        | int64     | POSIX timestamp of your event in milliseconds.                                                                                                                                                                                                                                      |
| attributes   | title            | string    | The event title.                                                                                                                                                                                                                                                                    |
| attributes   | message          | string    | The message of the event.                                                                                                                                                                                                                                                           |
| attributes   | tags             | [string]  | An array of tags associated with the event.                                                                                                                                                                                                                                         |
| attributes   | timestamp        | date-time | The timestamp of the event.                                                                                                                                                                                                                                                         |
| data         | id               | string    | the unique ID of the event.                                                                                                                                                                                                                                                         |
| data         | type             | enum      | Type of the event. Allowed enum values: `event`                                                                                                                                                                                                                                     |
|              | links            | object    | Links attributes.                                                                                                                                                                                                                                                                   |
| links        | next             | string    | Link for the next set of results. Note that the request can also be made using the POST endpoint.                                                                                                                                                                                   |
|              | meta             | object    | The metadata associated with a request.                                                                                                                                                                                                                                             |
| meta         | elapsed          | int64     | The time elapsed in milliseconds.                                                                                                                                                                                                                                                   |
| meta         | page             | object    | Pagination attributes.                                                                                                                                                                                                                                                              |
| page         | after            | string    | The cursor to use to get the next results, if any. To make the next request, use the same parameters with the addition of the `page[cursor]`.                                                                                                                                       |
| meta         | request_id       | string    | The identifier of the request.                                                                                                                                                                                                                                                      |
| meta         | status           | string    | The request status.                                                                                                                                                                                                                                                                 |
| meta         | warnings         | [object]  | A list of warnings (non-fatal errors) encountered. Partial results might be returned if warnings are present in the response.                                                                                                                                                       |
| warnings     | code             | string    | A unique code for this type of warning.                                                                                                                                                                                                                                             |
| warnings     | detail           | string    | A detailed explanation of this specific warning.                                                                                                                                                                                                                                    |
| warnings     | title            | string    | A short human-readable summary of the warning.                                                                                                                                                                                                                                      |

{% /tab %}

{% tab title="Example" %}

```json
{
  "data": [
    {
      "attributes": {
        "attributes": {
          "aggregation_key": "string",
          "date_happened": "integer",
          "device_name": "string",
          "duration": "integer",
          "event_object": "Did you hear the news today?",
          "evt": {
            "id": "6509751066204996294",
            "name": "string",
            "source_id": 36,
            "type": "error_tracking_alert"
          },
          "hostname": "string",
          "monitor": {
            "created_at": 1646318692000,
            "group_status": "integer",
            "groups": [],
            "id": "integer",
            "message": "string",
            "modified": "integer",
            "name": "string",
            "query": "string",
            "tags": [
              "environment:test"
            ],
            "templated_name": "string",
            "type": "string"
          },
          "monitor_groups": [],
          "monitor_id": "integer",
          "priority": "normal",
          "related_event_id": "integer",
          "service": "datadog-api",
          "source_type_name": "string",
          "sourcecategory": "string",
          "status": "info",
          "tags": [
            "environment:test"
          ],
          "timestamp": 1652274265000,
          "title": "Oh boy!"
        },
        "message": "string",
        "tags": [
          "team:A"
        ],
        "timestamp": "2019-01-02T09:42:36.320Z"
      },
      "id": "AAAAAWgN8Xwgr1vKDQAAAABBV2dOOFh3ZzZobm1mWXJFYTR0OA",
      "type": "event"
    }
  ],
  "links": {
    "next": "https://app.datadoghq.com/api/v2/events?filter[query]=foo\u0026page[cursor]=eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ=="
  },
  "meta": {
    "elapsed": 132,
    "page": {
      "after": "eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ=="
    },
    "request_id": "MWlFUjVaWGZTTTZPYzM0VXp1OXU2d3xLSVpEMjZKQ0VKUTI0dEYtM3RSOFVR",
    "status": "done",
    "warnings": [
      {
        "code": "unknown_index",
        "detail": "indexes: foo, bar",
        "title": "One or several indexes are missing or invalid. Results hold data from the other indexes."
      }
    ]
  }
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

{% tab title="403" %}
Not Authorized
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
 \# Curl command curl -X POST "https://api.datadoghq.com/api/v2/events/search" \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
-d @- << EOF
{
  "filter": {
    "from": "now-15m",
    "query": "service:web* AND @http.status_code:[200 TO 299]",
    "to": "now"
  },
  "options": {
    "timezone": "GMT"
  },
  "page": {
    "cursor": "eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ==",
    "limit": 25
  },
  "sort": "timestamp"
}
EOF 
                        
##### 
                          \## default
# 
 \# Curl command curl -X POST "https://api.datadoghq.com/api/v2/events/search" \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
-d @- << EOF
{
  "filter": {
    "from": "now-15m",
    "query": "service:web* AND @http.status_code:[200 TO 299]",
    "to": "now"
  },
  "options": {
    "timezone": "GMT"
  },
  "page": {
    "cursor": "eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ==",
    "limit": 25
  },
  "sort": "timestamp"
}
EOF 
                        
##### 

```go
// Search events returns "OK" response

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
	body := datadogV2.EventsListRequest{
		Filter: &datadogV2.EventsQueryFilter{
			Query: datadog.PtrString("datadog-agent"),
			From:  datadog.PtrString("2020-09-17T11:48:36+01:00"),
			To:    datadog.PtrString("2020-09-17T12:48:36+01:00"),
		},
		Sort: datadogV2.EVENTSSORT_TIMESTAMP_ASCENDING.Ptr(),
		Page: &datadogV2.EventsRequestPage{
			Limit: datadog.PtrInt32(5),
		},
	}
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewEventsApi(apiClient)
	resp, r, err := api.SearchEvents(ctx, *datadogV2.NewSearchEventsOptionalParameters().WithBody(body))

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EventsApi.SearchEvents`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `EventsApi.SearchEvents`:\n%s\n", responseContent)
}
```

##### 

```go
// Search events returns "OK" response with pagination

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
	body := datadogV2.EventsListRequest{
		Filter: &datadogV2.EventsQueryFilter{
			From: datadog.PtrString("now-15m"),
			To:   datadog.PtrString("now"),
		},
		Options: &datadogV2.EventsQueryOptions{
			Timezone: datadog.PtrString("GMT"),
		},
		Page: &datadogV2.EventsRequestPage{
			Limit: datadog.PtrInt32(2),
		},
		Sort: datadogV2.EVENTSSORT_TIMESTAMP_ASCENDING.Ptr(),
	}
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewEventsApi(apiClient)
	resp, _ := api.SearchEventsWithPagination(ctx, *datadogV2.NewSearchEventsOptionalParameters().WithBody(body))

	for paginationResult := range resp {
		if paginationResult.Error != nil {
			fmt.Fprintf(os.Stderr, "Error when calling `EventsApi.SearchEvents`: %v\n", paginationResult.Error)
		}
		responseContent, _ := json.MarshalIndent(paginationResult.Item, "", "  ")
		fmt.Fprintf(os.Stdout, "%s\n", responseContent)
	}
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=go) and then save the example to `main.go` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" go run "main.go"
##### 

```java
// Search events returns "OK" response

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v2.api.EventsApi;
import com.datadog.api.client.v2.api.EventsApi.SearchEventsOptionalParameters;
import com.datadog.api.client.v2.model.EventsListRequest;
import com.datadog.api.client.v2.model.EventsListResponse;
import com.datadog.api.client.v2.model.EventsQueryFilter;
import com.datadog.api.client.v2.model.EventsRequestPage;
import com.datadog.api.client.v2.model.EventsSort;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    EventsApi apiInstance = new EventsApi(defaultClient);

    EventsListRequest body =
        new EventsListRequest()
            .filter(
                new EventsQueryFilter()
                    .query("datadog-agent")
                    .from("2020-09-17T11:48:36+01:00")
                    .to("2020-09-17T12:48:36+01:00"))
            .sort(EventsSort.TIMESTAMP_ASCENDING)
            .page(new EventsRequestPage().limit(5));

    try {
      EventsListResponse result =
          apiInstance.searchEvents(new SearchEventsOptionalParameters().body(body));
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EventsApi#searchEvents");
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
// Search events returns "OK" response with pagination

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.PaginationIterable;
import com.datadog.api.client.v2.api.EventsApi;
import com.datadog.api.client.v2.api.EventsApi.SearchEventsOptionalParameters;
import com.datadog.api.client.v2.model.EventResponse;
import com.datadog.api.client.v2.model.EventsListRequest;
import com.datadog.api.client.v2.model.EventsQueryFilter;
import com.datadog.api.client.v2.model.EventsQueryOptions;
import com.datadog.api.client.v2.model.EventsRequestPage;
import com.datadog.api.client.v2.model.EventsSort;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    EventsApi apiInstance = new EventsApi(defaultClient);

    EventsListRequest body =
        new EventsListRequest()
            .filter(new EventsQueryFilter().from("now-15m").to("now"))
            .options(new EventsQueryOptions().timezone("GMT"))
            .page(new EventsRequestPage().limit(2))
            .sort(EventsSort.TIMESTAMP_ASCENDING);

    try {
      PaginationIterable<EventResponse> iterable =
          apiInstance.searchEventsWithPagination(new SearchEventsOptionalParameters().body(body));

      for (EventResponse item : iterable) {
        System.out.println(item);
      }
    } catch (RuntimeException e) {
      System.err.println("Exception when calling EventsApi#searchEventsWithPagination");
      System.err.println("Reason: " + e.getMessage());
      e.printStackTrace();
    }
  }
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=java) and then save the example to `Example.java` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" java "Example.java"
##### 

```python
"""
Search events returns "OK" response
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.events_api import EventsApi
from datadog_api_client.v2.model.events_list_request import EventsListRequest
from datadog_api_client.v2.model.events_query_filter import EventsQueryFilter
from datadog_api_client.v2.model.events_request_page import EventsRequestPage
from datadog_api_client.v2.model.events_sort import EventsSort

body = EventsListRequest(
    filter=EventsQueryFilter(
        query="datadog-agent",
        _from="2020-09-17T11:48:36+01:00",
        to="2020-09-17T12:48:36+01:00",
    ),
    sort=EventsSort.TIMESTAMP_ASCENDING,
    page=EventsRequestPage(
        limit=5,
    ),
)

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = EventsApi(api_client)
    response = api_instance.search_events(body=body)

    print(response)
```

##### 

```python
"""
Search events returns "OK" response with pagination
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.events_api import EventsApi
from datadog_api_client.v2.model.events_list_request import EventsListRequest
from datadog_api_client.v2.model.events_query_filter import EventsQueryFilter
from datadog_api_client.v2.model.events_query_options import EventsQueryOptions
from datadog_api_client.v2.model.events_request_page import EventsRequestPage
from datadog_api_client.v2.model.events_sort import EventsSort

body = EventsListRequest(
    filter=EventsQueryFilter(
        _from="now-15m",
        to="now",
    ),
    options=EventsQueryOptions(
        timezone="GMT",
    ),
    page=EventsRequestPage(
        limit=2,
    ),
    sort=EventsSort.TIMESTAMP_ASCENDING,
)

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = EventsApi(api_client)
    items = api_instance.search_events_with_pagination(body=body)
    for item in items:
        print(item)
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=python) and then save the example to `example.py` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" python3 "example.py"
##### 

```ruby
# Search events returns "OK" response

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::EventsAPI.new

body = DatadogAPIClient::V2::EventsListRequest.new({
  filter: DatadogAPIClient::V2::EventsQueryFilter.new({
    query: "datadog-agent",
    from: "2020-09-17T11:48:36+01:00",
    to: "2020-09-17T12:48:36+01:00",
  }),
  sort: DatadogAPIClient::V2::EventsSort::TIMESTAMP_ASCENDING,
  page: DatadogAPIClient::V2::EventsRequestPage.new({
    limit: 5,
  }),
})
opts = {
  body: body,
}
p api_instance.search_events(opts)
```

##### 

```ruby
# Search events returns "OK" response with pagination

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::EventsAPI.new

body = DatadogAPIClient::V2::EventsListRequest.new({
  filter: DatadogAPIClient::V2::EventsQueryFilter.new({
    from: "now-15m",
    to: "now",
  }),
  options: DatadogAPIClient::V2::EventsQueryOptions.new({
    timezone: "GMT",
  }),
  page: DatadogAPIClient::V2::EventsRequestPage.new({
    limit: 2,
  }),
  sort: DatadogAPIClient::V2::EventsSort::TIMESTAMP_ASCENDING,
})
opts = {
  body: body,
}
api_instance.search_events_with_pagination(opts) { |item| puts item }
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=ruby) and then save the example to `example.rb` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" rb "example.rb"
##### 

```rust
// Search events returns "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_events::EventsAPI;
use datadog_api_client::datadogV2::api_events::SearchEventsOptionalParams;
use datadog_api_client::datadogV2::model::EventsListRequest;
use datadog_api_client::datadogV2::model::EventsQueryFilter;
use datadog_api_client::datadogV2::model::EventsRequestPage;
use datadog_api_client::datadogV2::model::EventsSort;

#[tokio::main]
async fn main() {
    let body = EventsListRequest::new()
        .filter(
            EventsQueryFilter::new()
                .from("2020-09-17T11:48:36+01:00".to_string())
                .query("datadog-agent".to_string())
                .to("2020-09-17T12:48:36+01:00".to_string()),
        )
        .page(EventsRequestPage::new().limit(5))
        .sort(EventsSort::TIMESTAMP_ASCENDING);
    let configuration = datadog::Configuration::new();
    let api = EventsAPI::with_config(configuration);
    let resp = api
        .search_events(SearchEventsOptionalParams::default().body(body))
        .await;
    if let Ok(value) = resp {
        println!("{:#?}", value);
    } else {
        println!("{:#?}", resp.unwrap_err());
    }
}
```

##### 

```rust
// Search events returns "OK" response with pagination
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_events::EventsAPI;
use datadog_api_client::datadogV2::api_events::SearchEventsOptionalParams;
use datadog_api_client::datadogV2::model::EventsListRequest;
use datadog_api_client::datadogV2::model::EventsQueryFilter;
use datadog_api_client::datadogV2::model::EventsQueryOptions;
use datadog_api_client::datadogV2::model::EventsRequestPage;
use datadog_api_client::datadogV2::model::EventsSort;
use futures_util::pin_mut;
use futures_util::stream::StreamExt;

#[tokio::main]
async fn main() {
    let body = EventsListRequest::new()
        .filter(
            EventsQueryFilter::new()
                .from("now-15m".to_string())
                .to("now".to_string()),
        )
        .options(EventsQueryOptions::new().timezone("GMT".to_string()))
        .page(EventsRequestPage::new().limit(2))
        .sort(EventsSort::TIMESTAMP_ASCENDING);
    let configuration = datadog::Configuration::new();
    let api = EventsAPI::with_config(configuration);
    let response =
        api.search_events_with_pagination(SearchEventsOptionalParams::default().body(body));
    pin_mut!(response);
    while let Some(resp) = response.next().await {
        if let Ok(value) = resp {
            println!("{:#?}", value);
        } else {
            println!("{:#?}", resp.unwrap_err());
        }
    }
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=rust) and then save the example to `src/main.rs` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" cargo run
##### 

```typescript
/**
 * Search events returns "OK" response
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.EventsApi(configuration);

const params: v2.EventsApiSearchEventsRequest = {
  body: {
    filter: {
      query: "datadog-agent",
      from: "2020-09-17T11:48:36+01:00",
      to: "2020-09-17T12:48:36+01:00",
    },
    sort: "timestamp",
    page: {
      limit: 5,
    },
  },
};

apiInstance
  .searchEvents(params)
  .then((data: v2.EventsListResponse) => {
    console.log(
      "API called successfully. Returned data: " + JSON.stringify(data)
    );
  })
  .catch((error: any) => console.error(error));
```

##### 

```typescript
/**
 * Search events returns "OK" response with pagination
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.EventsApi(configuration);

const params: v2.EventsApiSearchEventsRequest = {
  body: {
    filter: {
      from: "now-15m",
      to: "now",
    },
    options: {
      timezone: "GMT",
    },
    page: {
      limit: 2,
    },
    sort: "timestamp",
  },
};

(async () => {
  try {
    for await (const item of apiInstance.searchEventsWithPagination(params)) {
      console.log(item);
    }
  } catch (error) {
    console.error(error);
  }
})();
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=typescript) and then save the example to `example.ts` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" tsc "example.ts"
{% /tab %}
