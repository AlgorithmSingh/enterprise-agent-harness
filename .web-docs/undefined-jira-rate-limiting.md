Source: https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
Accessed: 2026-08-12
Note: Faithful tag-stripped text of the fetched page (page shows 'Last updated Aug 12, 2026').

---

 
 Rate limiting 
 Developer Documentation 
 Resources 
 News and Updates 
 Get Support 
 Sign in
 Developer 
 Get Support 
 Sign in
 DOCUMENTATION
 Cloud
 Data Center
 Resources
 News and Updates
 Get support
 Sign in
 Developer 
 Sign in
 DOCUMENTATION
 Cloud
 Data Center
 Resources
 News and Updates
 Get support
 Sign in
 Jira Cloud platform
 Guides 
 Reference 
 REST API Document Format Jira expressions Entity properties JQL search extensibility Connect 
 Resources 
 Changelog 
 Jira Cloud platform
 Guides 
 Reference 
 Resources 
 Changelog 
 About Jira Cloud platform 
 Introduction and basics
 Getting started with Forge 
 Security
 Security overview 
 Security for Forge apps 
 Scopes for OAuth 2.0 (3LO) and Forge apps 
 OAuth 2.0 (3LO) apps 
 Basic auth for REST APIs 
 Data security policy developer guide 
 Learning
 Forge tutorials and example apps 
 Rate limiting 
 Bulk Operation APIs: Additional Examples and FAQs 
 Privacy guidelines
 User privacy guide for app developers 
 Profile visibility 
 Building blocks
 Forge concepts 
 Storing data with entity properties 
 Jira expressions 
 Other considerations
 Atlassian Design Guidelines 
 Atlaskit 
 Atlassian Marketplace 
 Cloud app licensing 
 Developer canary program 
 Developing apps for Jira Cloud mobile 
 Last updated Aug 12, 2026 
 Developing for Atlassian Government Cloud? 
 This content is written with standard cloud development in mind. To learn about developing for Atlassian Government Cloud, go to our Atlassian Government Cloud developer portal .
 Enforcement of the new points-based API rate limits and tiered quota rate limits for Jira and Confluence Cloud apps will begin on March 2, 2026
 This change is designed to ensure consistent performance and fair usage. The new rate limits will apply to all Forge, Connect, and OAuth 2.0 (3LO) apps. If your app integrates with Jira or Confluence Cloud, we recommend reviewing the updated documentation on rate limits and best practices for optimizing API usage. API token-based traffic is not affected by this change, and will continue to be governed by existing burst rate limits.
 See the Jira Cloud Platform changelog for more details.
 Rate limiting 
 Rate limiting controls how many API requests your app or integration can make to Jira Cloud within a given time period. This ensures platform stability, fair resource allocation, and a reliable experience for all users.
 Overview: Understanding Jira's rate limiting systems 
 Jira Cloud enforces three independent rate limiting systems that work simultaneously to protect platform stability. Your app or integration must handle all three:
 Points-based quota (per-hour): Measures the total "work" your app performs each hour using a points system. Each API call consumes points based on the complexity and amount of data involved.
 Burst API rate limits (per-second): Restricts how many requests you can make per second to each API endpoint. These limits protect against traffic spikes and ensure fair access for all users. Your app should be designed to stay within the steady-state request limits; occasional spikes beyond this limit may be tolerated temporarily due to a burst buffer.
 Per-issue write limits: Restricts how frequently you can modify a single issue to prevent excessive updates to individual resources.
 When any limit is exceeded, Jira returns an HTTP 429 Too Many Requests response. Your app should handle this gracefully by respecting the Retry-After header and implementing appropriate backoff strategies.
 Why rate limiting matters 
 Without rate limits, a single app could consume excessive resources, slowing down the platform for everyone. Rate limiting protects against:
 Service degradation: Prevents one app from overwhelming shared infrastructure.
 Resource fairness: Ensures all apps get equitable access to API capacity.
 System stability: Guards against accidental or malicious traffic spikes.
 Points-based rate limiting 
 Jira Cloud uses a points-based model to measure API usage. Instead of simply counting requests, each API call consumes points based on the work it performs—such as the amount of data returned or the complexity of the operation.
 This approach offers several benefits:
 Fairer limits: Heavy operations consume more quota than simple ones.
 Predictable usage: You can estimate your quota consumption based on your API patterns.
 Tiered quotas: Most apps share a global hourly quota. Apps with sustained high usage may qualify for per-tenant quotas after review.
 Consistent model: The same points system applies to both REST and GraphQL APIs.
 Most apps operate comfortably within the default quota. If your app exceeds limits, follow the optimization guidance below or reach out for a quota review.
 How points work 
 Points are calculated based on the type of API request and the objects affected. Each request starts with a base cost of 1 point, and additional points are added for each object involved. Write requests are charged only the base cost, with no additional points.
 This straightforward model applies to both REST and GraphQL APIs. This table provides the object costs break down:
 Operation type Cost (points) Applies to Examples 
 Core domain objects ( GET , GraphQL query ) 1 point Standard read operations on primary content Issues, Projects, Dashboards, Attachments 
 Identity & access ( GET , GraphQL query ) 2 points Reads involving authentication or permissions Users, Groups, Project Roles, Permissions 
 Write / modify / delete ( POST , PUT , PATCH , DELETE , GraphQL mutation ) 1 point Operations that create, update, or remove data Create or edit issues 
 Others 1 point Read operations on uncategorized objects Endpoints or fields not listed above (default cost applies) 
 Note: We plan to expand our catalog in the future to provide more detail on object costs. Most requests are dominated by object costs.
 Points-based rate limit quotas by tiers 
 All quotas are measured in points per hour and reset at the top of each UTC hour.
 Your app's hourly quota depends on two factors:
 Rate limit tier: Global Pool (default) or Per-Tenant Pool.
 Customer edition: In the Per-Tenant Pool, Free, Standard, Premium, or Enterprise and the number of users.
 Tier 1 – Global Pool (default) 
 Your app shares a single 65,000 point hourly quota across all tenants. This is the default tier for all apps. Most apps operate comfortably within the Global Pool.
 Tier 2 – Per-Tenant Pool 
 Your app receives a separate hourly quota for each tenant, with limits varying by their edition. Only apps with exceptionally high or concentrated usage patterns may be assigned to the Per-Tenant Pool after review.
 Tier Free Standard Premium Enterprise 
 Tier 1 – Global Pool 65,000 points/hour — single shared quota across all tenants 
 Tier 2 – Per-Tenant Pool 65,000 points/hour 100,000 + 10 × users points/hour 130,000 + 20 × users points/hour 150,000 + 30 × users points/hour 
 How Tier 2 limits are calculated (for apps assigned to this tier): 
