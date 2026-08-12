# Datadog — Logs API: Search logs (POST /api/v2/logs/events/search)

- Source URL: https://docs.datadoghq.com/api/latest/logs/search-logs-post.md
- Accessed: 2026-08-12 (native vendor markdown mirror served by docs.datadoghq.com, fetched verbatim with curl)

---
title: Search logs (POST)
description: Datadog, the leading service for cloud-scale monitoring.
breadcrumbs: Docs > API Reference > Logs
---

> For the complete documentation index, see [llms.txt](https://docs.datadoghq.com/llms.txt).

# Search logs (POST){% #search-logs-post %}
Copy pageCopied
{% tab title="v2" %}

| Datadog site      | API endpoint                                                 |
| ----------------- | ------------------------------------------------------------ |
| ap1.datadoghq.com | POST https://api.ap1.datadoghq.com/api/v2/logs/events/search |
| ap2.datadoghq.com | POST https://api.ap2.datadoghq.com/api/v2/logs/events/search |
| app.datadoghq.eu  | POST https://api.datadoghq.eu/api/v2/logs/events/search      |
| app.ddog-gov.com  | POST https://api.ddog-gov.com/api/v2/logs/events/search      |
| us2.ddog-gov.com  | POST https://api.us2.ddog-gov.com/api/v2/logs/events/search  |
| uk1.datadoghq.com | POST https://api.uk1.datadoghq.com/api/v2/logs/events/search |
| app.datadoghq.com | POST https://api.datadoghq.com/api/v2/logs/events/search     |
| us3.datadoghq.com | POST https://api.us3.datadoghq.com/api/v2/logs/events/search |
| us5.datadoghq.com | POST https://api.us5.datadoghq.com/api/v2/logs/events/search |

### Overview



List endpoint returns logs that match a log search query. [Results are paginated](https://docs.datadoghq.com/logs/guide/collect-multiple-logs-with-pagination.md).

Use this endpoint to search and filter your logs.

**If you are considering archiving logs for your organization, consider use of the Datadog archive capabilities instead of the log list API. See [Datadog Logs Archive documentation](https://docs.datadoghq.com/logs/archives.md).**
This endpoint requires the `logs_read_data` permission.


### Request

#### Body Data 



{% tab title="Model" %}

| Parent field | Field        | Type     | Description                                                                                                                                           |
| ------------ | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
|              | filter       | object   | The search and filter query settings                                                                                                                  |
| filter       | from         | string   | The minimum time for the requested logs, supports date math and regular timestamps (milliseconds).                                                    |
| filter       | indexes      | [string] | For customers with multiple indexes, the indexes to search. Defaults to ['*'] which means all indexes.                                                |
| filter       | query        | string   | The search query - following the log search syntax.                                                                                                   |
| filter       | storage_tier | enum     | Specifies storage type as indexes, online-archives or flex Allowed enum values: `indexes,online-archives,flex`                                        |
| filter       | to           | string   | The maximum time for the requested logs, supports date math and regular timestamps (milliseconds).                                                    |
|              | options      | object   | **DEPRECATED**: Global query options that are used during the query. Note: These fields are currently deprecated and do not affect the query results. |
| options      | timeOffset   | int64    | The time offset (in seconds) to apply to the query.                                                                                                   |
| options      | timezone     | string   | The timezone can be specified as GMT, UTC, an offset from UTC (like UTC+1), or as a Timezone Database identifier (like America/New_York).             |
|              | page         | object   | Paging attributes for listing logs.                                                                                                                   |
| page         | cursor       | string   | List following results with a cursor provided in the previous query.                                                                                  |
| page         | limit        | int32    | Maximum number of logs in the response.                                                                                                               |
|              | sort         | enum     | Sort parameters when querying logs. Allowed enum values: `timestamp,-timestamp`                                                                       |

{% /tab %}

{% tab title="Example" %}
##### 

```json
{
  "filter": {
    "query": "datadog-agent",
    "indexes": [
      "main"
    ],
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
    "indexes": [
      "main"
    ],
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
Response object with all logs matching the request and pagination information.

| Parent field | Field      | Type      | Description                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|              | data       | [object]  | Array of logs matching the request.                                                                                                                                                                                                                                                                                        |
| data         | attributes | object    | JSON object containing all log attributes and their associated values.                                                                                                                                                                                                                                                     |
| attributes   | attributes | object    | JSON object of attributes from your log.                                                                                                                                                                                                                                                                                   |
| attributes   | host       | string    | Name of the machine from where the logs are being sent.                                                                                                                                                                                                                                                                    |
| attributes   | message    | string    | The message [reserved attribute](https://docs.datadoghq.com/logs/log_collection.md#reserved-attributes) of your log. By default, Datadog ingests the value of the message attribute as the body of the log entry. That value is then highlighted and displayed in the Logstream, where it is indexed for full text search. |
| attributes   | service    | string    | The name of the application or service generating the log events. It is used to switch from Logs to APM, so make sure you define the same value when you use both products.                                                                                                                                                |
| attributes   | status     | string    | Status of the message associated with your log.                                                                                                                                                                                                                                                                            |
| attributes   | tags       | [string]  | Array of tags associated with your log.                                                                                                                                                                                                                                                                                    |
| attributes   | timestamp  | date-time | Timestamp of your log.                                                                                                                                                                                                                                                                                                     |
| data         | id         | string    | Unique ID of the Log.                                                                                                                                                                                                                                                                                                      |
| data         | type       | enum      | Type of the event. Allowed enum values: `log`                                                                                                                                                                                                                                                                              |
|              | links      | object    | Links attributes.                                                                                                                                                                                                                                                                                                          |
| links        | next       | string    | Link for the next set of results. Note that the request can also be made using the POST endpoint.                                                                                                                                                                                                                          |
|              | meta       | object    | The metadata associated with a request                                                                                                                                                                                                                                                                                     |
| meta         | elapsed    | int64     | The time elapsed in milliseconds                                                                                                                                                                                                                                                                                           |
| meta         | page       | object    | Paging attributes.                                                                                                                                                                                                                                                                                                         |
| page         | after      | string    | The cursor to use to get the next results, if any. To make the next request, use the same parameters with the addition of the `page[cursor]`.                                                                                                                                                                              |
| meta         | request_id | string    | The identifier of the request                                                                                                                                                                                                                                                                                              |
| meta         | status     | enum      | The status of the response Allowed enum values: `done,timeout`                                                                                                                                                                                                                                                             |
| meta         | warnings   | [object]  | A list of warnings (non fatal errors) encountered, partial results might be returned if warnings are present in the response.                                                                                                                                                                                              |
| warnings     | code       | string    | A unique code for this type of warning                                                                                                                                                                                                                                                                                     |
| warnings     | detail     | string    | A detailed explanation of this specific warning                                                                                                                                                                                                                                                                            |
| warnings     | title      | string    | A short human-readable summary of the warning                                                                                                                                                                                                                                                                              |

{% /tab %}

{% tab title="Example" %}

```json
{
  "data": [
    {
      "attributes": {
        "attributes": {
          "customAttribute": 123,
          "duration": 2345
        },
        "host": "i-0123",
        "message": "Host connected to remote",
        "service": "agent",
        "status": "INFO",
        "tags": [
          "team:A"
        ],
        "timestamp": "2019-01-02T09:42:36.320Z"
      },
      "id": "AAAAAWgN8Xwgr1vKDQAAAABBV2dOOFh3ZzZobm1mWXJFYTR0OA",
      "type": "log"
    }
  ],
  "links": {
    "next": "https://app.datadoghq.com/api/v2/logs/event?filter[query]=foo\u0026page[cursor]=eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ=="
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
        "title": "One or several indexes are missing or invalid, results hold data from the other indexes"
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
 \# Curl command curl -X POST "https://api.datadoghq.com/api/v2/logs/events/search" \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
-d @- << EOF
{
  "filter": {
    "from": "now-15m",
    "indexes": [
      "main",
      "web"
    ],
    "query": "service:web* AND @http.status_code:[200 TO 299]",
    "storage_tier": "indexes",
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
 \# Curl command curl -X POST "https://api.datadoghq.com/api/v2/logs/events/search" \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
-d @- << EOF
{
  "filter": {
    "from": "now-15m",
    "indexes": [
      "main",
      "web"
    ],
    "query": "service:web* AND @http.status_code:[200 TO 299]",
    "storage_tier": "indexes",
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
// Search logs returns "OK" response

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
	body := datadogV2.LogsListRequest{
		Filter: &datadogV2.LogsQueryFilter{
			Query: datadog.PtrString("datadog-agent"),
			Indexes: []string{
				"main",
			},
			From: datadog.PtrString("2020-09-17T11:48:36+01:00"),
			To:   datadog.PtrString("2020-09-17T12:48:36+01:00"),
		},
		Sort: datadogV2.LOGSSORT_TIMESTAMP_ASCENDING.Ptr(),
		Page: &datadogV2.LogsListRequestPage{
			Limit: datadog.PtrInt32(5),
		},
	}
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewLogsApi(apiClient)
	resp, r, err := api.ListLogs(ctx, *datadogV2.NewListLogsOptionalParameters().WithBody(body))

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LogsApi.ListLogs`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `LogsApi.ListLogs`:\n%s\n", responseContent)
}
```

##### 

```go
// Search logs returns "OK" response with pagination

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
	body := datadogV2.LogsListRequest{
		Filter: &datadogV2.LogsQueryFilter{
			From: datadog.PtrString("now-15m"),
			Indexes: []string{
				"main",
			},
			To: datadog.PtrString("now"),
		},
		Options: &datadogV2.LogsQueryOptions{
			Timezone: datadog.PtrString("GMT"),
		},
		Page: &datadogV2.LogsListRequestPage{
			Limit: datadog.PtrInt32(2),
		},
		Sort: datadogV2.LOGSSORT_TIMESTAMP_ASCENDING.Ptr(),
	}
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewLogsApi(apiClient)
	resp, _ := api.ListLogsWithPagination(ctx, *datadogV2.NewListLogsOptionalParameters().WithBody(body))

	for paginationResult := range resp {
		if paginationResult.Error != nil {
			fmt.Fprintf(os.Stderr, "Error when calling `LogsApi.ListLogs`: %v\n", paginationResult.Error)
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
// Search logs returns "OK" response

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v2.api.LogsApi;
import com.datadog.api.client.v2.api.LogsApi.ListLogsOptionalParameters;
import com.datadog.api.client.v2.model.LogsListRequest;
import com.datadog.api.client.v2.model.LogsListRequestPage;
import com.datadog.api.client.v2.model.LogsListResponse;
import com.datadog.api.client.v2.model.LogsQueryFilter;
import com.datadog.api.client.v2.model.LogsSort;
import java.util.Collections;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    LogsApi apiInstance = new LogsApi(defaultClient);

    LogsListRequest body =
        new LogsListRequest()
            .filter(
                new LogsQueryFilter()
                    .query("datadog-agent")
                    .indexes(Collections.singletonList("main"))
                    .from("2020-09-17T11:48:36+01:00")
                    .to("2020-09-17T12:48:36+01:00"))
            .sort(LogsSort.TIMESTAMP_ASCENDING)
            .page(new LogsListRequestPage().limit(5));

    try {
      LogsListResponse result = apiInstance.listLogs(new ListLogsOptionalParameters().body(body));
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LogsApi#listLogs");
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
// Search logs returns "OK" response with pagination

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.PaginationIterable;
import com.datadog.api.client.v2.api.LogsApi;
import com.datadog.api.client.v2.api.LogsApi.ListLogsOptionalParameters;
import com.datadog.api.client.v2.model.Log;
import com.datadog.api.client.v2.model.LogsListRequest;
import com.datadog.api.client.v2.model.LogsListRequestPage;
import com.datadog.api.client.v2.model.LogsQueryFilter;
import com.datadog.api.client.v2.model.LogsQueryOptions;
import com.datadog.api.client.v2.model.LogsSort;
import java.util.Collections;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    LogsApi apiInstance = new LogsApi(defaultClient);

    LogsListRequest body =
        new LogsListRequest()
            .filter(
                new LogsQueryFilter()
                    .from("now-15m")
                    .indexes(Collections.singletonList("main"))
                    .to("now"))
            .options(new LogsQueryOptions().timezone("GMT"))
            .page(new LogsListRequestPage().limit(2))
            .sort(LogsSort.TIMESTAMP_ASCENDING);

    try {
      PaginationIterable<Log> iterable =
          apiInstance.listLogsWithPagination(new ListLogsOptionalParameters().body(body));

      for (Log item : iterable) {
        System.out.println(item);
      }
    } catch (RuntimeException e) {
      System.err.println("Exception when calling LogsApi#listLogsWithPagination");
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
Search logs returns "OK" response
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.logs_api import LogsApi
from datadog_api_client.v2.model.logs_list_request import LogsListRequest
from datadog_api_client.v2.model.logs_list_request_page import LogsListRequestPage
from datadog_api_client.v2.model.logs_query_filter import LogsQueryFilter
from datadog_api_client.v2.model.logs_sort import LogsSort

body = LogsListRequest(
    filter=LogsQueryFilter(
        query="datadog-agent",
        indexes=[
            "main",
        ],
        _from="2020-09-17T11:48:36+01:00",
        to="2020-09-17T12:48:36+01:00",
    ),
    sort=LogsSort.TIMESTAMP_ASCENDING,
    page=LogsListRequestPage(
        limit=5,
    ),
)

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = LogsApi(api_client)
    response = api_instance.list_logs(body=body)

    print(response)
```

##### 

```python
"""
Search logs returns "OK" response with pagination
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.logs_api import LogsApi
from datadog_api_client.v2.model.logs_list_request import LogsListRequest
from datadog_api_client.v2.model.logs_list_request_page import LogsListRequestPage
from datadog_api_client.v2.model.logs_query_filter import LogsQueryFilter
from datadog_api_client.v2.model.logs_query_options import LogsQueryOptions
from datadog_api_client.v2.model.logs_sort import LogsSort

body = LogsListRequest(
    filter=LogsQueryFilter(
        _from="now-15m",
        indexes=[
            "main",
        ],
        to="now",
    ),
    options=LogsQueryOptions(
        timezone="GMT",
    ),
    page=LogsListRequestPage(
        limit=2,
    ),
    sort=LogsSort.TIMESTAMP_ASCENDING,
)

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = LogsApi(api_client)
    items = api_instance.list_logs_with_pagination(body=body)
    for item in items:
        print(item)
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=python) and then save the example to `example.py` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" python3 "example.py"
##### 

```ruby
# Search logs returns "OK" response

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::LogsAPI.new

body = DatadogAPIClient::V2::LogsListRequest.new({
  filter: DatadogAPIClient::V2::LogsQueryFilter.new({
    query: "datadog-agent",
    indexes: [
      "main",
    ],
    from: "2020-09-17T11:48:36+01:00",
    to: "2020-09-17T12:48:36+01:00",
  }),
  sort: DatadogAPIClient::V2::LogsSort::TIMESTAMP_ASCENDING,
  page: DatadogAPIClient::V2::LogsListRequestPage.new({
    limit: 5,
  }),
})
opts = {
  body: body,
}
p api_instance.list_logs(opts)
```

##### 

```ruby
# Search logs returns "OK" response with pagination

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::LogsAPI.new

body = DatadogAPIClient::V2::LogsListRequest.new({
  filter: DatadogAPIClient::V2::LogsQueryFilter.new({
    from: "now-15m",
    indexes: [
      "main",
    ],
    to: "now",
  }),
  options: DatadogAPIClient::V2::LogsQueryOptions.new({
    timezone: "GMT",
  }),
  page: DatadogAPIClient::V2::LogsListRequestPage.new({
    limit: 2,
  }),
  sort: DatadogAPIClient::V2::LogsSort::TIMESTAMP_ASCENDING,
})
opts = {
  body: body,
}
api_instance.list_logs_with_pagination(opts) { |item| puts item }
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=ruby) and then save the example to `example.rb` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" rb "example.rb"
##### 

```rust
// Search logs returns "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_logs::ListLogsOptionalParams;
use datadog_api_client::datadogV2::api_logs::LogsAPI;
use datadog_api_client::datadogV2::model::LogsListRequest;
use datadog_api_client::datadogV2::model::LogsListRequestPage;
use datadog_api_client::datadogV2::model::LogsQueryFilter;
use datadog_api_client::datadogV2::model::LogsSort;

#[tokio::main]
async fn main() {
    let body = LogsListRequest::new()
        .filter(
            LogsQueryFilter::new()
                .from("2020-09-17T11:48:36+01:00".to_string())
                .indexes(vec!["main".to_string()])
                .query("datadog-agent".to_string())
                .to("2020-09-17T12:48:36+01:00".to_string()),
        )
        .page(LogsListRequestPage::new().limit(5))
        .sort(LogsSort::TIMESTAMP_ASCENDING);
    let configuration = datadog::Configuration::new();
    let api = LogsAPI::with_config(configuration);
    let resp = api
        .list_logs(ListLogsOptionalParams::default().body(body))
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
// Search logs returns "OK" response with pagination
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_logs::ListLogsOptionalParams;
use datadog_api_client::datadogV2::api_logs::LogsAPI;
use datadog_api_client::datadogV2::model::LogsListRequest;
use datadog_api_client::datadogV2::model::LogsListRequestPage;
use datadog_api_client::datadogV2::model::LogsQueryFilter;
use datadog_api_client::datadogV2::model::LogsQueryOptions;
use datadog_api_client::datadogV2::model::LogsSort;
use futures_util::pin_mut;
use futures_util::stream::StreamExt;

#[tokio::main]
async fn main() {
    let body = LogsListRequest::new()
        .filter(
            LogsQueryFilter::new()
                .from("now-15m".to_string())
                .indexes(vec!["main".to_string()])
                .to("now".to_string()),
        )
        .options(LogsQueryOptions::new().timezone("GMT".to_string()))
        .page(LogsListRequestPage::new().limit(2))
        .sort(LogsSort::TIMESTAMP_ASCENDING);
    let configuration = datadog::Configuration::new();
    let api = LogsAPI::with_config(configuration);
    let response = api.list_logs_with_pagination(ListLogsOptionalParams::default().body(body));
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
 * Search logs returns "OK" response
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.LogsApi(configuration);

const params: v2.LogsApiListLogsRequest = {
  body: {
    filter: {
      query: "datadog-agent",
      indexes: ["main"],
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
  .listLogs(params)
  .then((data: v2.LogsListResponse) => {
    console.log(
      "API called successfully. Returned data: " + JSON.stringify(data)
    );
  })
  .catch((error: any) => console.error(error));
```

##### 

```typescript
/**
 * Search logs returns "OK" response with pagination
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.LogsApi(configuration);

const params: v2.LogsApiListLogsRequest = {
  body: {
    filter: {
      from: "now-15m",
      indexes: ["main"],
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
    for await (const item of apiInstance.listLogsWithPagination(params)) {
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
