Source: https://developer.atlassian.com/cloud/confluence/rate-limiting/
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
 Confluence Cloud
 Guides 
 Reference 
 REST API CQL App properties API Entity properties Connect GraphQL API 
 Resources 
 Changelog 
 Confluence Cloud
 Guides 
 Reference 
 Resources 
 Changelog 
 About Confluence Cloud 
 Introduction and basics
 Overview of capabilities 
 Getting started with Forge 
 Forge concepts 
 Collaborative editing 
 Rate limiting 
 Storing data with entity properties 
 Security
 Security overview 
 Security for Forge apps 
 Scopes for OAuth 2.0 (3LO) and Forge apps 
 OAuth 2.0 (3LO) apps 
 Basic auth for REST APIs 
 Data security policy developer guide 
 Privacy guidelines
 User privacy guide for app developers 
 Profile visibility 
 Other considerations
 Atlassian Design Guidelines 
 Atlaskit 
 Developer canary program 
 Developing for Marketplace 
 Public licensing 
 Last updated Aug 12, 2026 
 Enforcement of the new points-based API rate limits and tiered quota rate limits for Jira and Confluence Cloud apps will begin on March 2, 2026
 This change is designed to ensure consistent performance and fair usage. The new rate limits will apply to all Forge, Connect, and OAuth 2.0 (3LO) apps. If your app integrates with Jira or Confluence Cloud, we recommend reviewing the updated documentation on rate limits and best practices for optimizing API usage. API token-based traffic is not affected by this change, and will continue to be governed by existing burst rate limits.
 See the Confluence Cloud changelog for more details.
 Rate limiting 
 Rate limiting controls how many API requests your app can make to Confluence Cloud within a given time period. This ensures platform stability, fair resource allocation, and a reliable experience for all users.
 Why rate limiting matters 
 Without rate limits, a single app could consume excessive resources, slowing down the platform for everyone. Rate limiting protects against:
 Service degradation: Prevents one app from overwhelming shared infrastructure.
 Resource fairness: Ensures all apps get equitable access to API capacity.
 System stability: Guards against accidental or malicious traffic spikes.
 If your app exceeds its rate limit, Confluence returns an HTTP 429 Too Many Requests response. Your app should handle this gracefully by pausing requests and retrying after the specified delay.
 Points-based rate limiting 
 Confluence Cloud uses a points-based model to measure API usage. Instead of simply counting requests, each API call consumes points based on the work it performs—such as the amount of data returned or the complexity of the operation.
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
 Core domain objects ( GET , GraphQL query ) 1 point Standard read operations on primary content Pages, Spaces, Attachments 
 Identity & access ( GET , GraphQL query ) 2 points Reads involving authentication or permissions Users, Groups, Permissions 
 Write / modify / delete ( POST , PUT , PATCH , DELETE , GraphQL mutation ) 1 point Operations that create, update, or remove data Create or edit pages 
 Others 1 point Read operations on uncategorized objects Endpoints or fields not listed above (default cost applies) 
 Note: We plan to expand our catalog in the future to provide more detail on object costs. Most requests are dominated by object costs.
 Rate limit quotas by tiers 
 All quotas are measured in points per hour and reset at the top of each UTC hour.
 Understanding the tier system 
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
 The following examples show how points are calculated for common Confluence REST API operations.
 Read operations 
 Simple page fetch 
 Sarah is building a documentation sync tool. She fetches a single Confluence page:
 1
2
 GET /wiki/rest/api/content/123456
 Cost calculation: 
 1
2
 1 (base) + 1 (Page object) = 2 points
 Space details 
 Sarah retrieves details about a specific space:
 1
2
 GET /wiki/rest/api/space/DOCS
 Cost calculation: 
 1
2
 1 (base) + 1 (Space object) = 2 points
 User lookup 
 Marcus is building a permissions audit tool and fetches user information:
 1
2
 GET /wiki/rest/api/user?accountId=557058:12345678-abcd-1234
 Cost calculation: 
 1
2
 1 (base) + 2 (User object) = 3 points
 Write operations 
 Creating a new page 
 Alex is automating page creation for a knowledge base workflow:
 1
