# Datadog — OpenAPI v2 spec extracts (page-limit defaults/maxima)

- Source URL: https://raw.githubusercontent.com/DataDog/datadog-api-client-python/master/.generator/schemas/v2/openapi.yaml
- Accessed: 2026-08-12 (7,603,053-byte YAML fetched with curl; extracts below verbatim)

```yaml
    LogsListRequestPage:
      description: Paging attributes for listing logs.
      properties:
        cursor:
          description: |-
            List following results with a cursor provided in the previous query.
          example: "eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ=="
          type: string
        limit:
          default: 10
          description: Maximum number of logs in the response.
          example: 25
          format: int32
          maximum: 1000
          type: integer

    SpansListRequestPage:
      description: Paging attributes for listing spans.
      properties:
        cursor:
          description: |-
            List following results with a cursor provided in the previous query.
          example: "eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ=="
          type: string
        limit:
          default: 10
          description: Maximum number of spans in the response.
          example: 25
          format: int32
          maximum: 1000
          type: integer
      type: object

    EventsRequestPage:
      description: Pagination settings.
      properties:
        cursor:
          description: The returned paging point to use to get the next results.
          example: "eyJzdGFydEF0IjoiQVFBQUFYS2tMS3pPbm40NGV3QUFBQUJCV0V0clRFdDZVbG8zY3pCRmNsbHJiVmxDWlEifQ=="
          type: string
        limit:
          default: 10
          description: The maximum number of logs in the response.
          example: 25
          format: int32
          maximum: 1000
          type: integer
      type: object

    TimeseriesFormulaRequestType:
      default: "timeseries_request"
      description: The type of the resource. The value should always be timeseries_request.
      enum: ["timeseries_request"]
      example: "timeseries_request"
      type: string
      x-enum-varnames: ["TIMESERIES_REQUEST"]
```
