# Datadog — Metrics API: Query timeseries points (GET /api/v1/query)

- Source URL: https://docs.datadoghq.com/api/latest/metrics/query-timeseries-points.md
- Accessed: 2026-08-12 (native vendor markdown mirror served by docs.datadoghq.com, fetched verbatim with curl)

---
title: Query timeseries points
description: Datadog, the leading service for cloud-scale monitoring.
breadcrumbs: Docs > API Reference > Metrics
---

> For the complete documentation index, see [llms.txt](https://docs.datadoghq.com/llms.txt).

# Query timeseries points{% #query-timeseries-points %}
Copy pageCopied
{% tab title="v1" %}

| Datadog site      | API endpoint                                   |
| ----------------- | ---------------------------------------------- |
| ap1.datadoghq.com | GET https://api.ap1.datadoghq.com/api/v1/query |
| ap2.datadoghq.com | GET https://api.ap2.datadoghq.com/api/v1/query |
| app.datadoghq.eu  | GET https://api.datadoghq.eu/api/v1/query      |
| app.ddog-gov.com  | GET https://api.ddog-gov.com/api/v1/query      |
| us2.ddog-gov.com  | GET https://api.us2.ddog-gov.com/api/v1/query  |
| uk1.datadoghq.com | GET https://api.uk1.datadoghq.com/api/v1/query |
| app.datadoghq.com | GET https://api.datadoghq.com/api/v1/query     |
| us3.datadoghq.com | GET https://api.us3.datadoghq.com/api/v1/query |
| us5.datadoghq.com | GET https://api.us5.datadoghq.com/api/v1/query |

### Overview

Query timeseries points. This endpoint requires the `timeseries_query` permission.

OAuth apps require the `timeseries_query` authorization [scope](https://docs.datadoghq.com/api/latest/scopes.md#metrics) to access this endpoint.



### Arguments

#### Query Strings

| Name                    | Type    | Description                                                     |
| ----------------------- | ------- | --------------------------------------------------------------- |
| from [*required*]  | integer | Start of the queried time period, seconds since the Unix epoch. |
| to [*required*]    | integer | End of the queried time period, seconds since the Unix epoch.   |
| query [*required*] | string  | Query string.                                                   |

### Response

{% tab title="200" %}
OK
{% tab title="Model" %}
Response Object that includes your query and the list of metrics retrieved.

| Parent field | Field        | Type     | Description                                                                                                                                                                                                                                                                                     |
| ------------ | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|              | error        | string   | Message indicating the errors if status is not `ok`.                                                                                                                                                                                                                                            |
|              | from_date    | int64    | Start of requested time window, milliseconds since Unix epoch.                                                                                                                                                                                                                                  |
|              | group_by     | [string] | List of tag keys on which to group.                                                                                                                                                                                                                                                             |
|              | message      | string   | Message indicating `success` if status is `ok`.                                                                                                                                                                                                                                                 |
|              | query        | string   | Query string                                                                                                                                                                                                                                                                                    |
|              | res_type     | string   | Type of response.                                                                                                                                                                                                                                                                               |
|              | series       | [object] | List of timeseries queried.                                                                                                                                                                                                                                                                     |
| series       | aggr         | string   | Aggregation type.                                                                                                                                                                                                                                                                               |
| series       | display_name | string   | Display name of the metric.                                                                                                                                                                                                                                                                     |
| series       | end          | int64    | End of the time window, milliseconds since Unix epoch.                                                                                                                                                                                                                                          |
| series       | expression   | string   | Metric expression.                                                                                                                                                                                                                                                                              |
| series       | interval     | int64    | Number of milliseconds between data samples.                                                                                                                                                                                                                                                    |
| series       | length       | int64    | Number of data samples.                                                                                                                                                                                                                                                                         |
| series       | metric       | string   | Metric name.                                                                                                                                                                                                                                                                                    |
| series       | pointlist    | [array]  | List of points of the timeseries in milliseconds.                                                                                                                                                                                                                                               |
| series       | query_index  | int64    | The index of the series' query within the request.                                                                                                                                                                                                                                              |
| series       | scope        | string   | Metric scope, comma separated list of tags.                                                                                                                                                                                                                                                     |
| series       | start        | int64    | Start of the time window, milliseconds since Unix epoch.                                                                                                                                                                                                                                        |
| series       | tag_set      | [string] | Unique tags identifying this series.                                                                                                                                                                                                                                                            |
| series       | unit         | [object] | Detailed information about the metric unit. The first element describes the "primary unit" (for example, `bytes` in `bytes per second`). The second element describes the "per unit" (for example, `second` in `bytes per second`). If the second element is not present, the API returns null. |
| unit         | family       | string   | Unit family, allows for conversion between units of the same family, for scaling.                                                                                                                                                                                                               |
| unit         | name         | string   | Unit name                                                                                                                                                                                                                                                                                       |
| unit         | plural       | string   | Plural form of the unit name.                                                                                                                                                                                                                                                                   |
| unit         | scale_factor | double   | Factor for scaling between units of the same family.                                                                                                                                                                                                                                            |
| unit         | short_name   | string   | Abbreviation of the unit.                                                                                                                                                                                                                                                                       |
|              | status       | string   | Status of the query.                                                                                                                                                                                                                                                                            |
|              | to_date      | int64    | End of requested time window, milliseconds since Unix epoch.                                                                                                                                                                                                                                    |

{% /tab %}

{% tab title="Example" %}

```json
{
  "error": "string",
  "from_date": "integer",
  "group_by": [],
  "message": "string",
  "query": "string",
  "res_type": "time_series",
  "series": [
    {
      "aggr": "avg",
      "display_name": "system.cpu.idle",
      "end": "integer",
      "expression": "system.cpu.idle{host:foo,env:test}",
      "interval": "integer",
      "length": "integer",
      "metric": "system.cpu.idle",
      "pointlist": [
        [
          1681683300000,
          77.62145685254418
        ]
      ],
      "query_index": "integer",
      "scope": "host:foo,env:test",
      "start": "integer",
      "tag_set": [],
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
  "status": "ok",
  "to_date": "integer"
}
```

{% /tab %}

{% /tab %}

{% tab title="400" %}
Bad Request
{% tab title="Model" %}
Error response object.

| Field                    | Type     | Description                          |
| ------------------------ | -------- | ------------------------------------ |
| errors [*required*] | [string] | Array of errors returned by the API. |

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
Error response object.

| Field                    | Type     | Description                          |
| ------------------------ | -------- | ------------------------------------ |
| errors [*required*] | [string] | Array of errors returned by the API. |

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
Error response object.

| Field                    | Type     | Description                          |
| ------------------------ | -------- | ------------------------------------ |
| errors [*required*] | [string] | Array of errors returned by the API. |

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
                  \# Required query arguments export from="CHANGE_ME" export to="CHANGE_ME" export query="CHANGE_ME" \# Curl command curl -X GET "https://api.datadoghq.com/api/v1/query?from=${from}&to=${to}&query=${query}" \
-H "Accept: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" 
                
##### 

```python
"""
Query timeseries points returns "OK" response
"""

from datetime import datetime
from dateutil.relativedelta import relativedelta
from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v1.api.metrics_api import MetricsApi

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = MetricsApi(api_client)
    response = api_instance.query_metrics(
        _from=int((datetime.now() + relativedelta(days=-1)).timestamp()),
        to=int(datetime.now().timestamp()),
        query="system.cpu.idle{*}",
    )

    print(response)
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=python) and then save the example to `example.py` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" python3 "example.py"
##### 

```ruby
# Query timeseries points returns "OK" response

require "datadog_api_client"
api_instance = DatadogAPIClient::V1::MetricsAPI.new
p api_instance.query_metrics((Time.now + -1 * 86400).to_i, Time.now.to_i, "system.cpu.idle{*}")
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=ruby) and then save the example to `example.rb` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" rb "example.rb"
##### 

```go
// Query timeseries points returns "OK" response

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV1"
)

func main() {
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV1.NewMetricsApi(apiClient)
	resp, r, err := api.QueryMetrics(ctx, time.Now().AddDate(0, 0, -1).Unix(), time.Now().Unix(), "system.cpu.idle{*}")

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MetricsApi.QueryMetrics`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `MetricsApi.QueryMetrics`:\n%s\n", responseContent)
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=go) and then save the example to `main.go` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" go run "main.go"
##### 