For apps operating in the Per-Tenant Pool, each tenant receives a quota based on their edition and user count:
 Standard : 100,000 base + 10 points per user per hour
 Premium : 130,000 base + 20 points per user per hour
 Enterprise : 150,000 base + 30 points per user per hour
 Per-tenant rate limits are capped at 500,000 points per hour for Standard, Premium, and Enterprise editions.
 Quota calculation examples 
 Standard tenant with 2,000 users: 
100,000 + (10 × 2,000) = 120,000 → 120,000 points/hour 
 Enterprise tenant with 15,000 users: 
150,000 + (30 × 15,000) = 600,000 → 500,000 points/hour (capped) 
 API operation examples 
 The following examples show how points are calculated for common Jira REST API operations.
 Read operations 
 Scenario: 
Amy is building an integration that syncs Jira issues to an external dashboard, she fetches a single issue:
 1
2
 GET /rest/api/3/issue/ABC-123 
 Cost calculation 
 1
2
 1 (base) + 1 Issue = 2 points
 Later, Amy’s integration fetches all members of a group using the group membership API. Since each user object costs 2 points, the request is more expensive:
 1
2
 GET /rest/api/3/group/member?groupname=my-group 
 Cost calculation 
 1
2
 1 (base) + 8 users = 17 points (1 + 8 × 2)`
 Write operations 
 Scenario: 
Alex is automating issue creation for a support workflow. All write operations cost 1 point regardless of object type:
 1
2
 POST /rest/api/3/issue → 1 point
 If Alex's script creates 50 issues in a batch, that's 50 points consumed from the quota (50 issues × 1 point each).
 Burst API Rate Limit 
 Burst API rate limiting in Jira Cloud controls how many requests a single tenant can send per second to a given REST API endpoint. This is a short term “spike” safeguard that is separate from the hourly, points based rate limit.
 Key properties:
 It is enforced per tenant and per API/resource path 
(for example, /rest/api/3/issue and /rest/api/3/search each have their own burst behavior for the same tenant).
 The burst limit is independent of the number of users in the tenant; adding more users does not increase this per second allowance.
 Hitting the burst threshold for one endpoint affects only that endpoint for that tenant; other endpoints and other tenants are unaffected.
 Even if you are within your hourly points quota , exceeding the per second threshold for a specific endpoint will trigger burst limit responses (such as HTTP 429) for that endpoint.
 Why Burst API Rate Limit exist 
 Even if you have sufficient hourly quota remaining, sending too many requests in a short time can overwhelm specific services. Burst API Rate Limit ensures that:
 Traffic patterns remain sustainable for shared infrastructure
 Individual tenants cannot monopolize endpoint capacity
 All customers experience consistent API performance
 Steady-state limits and burst buffer 
 Jira implements Burst API Rate Limit using the token bucket algorithm . Here's how it works:
 Token buckets per endpoint: 
For each tenant, Jira maintains a separate token bucket for every API endpoint. Each bucket holds a certain number of tokens, and the number of available tokens at any moment determines how many requests to that endpoint are allowed in a given second.
 Steady-state vs burst capacity: 
Each endpoint has two key parameters:
 Steady-state refill rate: The sustained number of requests per second your app should be designed to handle (e.g., 10 requests/second)
 Burst buffer: The total bucket size that allows for temporary traffic spikes above the steady-state rate (e.g., 100 tokens)
 Design for steady-state limits: Your app should be designed around the steady-state refill rate, not the burst buffer. The burst buffer exists to absorb occasional spikes, but relying on it for normal operations will lead to rate limit errors.
 Consuming tokens: 
Each API request consumes one token from that endpoint's bucket. For example, if the GET /rest/api/3/issue/{issueIdOrKey} endpoint has a bucket size of 100 tokens and a refill rate of 10 tokens/second, you can send up to 100 requests immediately. However, if you exceed that limit within a second, additional requests to that endpoint will be rejected with HTTP 429 until tokens are available. Requests to other endpoints remain unaffected.
 Automatic refill (steady-state rate): 
Buckets automatically refill at the steady-state rate. If the bucket is below its maximum capacity, a set number of tokens is added back every second until it reaches its maximum capacity. Tokens that would exceed the maximum capacity are discarded. For example, the GET /rest/api/3/issue/{issueIdOrKey} endpoint with a bucket size of 100 tokens and a refill rate of 10 tokens per second will take 10 seconds to fully refill after being completely drained.
 Sustainable usage: 
You don't need to wait for the bucket to completely refill before sending more requests. New tokens can be consumed as soon as they're added. For sustainable operation, design your app to use the steady-state refill rate. For example, with a 100-token bucket and 10 tokens/second refill rate, after exhausting the bucket with 100 requests, you can sustain a steady rate of 10 requests per second indefinitely by consuming tokens as they're added. The bucket will only refill to full capacity if you make fewer than 10 requests per second.
 Burst API Rate Limit response 
 When a request rate limit is exceeded for a specific API endpoint, Jira returns a standard rate limit response with the following headers:
 HTTP status : 429 Too Many Requests 
 Rate limit reason : RateLimit-Reason: jira-burst-based 
 Other rate limit headers : describing the current window and remaining capacity (see Rate limit related headers )
 Rate limited response example 
 1
2
 HTTP/1.1 429 Too Many Requests
Retry-After: 1
X-RateLimit-Limit: 350
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-01-01T01:01:01Z
RateLimit-Reason: jira-burst-based
Content-Type: application/json
 Burst API Rate Limit Thresholds 
 By default, each REST API endpoint has its own bucket categorised by the HTTP method of the request. The values below show the default steady state requests per second (RPS) limits for the given API based on its HTTP method.
 HTTP method Requests per second 
 GET 100 
 POST 100 
 PUT 50 
 DELETE 50 
 Some API endpoints use custom limits instead of defaults listed above. For these operations, Atlassian maintains an endpoint specific token bucket that overrides default configuration.
 HTTP method URI Requests per second 
 GET /api/content/{id}/state 400 
 GET /rest/api/group/by-id 400 
 GET /api/{version}/pages/{id}/descendants 300 
 GET /servicedeskapi/servicedesk/{servicedeskid}/customer 5 
 GET /api/{version}/issuetype/{issuetypeid}/properties/{propertykey} 300 
 GET /api/{version}/issuesecurityschemes/{schemeid} 200 
 GET /api/{version}/issuesecurityschemes/{id} 200 
 GET /api/analytics/content/{contentid}/views 200 
 GET /api/user/email 200 
 GET /api/{version}/issuetype/{issuetypeid}/properties 200 
 GET /api/{version}/attachment/thumbnail/{id} 200 
 GET /api/{version}/component 200 
 GET /api/{version}/project/{projectidorkey}/role/{id} 200 
 GET /api/content/{id}/child/attachment 200 
 GET /api/search/user 200 
 GET /api/{version}/issue/{issueidorkey}/changelog 200 
 GET /api/{version}/attachment/content/{id} 300 
 GET /api/{version}/issue/{issueidorkey} 150 
 GET /api/{version}/user 150 
 POST /api/{version}/search/approximate-count 150 
 POST /api/{version}/expression/evaluate 150 
 POST /gira/{version} 150 
 POST /api/{version}/permissionscheme/{schemeid}/permission 100 
 POST /security/{version}/bulk 100 
 PUT /api/relation/{relationname}/from/{sourcetype}/{sourcekey}/to/{targettype}/{targetkey} 300 
 PUT /api/{version}/component/{id} 500 
 DELETE /api/content/{id} 500 
 DELETE /api/{version}/custom-content/{id} 300 
 DELETE /api/relation/{relationname}/from/{sourcetype}/{sourcekey}/to/{targettype}/{targetkey} 200 
 DELETE /devinfo/{version}/repository/{repositoryid} 200 
 DELETE /builds/{version}/bulkbyproperties 100 
 Per-issue rate limiting on write operations 
 In addition to the standard rate limiting mechanisms, Jira implements per-issue rate limiting on write operations to protect against scenarios where a single issue receives an excessive number of updates in a short time frame. This rate limiting is designed to prevent system instability and to provide reliable service for all customers.
 What is per-issue rate limiting? 
 Per-issue rate limiting restricts the number of write operations (create, update, delete) that can be performed on a single Jira issue within specific time windows.
 Thresholds 
 Per-issue rate limiting operates with two time windows:
 Short window : 20 write operations per 2 seconds
 Long window : 100 write operations per 30 seconds
 Rate limit response 
 When per-issue rate limiting is triggered, you'll receive:
 HTTP status code : 429 Too Many Requests 
 RateLimit-Reason header : jira-per-issue-on-write 
 Handling all three rate limit types 
 Your app will encounter all three rate limiting mechanisms in production. Here's what you need to know:
 Points-based quota is your primary concern for long-term planning. Design your app to stay well within the hourly quota by optimizing your API usage.
 Burst API Rate Limit prevents traffic spikes on individual endpoints. Design your app around the steady-state request rates (e.g., 10 requests/second for GET endpoints). While burst buffers exist to absorb occasional spikes, relying on them for normal operations will lead to rate limit errors.
 Per-issue write limits only affect write operations to a single issue. If you're updating an issue frequently, implement appropriate delays between updates.
 The next sections explain how Jira enforces these limits and how to respond when you hit them.
 Detecting rate limits 
 All three rate limit types return HTTP 429 Too Many Requests responses. Your app should check for this status code and handle retries appropriately. Different RateLimit-Reason headers indicate which limit was exceeded:
 jira-quota-global-based or jira-quota-tenant-based — Points-based quota exceeded (hourly)
 jira-burst-based — Burst API Rate Limit exceeded (per-second)
 jira-per-issue-on-write — Per-issue write limit exceeded
 Rate limit related headers 
 Beta headers (informational only) 
 Beta headers are informational only and do not trigger enforcement or throttling. You can use them now to monitor your usage and prepare for future enforcement. At enforcement Beta- prefix will be dropped from all beta headers.
 The structured headers ( Beta-RateLimit-Policy and Beta-RateLimit ) follow standardized formats and provide detailed information about your limits.
 These headers are additive and do not replace existing headers during the beta phase. Support for additional limit types may be added in the future and will be announced separately.
 Header format 
 A response header may contain one or more policy entries. Each policy entry consists of:
 A policy name (quoted string)
 One or more attributes expressed as key=value pairs
 Attributes are separated by ; 
 Multiple policy entries are separated by , 
 1
2
 Beta-RateLimit: "<policy-name>";<attribute>=<value>[;<attribute>=<value>], ...
 Clients must not assume a fixed number or ordering. Support for additional services and limit types may be added in the future, and will be announced separately.
 Header parameters 
 Header Parameter Description 
 Beta-RateLimit-Policy q Total quota 
 Beta-RateLimit-Policy w Time window in seconds 
 Beta-RateLimit r Remaining quota. Optionally included. If absent, your app is well within its limits. 
 Beta-RateLimit t Seconds until reset 
 Both Beta-RateLimit and Beta-RateLimit-Policy headers include a policy name indicating the applied quota:
 Policy name Description 
 global-app-quota A quota applied to your app globally across all tenants (Tier 1) 
 tenant-app-quota A quota applied per tenant, per app (Tier 2) 
 jira-burst-based A finer-grained quota applied per API endpoint, per HTTP request method 
 Usage examples 
 All examples below show beta-phase headers (e.g., Beta-RateLimit , Beta-RateLimit-Policy ). At enforcement, these headers will drop the Beta- prefix (e.g., RateLimit , RateLimit-Policy ). Format and behavior are identical, only the prefix differs.
 Normal usage (well below quota) 
 1
2
 Beta-RateLimit-Policy: "global-app-quota";q=65000;w=3600
Beta-RateLimit: "global-app-quota";t=3200
 Since usage is well below the quota, r (remaining) is not included (see parameter table above).
 Near limit (less than ~20% remaining) 
 1
2
 Beta-RateLimit-Policy: "global-app-quota";q=65000;w=3600
Beta-RateLimit: "global-app-quota";r=11000;t=600
 Once usage approaches this threshold, responses will consistently include the remaining quota ( r ). Until the window resets or the quota is exhausted, subsequent responses will continue to include the remaining quota.
 Quota exceeded 
 1
2
 Beta-RateLimit: "global-app-quota";r=0;t=50
Beta-Retry-After: 50
 During the beta period, these headers are informational only — requests will not receive HTTP 429 responses based on quota usage. Beta-Retry-After indicates how long the app would need to wait if enforcement were active. At enforcement, requests that exceed the quota will receive HTTP 429 (Too Many Requests) responses until the quota window resets.
 Enforcement is designed to account for normal variability in traffic, and brief or infrequent spikes may not immediately result in rate limiting. Clients should nevertheless treat published quotas as fixed limits and implement appropriate backoff and retry logic.
 Multiple quotas without any rate limit enforced 
 1
2
 Beta-RateLimit-Policy: "global-app-quota";q=65000;w=3600,"jira-burst-based";q=100;w=1
Beta-RateLimit: "global-app-quota";t=200,"jira-burst-based";r=90;t=1
 In this case, there are two limits being reported here — the global-app-quota limit, and also the jira-burst-based rate limit.
 Multiple quotas with one out of two rate limit enforced 
 1
2
 RateLimit-Policy: "global-app-quota";q=65000;w=3600
RateLimit: "global-app-quota";t=200
Beta-RateLimit-Policy: "jira-burst-based";q=100;w=1
Beta-RateLimit: "jira-burst-based";r=90;t=1
 In the case where one Rate Limit is enforced and the other isn't, a combination of Beta- prefixed and non-prefixed headers will be present in the response.
 Current headers (enforcement active) 
 Header Description 
 X-RateLimit-Limit The maximum request rate enforced for the current rate-limit scope. For request rate limits, this reflects the allowed requests per second. 
 X-RateLimit-Remaining The remaining request capacity within the current rate-limit window. For request rate limits, this represents remaining requests in the current second. 
 X-RateLimit-Reset Only returned with 429 responses. ISO 8601 timestamp when the current window resets. 
 X-RateLimit-NearLimit Returns true when less than 20% of capacity remains. Not used for request rate limiting. 
 RateLimit-Reason Only returned with 429 responses. The reason for throttling:
- jira-quota-global-based — Global pool quota exceeded
- jira-quota-tenant-based — Per-tenant pool quota exceeded
- jira-burst-based — Request rate limit exceeded
- jira-per-issue-on-write — Per-issue write rate limit exceeded 
 Retry-After Only returned with 429 responses. Indicates how many seconds to wait before retrying. 
 Some transient 5xx responses (such as 503) may also include a Retry-After header. While these are not rate limit responses, you can handle them with similar retry logic.
 Legacy beta headers (for existing rate limits): 
 Header Description 
 X-Beta-RateLimit-Limit The maximum request rate enforced for the current rate-limit scope. For request rate limits, this reflects the allowed requests per second. 
 X-Beta-RateLimit-Remaining The remaining request capacity within the current rate-limit window. For request rate limits, this represents remaining requests in the current second. 
 X-Beta-RateLimit-Reset Only returned with responses which would be rate limited at enforcement. ISO 8601 timestamp when the current window resets. 
 X-Beta-RateLimit-NearLimit Returns true when less than 20% of capacity remains. Not used for request rate limiting. 
 X-Beta-RateLimit-Reason Only returned with responses which would be rate limited at enforcement. The reason for throttling:
- jira-quota-global-based — Global pool quota exceeded
- jira-quota-tenant-based — Per-tenant pool quota exceeded
- jira-burst-based — Request rate limit exceeded
- jira-per-issue-on-write — Per-issue write rate limit exceeded 
 Beta-Retry-After Only returned with responses which would be rate limited at enforcement. Indicates how many seconds to wait before retrying. 
 Best practices for handling rate limit responses 
 When you receive a 429 response, here's how to respond effectively:
 Check the Retry-After header for guidance on an appropriate retry delay.
 Use exponential backoff with jitter: Implement retry logic that backs off exponentially rather than retrying immediately. Add random jitter to avoid the thundering herd problem. Only retry if the API is idempotent and the response includes a Retry-After header.
 Respect the rate limit reason: Different RateLimit-Reason values indicate different limits:
 For jira-per-issue-on-write : Add delays between writes to the same issue, but you can continue making other API requests normally.
 For jira-burst-based : Reduce your request rate to the specific endpoint. Requests to other endpoints are unaffected. Remember this limit includes a burst buffer; design your app around the steady-state rate.
 For jira-quota-global-based or jira-quota-tenant-based : Pause all API requests until the window resets. C
 Batch operations strategically: Combine multiple changes into a single request to reduce overall quota consumption:
 Single-issue bulk operations : APIs like bulk delete or move worklogs count as one operation against rate limits, even when processing multiple items.
 Multi-issue bulk operations : Issue bulk operations allow you to affect multiple issues with one request.
 Combined field updates : Merge multiple field updates into a single request instead of multiple calls.
 Design for resilience: In distributed systems, implement patterns that handle rate limiting gracefully:
 Share rate limit status between threads and services to coordinate behavior.
 Track your application's quota consumption to stay well within limits.
 Design your app to handle temporary failures and continue operating.
 Implementing retry logic 
 Here's a practical approach to implementing exponential backoff with jitter:
 Start with a base delay: Begin with a reasonable initial delay (e.g., 2 seconds).
 Respect Retry-After : If present, use the Retry-After header value as the minimum delay.
 Double the delay on each retry: After each 429 response, double the delay up to some maximum (e.g., retry after 2, 4, 8, 16 seconds and so on).
 Add jitter: Multiply the delay by a random factor (e.g; between 0.7 and 1.3) to spread out retry attempts amongst multiple concurrent apps or integrations and avoid the thundering herd problem .
 Set a retry limit: Cap the number of retries (e.g., 4 attempts) to prevent infinite loops.
 Monitor and tune: Adjust these parameters based on your app's specific needs and observed behavior.
 Pseudocode for retry logic: 
 1
2
 let maxRetries = 4;
let lastRetryDelayMillis = 5000;
let maxRetryDelayMillis = 30000;
let jitterMultiplierRange = [0.7, 1.3];
let response = await fetch(...);
if (response is OK) {
 handleSuccess(...);
} else {
 let retryDelayMillis = -1;
 if (hasHeader('Retry-After')) {
 retryDelayMillis = 1000 * headerValue('Retry-After'); 
 } else if (statusCode == 429) {
 retryDelayMillis = min(2 * lastRetryDelayMillis, maxRetryDelayMillis);
 }
 if (retryDelayMillis > 0 && retryCount < maxRetries) {
 retryDelayMillis += retryDelayMillis * randomInRange(jitterMultiplierRange);
 delay(retryDelayMillis);
 retryCount++;
 retryRequest(...);
 } else {
 handleFailure(...);
 }
}
 The following articles provide useful insights and techniques related to retry and backoff processing:
 Exponential backoff article in Wikipedia 
 Error retries and exponential backoff in AWS 
 Example 429 response 
 1
2
 HTTP/1.1 429 Too Many Requests
Retry-After: 1847
X-RateLimit-Limit: 100000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-10-08T15:00:00Z
RateLimit-Reason: jira-quota-global-based
 Optimizing API usage 
 To maximize efficiency and stay well within your rate limits, follow these practices:
 Request only the data you need: Use field filtering and pagination to reduce the amount of data transferred and the points consumed per request.
 Cache stable responses: Use ETags and conditional headers to avoid re-fetching unchanged data.
 Use bulk operations strategically: Bulk operations can reduce the number of HTTP calls and improve efficiency. However, check the point cost for your specific use case and ensure batching actually reduces overall quota usage.
 Leverage webhooks and context parameters: Use webhooks for event-driven updates instead of polling, and use context parameters to minimize the number of API requests needed.
 Distribute requests over time: Spread your requests evenly throughout the hour rather than sending large spikes at predictable times. Add random jitter to scheduled jobs to avoid thundering herd effects when many apps hit the API simultaneously.
 Coordinate across infrastructure: If your app uses multiple threads or nodes, share rate limit status between them to prevent accidental quota exhaustion.
 Avoid using excessive concurrency: While parallelism can improve performance, using it specifically to bypass rate limits will lead to more 429 responses and degraded performance overall.
 Testing and compliance 
 Do not perform rate limit testing against Atlassian cloud tenants, as this may impact customers.
 Follow the Atlassian Acceptable Use Policy to avoid overwhelming Atlassian infrastructure.
 Additional resources 
 Atlassian Acceptable Use Policy , January 24, 2020.
 Efficient Use of Atlassian Cloud REST APIs , Raimonds Simanovskis, Founder and CEO, eazyBI, 2019.
 Exponential Backoff and Jitter , Marc Brooker, 2015.
 These rate limits are designed to provide generous capacity for our developer community. However, to ensure platform stability and protect against abuse, these limits and the policies governing them are subject to change. We will strive to provide notice of significant changes, but we reserve the right to make adjustments as needed to protect the service.
 FAQs 
 Question Answer 
 What's the difference between the Global Pool and Per-Tenant Pool? 
 The Global Pool gives apps a single shared hourly quota across all tenants (65,000 pts/hr).
 The Per-Tenant Pool provides a separate hourly quota per tenant, assigned only after Atlassian review for apps with sustained high or concentrated usage. Most apps remain in the Global Pool.
 Why is Atlassian moving to a points-based rate-limiting model? 
 To make limits fairer and more predictable by measuring actual "work" objects, nesting, permissions instead of raw request count.
 This protects platform stability and ensures heavy operations consume more quota than simple ones.
 Will this change affect my existing integrations? 
 Most apps already operate comfortably within the Global Pool.
 You may need to update error handling to respect the new rate-limit headers and retry behavior.
 REST vs GraphQL — Are there differences? 
 The model is the same for both:
 REST exposes usage via X-RateLimit-* headers
 GraphQL exposes usage via the extensions.cost block
 How do I know if my app is approaching or exceeding its limits? 
 REST: Monitor X-RateLimit-Remaining , X-RateLimit-NearLimit , and Retry-After .
 GraphQL: Monitor the extensions.cost block.
 When a limit is exceeded, you will receive HTTP 429 Too Many Requests with a Retry-After header indicating when to retry.
 How are object costs determined? 
 Each object type has a published point value (e.g., Issues = 1, Users = 2).
 Unlisted objects default to 1 point. The catalog will expand over time.
 What happens if I exceed my allocation? 
 You will receive a 429 Too Many Requests response with a Retry-After header.
 All requests are denied until the next hourly reset. There is no gradual throttling .
 What are the best practices for staying within limits? 
 Request only the fields you need
 Paginate large queries
 Prefer metadata over full-content responses
 Cache stable responses
 Use exponential backoff with jitter when retrying after 429 
 How do I know which tier is right for my app? 
 Global Pool: Default for most apps.
 Per-Tenant Pool: Only available after Atlassian review and meant for apps with sustained, high, or concentrated usage.
 Can limits be increased if needed? 
 No, not on demand.
 Quota increases require a review by Atlassian for Tier 2 Per-Tenant Pool eligibility.
 What is the scope of the rollout? 
 Jira and Confluence APIs.
 REST enforcement comes first, followed by GraphQL at a future date which will be announced.
 Who can I contact for support? 
 Use the Partner Portal for documentation and app quota increase requests, or please contact your Atlassian representative .
 Rate this page:
 Unusable 
 Poor 
 Okay 
 Good 
 Excellent 
 Changelog System status Privacy Notice at Collection Developer Terms Trademark Cookie preferences © 2026 Atlassian 
 