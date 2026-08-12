# Datadog — Incidents API: Get a list of incidents (GET /api/v2/incidents)

- Source URL: https://docs.datadoghq.com/api/latest/incidents/get-a-list-of-incidents.md
- Accessed: 2026-08-12 (native vendor markdown mirror served by docs.datadoghq.com, fetched verbatim with curl)

---
title: Get a list of incidents
description: Datadog, the leading service for cloud-scale monitoring.
breadcrumbs: Docs > API Reference > Incidents
---

> For the complete documentation index, see [llms.txt](https://docs.datadoghq.com/llms.txt).

# Get a list of incidents{% #get-a-list-of-incidents %}
Copy pageCopied
{% tab title="v2" %}
**Note**: This endpoint is in public beta. If you have any feedback, contact [Datadog support](https://docs.datadoghq.com/help/).
| Datadog site      | API endpoint                                       |
| ----------------- | -------------------------------------------------- |
| ap1.datadoghq.com | GET https://api.ap1.datadoghq.com/api/v2/incidents |
| ap2.datadoghq.com | GET https://api.ap2.datadoghq.com/api/v2/incidents |
| app.datadoghq.eu  | GET https://api.datadoghq.eu/api/v2/incidents      |
| app.ddog-gov.com  | GET https://api.ddog-gov.com/api/v2/incidents      |
| us2.ddog-gov.com  | GET https://api.us2.ddog-gov.com/api/v2/incidents  |
| uk1.datadoghq.com | GET https://api.uk1.datadoghq.com/api/v2/incidents |
| app.datadoghq.com | GET https://api.datadoghq.com/api/v2/incidents     |
| us3.datadoghq.com | GET https://api.us3.datadoghq.com/api/v2/incidents |
| us5.datadoghq.com | GET https://api.us5.datadoghq.com/api/v2/incidents |

### Overview

Get all incidents for the user's organization. This endpoint requires the `incident_read` permission.

OAuth apps require the `incident_read` authorization [scope](https://docs.datadoghq.com/api/latest/scopes.md#incidents) to access this endpoint.



### Arguments

#### Query Strings

| Name         | Type    | Description                                                                  |
| ------------ | ------- | ---------------------------------------------------------------------------- |
| include      | array   | Specifies which types of related objects should be included in the response. |
| page[size]   | integer | Size for a given page. The maximum allowed value is 100.                     |
| page[offset] | integer | Specific offset to use as the beginning of the returned page.                |

### Response

{% tab title="200" %}
OK
{% tab title="Model" %}
Response with a list of incidents.

| Parent field                | Field                           | Type            | Description                                                                                                                                             |
| --------------------------- | ------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
|                             | data [*required*]          | [object]        | An array of incidents.                                                                                                                                  |
| data                        | attributes                      | object          | The incident's attributes from a response.                                                                                                              |
| attributes                  | archived                        | date-time       | Timestamp of when the incident was archived.                                                                                                            |
| attributes                  | case_id                         | int64           | The incident case id.                                                                                                                                   |
| attributes                  | created                         | date-time       | Timestamp when the incident was created.                                                                                                                |
| attributes                  | customer_impact_duration        | int64           | Length of the incident's customer impact in seconds. Equals the difference between `customer_impact_start` and `customer_impact_end`.                   |
| attributes                  | customer_impact_end             | date-time       | Timestamp when customers were no longer impacted by the incident.                                                                                       |
| attributes                  | customer_impact_scope           | string          | A summary of the impact customers experienced during the incident.                                                                                      |
| attributes                  | customer_impact_start           | date-time       | Timestamp when customers began being impacted by the incident.                                                                                          |
| attributes                  | customer_impacted               | boolean         | A flag indicating whether the incident caused customer impact.                                                                                          |
| attributes                  | declared                        | date-time       | Timestamp when the incident was declared.                                                                                                               |
| attributes                  | declared_by                     | object          | Incident's non Datadog creator.                                                                                                                         |
| declared_by                 | image_48_px                     | string          | Non Datadog creator `48px` image.                                                                                                                       |
| declared_by                 | name                            | string          | Non Datadog creator name.                                                                                                                               |
| attributes                  | declared_by_uuid                | string          | UUID of the user who declared the incident.                                                                                                             |
| attributes                  | detected                        | date-time       | Timestamp when the incident was detected.                                                                                                               |
| attributes                  | fields                          | object          | A condensed view of the user-defined fields attached to incidents.                                                                                      |
| additionalProperties        | <any-key>                       |  <oneOf>   | Dynamic fields for which selections can be made, with field names as keys.                                                                              |
| <any-key>                   | Object 1                        | object          | A field with a single value selected.                                                                                                                   |
| Object 1                    | type                            | enum            | Type of the single value field definitions. Allowed enum values: `dropdown,textbox`                                                                     |
| Object 1                    | value                           | string          | The single value selected for this field.                                                                                                               |
| <any-key>                   | Object 2                        | object          | A field with potentially multiple values selected.                                                                                                      |
| Object 2                    | type                            | enum            | Type of the multiple value field definitions. Allowed enum values: `multiselect,textarray,metrictag,autocomplete`                                       |
| Object 2                    | value                           | [string]        | The multiple values selected for this field.                                                                                                            |
| attributes                  | incident_type_uuid              | string          | A unique identifier that represents an incident type.                                                                                                   |
| attributes                  | is_test                         | boolean         | A flag indicating whether the incident is a test incident.                                                                                              |
| attributes                  | modified                        | date-time       | Timestamp when the incident was last modified.                                                                                                          |
| attributes                  | non_datadog_creator             | object          | Incident's non Datadog creator.                                                                                                                         |
| non_datadog_creator         | image_48_px                     | string          | Non Datadog creator `48px` image.                                                                                                                       |
| non_datadog_creator         | name                            | string          | Non Datadog creator name.                                                                                                                               |
| attributes                  | notification_handles            | [object]        | Notification handles that will be notified of the incident during update.                                                                               |
| notification_handles        | display_name                    | string          | The name of the notified handle.                                                                                                                        |
| notification_handles        | handle                          | string          | The handle used for the notification. This includes an email address, Slack channel, or workflow.                                                       |
| attributes                  | public_id                       | int64           | The monotonically increasing integer ID for the incident.                                                                                               |
| attributes                  | resolved                        | date-time       | Timestamp when the incident's state was last changed from active or stable to resolved or completed.                                                    |
| attributes                  | severity                        | enum            | The incident severity. Allowed enum values: `UNKNOWN,SEV-0,SEV-1,SEV-2,SEV-3,SEV-4,SEV-5`                                                               |
| attributes                  | state                           | string          | The state incident.                                                                                                                                     |
| attributes                  | time_to_detect                  | int64           | The amount of time in seconds to detect the incident. Equals the difference between `customer_impact_start` and `detected`.                             |
| attributes                  | time_to_internal_response       | int64           | The amount of time in seconds to call incident after detection. Equals the difference of `detected` and `created`.                                      |
| attributes                  | time_to_repair                  | int64           | The amount of time in seconds to resolve customer impact after detecting the issue. Equals the difference between `customer_impact_end` and `detected`. |
| attributes                  | time_to_resolve                 | int64           | The amount of time in seconds to resolve the incident after it was created. Equals the difference between `created` and `resolved`.                     |
| attributes                  | title [*required*]         | string          | The title of the incident, which summarizes what happened.                                                                                              |
| attributes                  | visibility                      | string          | The incident visibility status.                                                                                                                         |
| data                        | id [*required*]            | string          | The incident's ID.                                                                                                                                      |
| data                        | relationships                   | object          | The incident's relationships from a response.                                                                                                           |
| relationships               | attachments                     | object          | A relationship reference for attachments.                                                                                                               |
| attachments                 | data [*required*]          | [object]        | An array of incident attachments.                                                                                                                       |
| data                        | id [*required*]            | string          | A unique identifier that represents the attachment.                                                                                                     |
| data                        | type [*required*]          | enum            | The incident attachment resource type. Allowed enum values: `incident_attachments`                                                                      |
| relationships               | commander_user                  | object          | Relationship to user.                                                                                                                                   |
| commander_user              | data [*required*]          | object          | Relationship to user object.                                                                                                                            |
| data                        | id [*required*]            | string          | A unique identifier that represents the user.                                                                                                           |
| data                        | type [*required*]          | enum            | Users resource type. Allowed enum values: `users`                                                                                                       |
| relationships               | created_by_user                 | object          | Relationship to user.                                                                                                                                   |
| created_by_user             | data [*required*]          | object          | Relationship to user object.                                                                                                                            |
| data                        | id [*required*]            | string          | A unique identifier that represents the user.                                                                                                           |
| data                        | type [*required*]          | enum            | Users resource type. Allowed enum values: `users`                                                                                                       |
| relationships               | declared_by_user                | object          | Relationship to user.                                                                                                                                   |
| declared_by_user            | data [*required*]          | object          | Relationship to user object.                                                                                                                            |
| data                        | id [*required*]            | string          | A unique identifier that represents the user.                                                                                                           |
| data                        | type [*required*]          | enum            | Users resource type. Allowed enum values: `users`                                                                                                       |
| relationships               | impacts                         | object          | Relationship to impacts.                                                                                                                                |
| impacts                     | data [*required*]          | [object]        | An array of incident impacts.                                                                                                                           |
| data                        | id [*required*]            | string          | A unique identifier that represents the impact.                                                                                                         |
| data                        | type [*required*]          | enum            | The incident impacts type. Allowed enum values: `incident_impacts`                                                                                      |
| relationships               | integrations                    | object          | A relationship reference for multiple integration metadata objects.                                                                                     |
| integrations                | data [*required*]          | [object]        | Integration metadata relationship array                                                                                                                 |
| data                        | id [*required*]            | string          | A unique identifier that represents the integration metadata.                                                                                           |
| data                        | type [*required*]          | enum            | Integration metadata resource type. Allowed enum values: `incident_integrations`                                                                        |
| relationships               | last_modified_by_user           | object          | Relationship to user.                                                                                                                                   |
| last_modified_by_user       | data [*required*]          | object          | Relationship to user object.                                                                                                                            |
| data                        | id [*required*]            | string          | A unique identifier that represents the user.                                                                                                           |
| data                        | type [*required*]          | enum            | Users resource type. Allowed enum values: `users`                                                                                                       |
| relationships               | responders                      | object          | Relationship to incident responders.                                                                                                                    |
| responders                  | data [*required*]          | [object]        | An array of incident responders.                                                                                                                        |
| data                        | id [*required*]            | string          | A unique identifier that represents the responder.                                                                                                      |
| data                        | type [*required*]          | enum            | The incident responders type. Allowed enum values: `incident_responders`                                                                                |
| relationships               | user_defined_fields             | object          | Relationship to incident user defined fields.                                                                                                           |
| user_defined_fields         | data [*required*]          | [object]        | An array of user defined fields.                                                                                                                        |
| data                        | id [*required*]            | string          | A unique identifier that represents the responder.                                                                                                      |
| data                        | type [*required*]          | enum            | The incident user defined fields type. Allowed enum values: `user_defined_field`                                                                        |
| data                        | type [*required*]          | enum            | Incident resource type. Allowed enum values: `incidents`                                                                                                |
|                             | included                        | [ <oneOf>] | Included related resources that the user requested.                                                                                                     |
| included                    | <type=users>                    | object          | User object returned by the API.                                                                                                                        |
| <type=users>                | attributes                      | object          | Attributes of user object returned by the API.                                                                                                          |
| attributes                  | email                           | string          | Email of the user.                                                                                                                                      |
| attributes                  | handle                          | string          | Handle of the user.                                                                                                                                     |
| attributes                  | icon                            | string          | URL of the user's icon.                                                                                                                                 |
| attributes                  | name                            | string          | Name of the user.                                                                                                                                       |
| attributes                  | uuid                            | string          | UUID of the user.                                                                                                                                       |
| <type=users>                | id                              | string          | ID of the user.                                                                                                                                         |
| <type=users>                | type                            | enum            | Users resource type. Allowed enum values: `users`                                                                                                       |
| included                    | <type=incident_attachments>     | object          | Attachment data from a response.                                                                                                                        |
| <type=incident_attachments> | attributes [*required*]    | object          | The attachment's attributes.                                                                                                                            |
| attributes                  | attachment                      | object          | The attachment object.                                                                                                                                  |
| attachment                  | documentUrl                     | string          | The URL of the attachment.                                                                                                                              |
| attachment                  | title                           | string          | The title of the attachment.                                                                                                                            |
| attributes                  | attachment_type                 | enum            | The type of the attachment. Allowed enum values: `postmortem,link`                                                                                      |
| attributes                  | modified                        | date-time       | Timestamp when the attachment was last modified.                                                                                                        |
| <type=incident_attachments> | id [*required*]            | string          | The unique identifier of the attachment.                                                                                                                |
| <type=incident_attachments> | relationships [*required*] | object          | The attachment's resource relationships.                                                                                                                |
| relationships               | incident                        | object          | Relationship to incident.                                                                                                                               |
| incident                    | data [*required*]          | object          | Relationship to incident object.                                                                                                                        |
| data                        | id [*required*]            | string          | A unique identifier that represents the incident.                                                                                                       |
| data                        | type [*required*]          | enum            | Incident resource type. Allowed enum values: `incidents`                                                                                                |
| relationships               | last_modified_by_user           | object          | Relationship to user.                                                                                                                                   |
| last_modified_by_user       | data [*required*]          | object          | Relationship to user object.                                                                                                                            |
| data                        | id [*required*]            | string          | A unique identifier that represents the user.                                                                                                           |
| data                        | type [*required*]          | enum            | Users resource type. Allowed enum values: `users`                                                                                                       |
| <type=incident_attachments> | type [*required*]          | enum            | The incident attachment resource type. Allowed enum values: `incident_attachments`                                                                      |
|                             | meta                            | object          | The metadata object containing pagination metadata.                                                                                                     |
| meta                        | pagination                      | object          | Pagination properties.                                                                                                                                  |
| pagination                  | next_offset                     | int64           | The index of the first element in the next page of results. Equal to page size added to the current offset.                                             |
| pagination                  | offset                          | int64           | The index of the first element in the results.                                                                                                          |
| pagination                  | size                            | int64           | Maximum size of pages to return.                                                                                                                        |

{% /tab %}

{% tab title="Example" %}

```json
{
  "data": [
    {
      "attributes": {
        "archived": "2019-09-19T10:00:00.000Z",
        "case_id": "integer",
        "created": "2019-09-19T10:00:00.000Z",
        "customer_impact_duration": "integer",
        "customer_impact_end": "2019-09-19T10:00:00.000Z",
        "customer_impact_scope": "An example customer impact scope",
        "customer_impact_start": "2019-09-19T10:00:00.000Z",
        "customer_impacted": false,
        "declared": "2019-09-19T10:00:00.000Z",
        "declared_by": {
          "image_48_px": "string",
          "name": "string"
        },
        "declared_by_uuid": "string",
        "detected": "2019-09-19T10:00:00.000Z",
        "fields": {
          "<any-key>": "undefined"
        },
        "incident_type_uuid": "00000000-0000-0000-0000-000000000000",
        "is_test": false,
        "modified": "2019-09-19T10:00:00.000Z",
        "non_datadog_creator": {
          "image_48_px": "string",
          "name": "string"
        },
        "notification_handles": [
          {
            "display_name": "Jane Doe",
            "handle": "@test.user@test.com"
          }
        ],
        "public_id": 1,
        "resolved": "2019-09-19T10:00:00.000Z",
        "severity": "UNKNOWN",
        "state": "string",
        "time_to_detect": "integer",
        "time_to_internal_response": "integer",
        "time_to_repair": "integer",
        "time_to_resolve": "integer",
        "title": "A test incident title",
        "visibility": "string"
      },
      "id": "00000000-0000-0000-1234-000000000000",
      "relationships": {
        "attachments": {
          "data": [
            {
              "id": "00000000-0000-abcd-1000-000000000000",
              "type": "incident_attachments"
            }
          ]
        },
        "commander_user": {
          "data": {
            "id": "00000000-0000-0000-0000-000000000000",
            "type": "users"
          }
        },
        "created_by_user": {
          "data": {
            "id": "00000000-0000-0000-2345-000000000000",
            "type": "users"
          }
        },
        "declared_by_user": {
          "data": {
            "id": "00000000-0000-0000-2345-000000000000",
            "type": "users"
          }
        },
        "impacts": {
          "data": [
            {
              "id": "00000000-0000-0000-2345-000000000000",
              "type": "incident_impacts"
            }
          ]
        },
        "integrations": {
          "data": [
            {
              "id": "00000000-abcd-0001-0000-000000000000",
              "type": "incident_integrations"
            }
          ]
        },
        "last_modified_by_user": {
          "data": {
            "id": "00000000-0000-0000-2345-000000000000",
            "type": "users"
          }
        },
        "responders": {
          "data": [
            {
              "id": "00000000-0000-0000-2345-000000000000",
              "type": "incident_responders"
            }
          ]
        },
        "user_defined_fields": {
          "data": [
            {
              "id": "00000000-0000-0000-2345-000000000000",
              "type": "user_defined_field"
            }
          ]
        }
      },
      "type": "incidents"
    }
  ],
  "included": [
    {
      "attributes": {
        "email": "string",
        "handle": "string",
        "icon": "string",
        "name": "string",
        "uuid": "string"
      },
      "id": "string",
      "type": "users"
    }
  ],
  "meta": {
    "pagination": {
      "next_offset": 1000,
      "offset": 10,
      "size": 1000
    }
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

{% tab title="404" %}
Not Found
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
                  \# Curl command curl -X GET "https://api.datadoghq.com/api/v2/incidents" \
-H "Accept: application/json" \
-H "DD-API-KEY: ${DD_API_KEY}" \
-H "DD-APPLICATION-KEY: ${DD_APP_KEY}" 
                
##### 

```python
"""
Get a list of incidents returns "OK" response
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.incidents_api import IncidentsApi

configuration = Configuration()
configuration.unstable_operations["list_incidents"] = True
with ApiClient(configuration) as api_client:
    api_instance = IncidentsApi(api_client)
    response = api_instance.list_incidents()

    print(response)
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=python) and then save the example to `example.py` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" python3 "example.py"
##### 

```ruby
# Get a list of incidents returns "OK" response

require "datadog_api_client"
DatadogAPIClient.configure do |config|
  config.unstable_operations["v2.list_incidents".to_sym] = true
end
api_instance = DatadogAPIClient::V2::IncidentsAPI.new
p api_instance.list_incidents()
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=ruby) and then save the example to `example.rb` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" rb "example.rb"
##### 

```go
// Get a list of incidents returns "OK" response

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
	configuration.SetUnstableOperationEnabled("v2.ListIncidents", true)
	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewIncidentsApi(apiClient)
	resp, r, err := api.ListIncidents(ctx, *datadogV2.NewListIncidentsOptionalParameters())

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `IncidentsApi.ListIncidents`: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}

	responseContent, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Fprintf(os.Stdout, "Response from `IncidentsApi.ListIncidents`:\n%s\n", responseContent)
}
```

#### Instructions

First [install the library and its dependencies](https://docs.datadoghq.com/api/latest.md?code-lang=go) and then save the example to `main.go` and run following commands:
    DD_SITE="datadoghq.com" DD_API_KEY="<DD_API_KEY>" DD_APP_KEY="<DD_APP_KEY>" go run "main.go"
##### 

```java
// Get a list of incidents returns "OK" response

import com.datadog.api.client.ApiClient;
import com.datadog.api.client.ApiException;
import com.datadog.api.client.v2.api.IncidentsApi;
import com.datadog.api.client.v2.model.IncidentsResponse;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = ApiClient.getDefaultApiClient();
    defaultClient.setUnstableOperationEnabled("v2.listIncidents", true);
    IncidentsApi apiInstance = new IncidentsApi(defaultClient);

    try {
      IncidentsResponse result = apiInstance.listIncidents();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling IncidentsApi#listIncidents");
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
// Get a list of incidents returns "OK" response
use datadog_api_client::datadog;
use datadog_api_client::datadogV2::api_incidents::IncidentsAPI;
use datadog_api_client::datadogV2::api_incidents::ListIncidentsOptionalParams;

#[tokio::main]
async fn main() {
    let mut configuration = datadog::Configuration::new();
    configuration.set_unstable_operation_enabled("v2.ListIncidents", true);
    let api = IncidentsAPI::with_config(configuration);
    let resp = api
        .list_incidents(ListIncidentsOptionalParams::default())
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
 * Get a list of incidents returns "OK" response
 */

import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
configuration.unstableOperations["v2.listIncidents"] = true;
const apiInstance = new v2.IncidentsApi(configuration);

apiInstance
  .listIncidents()
  .then((data: v2.IncidentsResponse) => {
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