2
 POST /wiki/rest/api/content
{
 "type": "page",
 "title": "Q4 Planning",
 "space": {"key": "TEAM"},
 "body": {
 "storage": {
 "value": "<p>Content here</p>"
 }
 }
}
 Cost calculation: 
 1
2
 1 point
 Updating an existing page 
 Alex updates the page with new content:
 1
2
 PUT /wiki/rest/api/content/123456
{
 "version": {"number": 2},
 "title": "Q4 Planning - Updated",
 "body": {
 "storage": {
 "value": "<p>New content</p>"
 }
 }
}
 Cost calculation: 
 1
2
 1 point
 Burst rate limits 
 Quota and burst rate limits are enforced independently. Burst limits are evaluated over short time windows (typically seconds) to prevent traffic spikes, while quota limits are evaluated hourly. Even if you remain within your hourly quota, a rapid surge of requests can trigger burst limiting. Burst limits reset quickly, allowing normal operations to resume within seconds. Certain high-impact endpoints (Permissions, Search, Admin operations) enforce additional burst protections for system stability.
 Rate-limiting enforcement, responses, and best practices 
 Atlassian enforces API rate limits by tracking your usage in hourly intervals, measured in points. Each app or token has a set quota of points per hour, which resets at the top of each hour (UTC). If your usage exceeds the quota, further requests are denied with an HTTP 429 response until the next window begins. There is no partial throttling once the quota is reached, all requests are blocked until reset.
 Key points: 
 Quotas are measured in points per hour and reset at the start of each UTC hour.
 There is no carry-over between hours; unused quota does not accumulate.
 When the quota is reached, all further requests are denied until the next reset.
 This model provides predictable enforcement and makes it easy for developers to monitor usage and reset times.
 Apps can detect rate limits by checking for HTTP 429 responses. Any REST API can return a rate limit response.
 Rate limit responses 
 Rate limit detection 
 Apps can detect rate limits by checking if the HTTP response status code is 429 . Any REST API can return a rate limit response.
 Rate limit related headers 
 Header Description 
 X-RateLimit-Limit The maximum request rate enforced for the current rate-limit scope. For burst rate limits, this reflects the allowed requests per second. 
 X-RateLimit-Remaining The remaining request capacity within the current rate-limit window. For burst rate limits, this represents remaining requests in the current second. 
 X-RateLimit-Reset ISO 8601 timestamp when the current window resets 
 X-RateLimit-NearLimit Returns true when less than 20% of the quota remains 
 RateLimit-Reason The reason for throttling: 
• confluence-quota-global-based – Global Pool limits breached
• confluence-quota-tenant-based – Per-Tenant Pool limits breached 
 Retry-After Only returned with 429 responses. Indicates how many seconds to wait before retrying 
 Responses will get beta- prefixed headers if they would have breached the upcoming quota and burst rate limits:
 Beta-Retry-After 
 X-Beta-RateLimit-Limit 
 X-Beta-RateLimit-Remaining 
 X-Beta-RateLimit-NearLimit 
 X-Beta-RateLimit-Reason 
 X-Beta-RateLimit-Reset 
 New beta headers (used for points-based quota signaling):
 Beta-RateLimit-Policy 
 Beta-RateLimit 
 At enforcement time, the beta headers will drop the Beta- prefix and become RateLimit-Policy and RateLimit. The legacy X-Beta-RateLimit-* headers will not be used for points‑based quota.
 However, if you receive headers without the Beta- prefix, you are hitting actual rate limits. Some transient 5xx responses (such as 503) may also include a Retry-After header. While these are not rate limit responses, you can handle them with similar retry logic.
 Points-based quota rate-limit headers (Beta) 
 Beta-RateLimit-Policy and Beta-RateLimit are unified structured response headers that report points-based quota usage. They follow a format aligned with standards on rate-limiting headers. These headers are currently informational only and do not trigger enforcement or throttling. At enforcement, the Beta- prefix will be dropped and these headers will become RateLimit-Policy and RateLimit .
 For points-based quota enforcement, only RateLimit and RateLimit-Policy will be used — the existing X-Beta-RateLimit-* and X-RateLimit-* headers will not be used for quota enforcement. Standard HTTP headers such as Retry-After continue to apply where relevant.
 These headers are additive, existing X-RateLimit-* headers continue to be returned unchanged. Support for additional limit types may be added in the future and will be announced separately.
 Header format 
 A response header may contain one or more policy entries. Each policy entry consists of a
 A policy name (quoted string)
 One or more attributes expressed as key=value pairs
 Attributes are separated by  ; 
 Multiple policy entries are separated by  , 
 1
