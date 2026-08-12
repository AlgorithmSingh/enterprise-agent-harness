# Datadog — Logs API: Search logs (GET /api/v2/logs/events)

- Source URL: https://docs.datadoghq.com/api/latest/logs/search-logs-get.md
- Accessed: 2026-08-12 (native vendor markdown mirror served by docs.datadoghq.com, fetched verbatim with curl)

---
title: Search logs (GET)
description: Datadog, the leading service for cloud-scale monitoring.
breadcrumbs: Docs > API Reference > Logs
---

> For the complete documentation index, see [llms.txt](https://docs.datadoghq.com/llms.txt).

# Search logs (GET){% #search-logs-get %}
Copy pageCopied
{% tab title="v2" %}

| Datadog site      | API endpoint                                         |
| ----------------- | ---------------------------------------------------- |
| ap1.datadoghq.com | GET https://api.ap1.datadoghq.com/api/v2/logs/events |
| ap2.datadoghq.com | GET https://api.ap2.datadoghq.com/api/v2/logs/events |
| app.datadoghq.eu  | GET https://api.datadoghq.eu/api/v2/logs/events      |
| app.ddog-gov.com  | GET https://api.ddog-gov.com/api/v2/logs/events      |
| us2.ddog-gov.com  | GET https://api.us2.ddog-gov.com/api/v2/logs/events  |
| uk1.datadoghq.com | GET https://api.uk1.datadoghq.com/api/v2/logs/events |
| app.datadoghq.com | GET https://api.datadoghq.com/api/v2/logs/events     |
| us3.datadoghq.com | GET https://api.us3.datadoghq.com/api/v2/logs/events |
| us5.datadoghq.com | GET https://api.us5.datadoghq.com/api/v2/logs/events |

### Overview



List endpoint returns logs that match a log search query. [Results are paginated](https://docs.datadoghq.com/logs/guide/collect-multiple-logs-with-pagination.md).

Use this endpoint to search and filter your logs.

**If you are considering archiving logs for your organization, consider use of the Datadog archive capabilities instead of the log list API. See [Datadog Logs Archive documentation](https://docs.datadoghq.com/logs/archives.md).**
This endpoint requires the `logs_read_data` permission.


### Arguments

#### Query Strings

| Name                 | Type    | Description                                                                                         |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| filter[query]        | string  | Search query following logs syntax.                                                                 |
| filter[indexes]      | array   | For customers with multiple indexes, the indexes to search. Defaults to '*' which means all indexes |
| filter[from]         | string  | Minimum timestamp for requested logs.                                                               |
| filter[to]           | string  | Maximum timestamp for requested logs.                                                               |
| filter[storage_tier] | enum    | Specifies the storage type to be used Allowed enum values: `indexes, online-archives, flex`         |
| sort                 | enum    | Order of logs in results. Allowed enum values: `timestamp, -timestamp`                              |
| page[cursor]         | string  | List following results with a cursor provided in the previous query.                                |
| page[limit]          | integer | Maximum number of logs in the response.                                                             |

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
                  \# Curl command curl -X GET "https://api.datadoghq.com/api/v2/logs/events" \
-H "Accept: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" 
                
##### 

```python
"""
Search logs (GET) returns "OK" response
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.logs_api import LogsApi

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = LogsApi(api_client)
    response = api_instance.list_logs_get()

    print(response)
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=python) and then save the example to `example.py` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" python3 "example.py"
##### 

```ruby
# Search logs (GET) returns "OK" response

require "datadog_api_client"
api_instance = DatadogAPIClient::V2::LogsAPI.new
p api_instance.list_logs_get()
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=ruby) and then save the example to `example.rb` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" rb "example.rb"
##### 

```go
// Search logs (GET) returns "OK" response

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
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewLogsApi(apiClient)
	resp, r, err := api.ListLogsGet(ctx, *datadogV2.NewListLogsGetOptionalParameters())

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LogsApi.ListLogsGet`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `LogsApi.ListLogsGet`:\n%s\n", responseContent)
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=go) and then save the example to `main.go` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" go run "main.go"
##### 

```java
// Search logs (GET) returns "OK" response

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v2.api.LogsApi;
import com.datadog.api.client.v2.model.LogsListResponse;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    LogsApi apiInstance = new LogsApi(defaultClient);

    try {
      LogsListResponse result = apiInstance.listLogsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LogsApi#listLogsGet");
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
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" java "Example.java"
##### 

```rust
// Search logs (GET) returns "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_logs::ListLogsGetOptionalParams;
use datadog_api_client::datadogV2::api_logs::LogsAPI;

#[tokio::main]
async fn main() {
    let configuration = datadog::Configuration::new();
    let api = LogsAPI::with_config(configuration);
    let resp = api
        .list_logs_get(ListLogsGetOptionalParams::default())
        .await;
    if let Ok(value) = resp {
        println!("{:#?}", value);
    } else {
        println!("{:#?}", resp.unwrap_err());
    }
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=rust) and then save the example to `src/main.rs` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" cargo run
##### 

```typescript
/**
 * Search logs (GET) returns "OK" response
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.LogsApi(configuration);

apiInstance
  .listLogsGet()
  .then((data: v2.LogsListResponse) => {
    console.log(
      "API called successfully. Returned data: " + JSON.stringify(data)
    );
  })
  .catch((error: any) => console.error(error));
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=typescript) and then save the example to `example.ts` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<API-KEY>" DD_APP_KEY="<APP-KEY>" tsc "example.ts"
{% /tab %}