```java
// Query timeseries points returns "OK" response
import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v1.api.MetricsApi;
import com.datadog.api.client.v1.model.MetricsQueryResponse;
import java.time.OffsetDateTime;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    MetricsApi apiInstance = new MetricsApi(defaultClient);

    try {
      MetricsQueryResponse result =
          apiInstance.queryMetrics(
              OffsetDateTime.now().plusDays(-1).toInstant().getEpochSecond(),
              OffsetDateTime.now().toInstant().getEpochSecond(),
              "system.cpu.idle{*}");
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MetricsApi#queryMetrics");
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

```rust
// Query timeseries points returns "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV1::api_metrics::MetricsAPI;

#[tokio::main]
async fn main() {
    let configuration = datadog::Configuration::new();
    let api = MetricsAPI::with_config(configuration);
    let resp = api
        .query_metrics(1636542671, 1636629071, "system.cpu.idle{*}".to_string())
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
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" cargo run
##### 

```typescript
/**
 * Query timeseries points returns "OK" response
 */

import { client, v1 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v1.MetricsApi(configuration);

const params: v1.MetricsApiQueryMetricsRequest = {
  from: Math.round(
    new Date(new Date().getTime() + -1 * 86400 * 1000).getTime() / 1000
  ),
  to: Math.round(new Date().getTime() / 1000),
  query: "system.cpu.idle{*}",
};

apiInstance
  .queryMetrics(params)
  .then((data: v1.MetricsQueryResponse) => {
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