2
 Beta-RateLimit: "<policy-name>";<attribute>=<value>[;<attribute>=<value>], ...
 Clients should parse these as comma-separated entries and must not assume a fixed number or ordering.Support for additional services and limit types may be added in the future and will be announced separately.
 Header parameters 
 Header Parameter Description 
 Beta-RateLimit-Policy q Total quota 
 Beta-RateLimit-Policy w Time window in seconds 
 Beta-RateLimit r Remaining quota. Conditionally included, present only when usage exceeds ~80% of the quota. If absent, your app is well within its limits. Treat as optional in your parsing logic. 
 Beta-RateLimit t Seconds until reset 
 Both Beta-RateLimit and Beta-RateLimit-Policy headers include a policy name indicating the applied quota:
 Policy name Description 
 global-app-quota A quota applied to your app globally across all tenants (Tier 1) 
 tenant-app-quota A quota applied per tenant, per app (Tier 2) 
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
 Retrying and backoff strategies 
 Retry only when appropriate: 
Only retry if the API is idempotent and the response includes a Retry-After header
 Exponential backoff with jitter: 
Use exponential backoff and add random jitter to delays to avoid the thundering herd problem .
 Double the delay after each 429: 
Increase the delay after each successive 429, up to a maximum.
 Monitor and tune: 
Adjust retry thresholds, delays, and maximum retries based on your app’s needs and observed behavior.
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
X-RateLimit-Limit: 40000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-10-08T15:00:00Z
RateLimit-Reason: confluence-quota-global-based
 App request scheduling 
 Efficiently scheduling your app’s API requests is essential for staying within your hourly points quota and ensuring reliable performance for your users. Whether you’re running batch jobs, automations, or large data migrations, thoughtful scheduling helps you avoid rate limit errors and make the most of your available quota.
 Best practices for scheduling API requests: 
 Distribute requests over time: Spread your requests evenly throughout the hour, rather than sending large bursts at predictable intervals.
 Apply random jitter: Add a random delay ("jitter") to scheduled jobs to avoid many apps hitting the API at the same time.
 Coordinate across threads and nodes: Share rate limit status between threads or servers to prevent accidental quota exhaustion.
 Avoid using concurrency to bypass limits: Excessive parallelism can lead to more frequent 429 responses and degraded performance.
 Schedule heavy jobs during off-peak hours: For large, ad-hoc operations, consider running them during periods of lower user activity.
 Example: Instead of scheduling all batch jobs to run at 00:00 UTC , stagger them with random delays or intervals (e.g., every 5–10 minutes) to smooth out traffic and reduce the risk of hitting your hourly quota early in the window.
 Optimizing for efficiency and quota usage 
 Request only the data you need: Limit fields, use pagination, and avoid fetching unnecessary objects.
 Cache stable responses: Use ETags and conditional headers to avoid re-fetching unchanged data.
 Use bulk operations thoughtfully: Bulk operations may consume more points per request, but can reduce the number of HTTP calls and improve efficiency. Always check the point cost and consider whether batching is optimal for your use case.
 Leverage webhooks and context parameters: Use webhooks for updates and context parameters to minimize the number of API requests.
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
 REST enforcement comes first, followed by GraphQL at a future date which will be announced..
 Who can I contact for support? 
 Use the Partner Portal for documentation and app quota increase requests, or please contact your Atlassian representative .
 Rate this page:
 Unusable 
 Poor 
 Okay 
 Good 
 Excellent 
 Changelog System status Privacy Notice at Collection Developer Terms Trademark Cookie preferences © 2026 Atlassian 
 