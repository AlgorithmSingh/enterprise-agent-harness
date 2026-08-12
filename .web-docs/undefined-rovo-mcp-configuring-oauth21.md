<!-- Source: https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Configuring OAuth 2.1

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/")

After **30th June 2026**, usage of `https://mcp.atlassian.com/v1/sse` as
a server endpoint will no longer be supported.

We recommend updating any configured custom clients to point to `/mcp`:
`https://mcp.atlassian.com/v1/mcp/authv2`

 

MCP uses **OAuth 2.1** as its primary authentication mechanism. This
section describes how to configure OAuth for interactive, user‑driven
scenarios. For non‑interactive or machine‑to‑machine scenarios, see
[Configuring authentication via API
token](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/").

------------------------------------------------------------------------

## How OAuth works with MCP

When you use OAuth authentication with MCP, the MCP client initiates an
OAuth 2.1 authorization flow. The user is redirected to Atlassian to
review and grant access on a consent screen. After providing consent,
the client receives an **access token**. The client sends this token to
MCP in the `Authorization` header:

`Authorization: Bearer <access_token>`

MCP validates the token, enriches it with user and product context, and
then forwards requests to the appropriate Atlassian products and tools.

------------------------------------------------------------------------

## Configure your MCP client

Configure your MCP client to call the MCP server with an OAuth 2.1
bearer token.

`{ `` "mcpServers": { `` "atlassian-rovo-mcp": { `` "url": "https://mcp.atlassian.com/v1/mcp", `` "headers": { `` "Authorization": "Bearer YOUR_OAUTH_ACCESS_TOKEN" `` } `` } `` } ``}`

Replace `YOUR_OAUTH_ACCESS_TOKEN` with a valid OAuth 2.1 access token
obtained from the OAuth flow. The exact way you obtain this token
depends on your app or integration, for example, using the OAuth 2.1
authorization code grant.

------------------------------------------------------------------------

## Atlassian apps and scopes

The OAuth consent screen determines:

- Which **Atlassian apps** the user has granted access to, for example,
  Jira, Confluence, and Jira Service Management.

- Which **scopes** are available to MCP when calling those products on
  behalf of the user.

MCP uses this information to:

- Load tools that are compatible with the granted products and scopes.

- Enforce access control based on the user’s permissions in each
  product.

- Ensure that requests are scoped to the correct Atlassian site
  (`cloudId`) where applicable.

If you change the scopes requested by your app, users may need to
re‑consent for MCP to access additional products or capabilities.

See [this
page](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/")
for more information on supported tools across Atlassian apps.

------------------------------------------------------------------------

## Cloud IDs and allowlists

With OAuth 2.1, access tokens are typically consented for a specific
**cloud ID** (site). MCP validates that requests are made against the
correct `cloudId` associated with the token. Domain and redirect
**allowlists** can be enforced as part of the OAuth redirect
configuration.

These checks help ensure that:

- Tokens are only used for the sites they were granted for.

- Redirects only occur to trusted domains configured in your OAuth app.

For scenarios where you cannot use an interactive OAuth flow (for
example, backend services or CI/CD pipelines), use [authentication via
API
token](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/")
instead.

------------------------------------------------------------------------

## Security best practices

- Tokens are never shared between users.

- Use official OAuth flows—avoid custom or hardcoded tokens.

- If permissions are updated, you may need to re-authorize the client.

------------------------------------------------------------------------

## Common authentication issues

|  |  |  |
|----|----|----|
| **Issue** | **Possible cause** | **Resolution** |
| **Flow doesn’t launch** | Pop-up blocker or CLI error | Re-run the command, disable pop-up blockers |
| **Redirect fails** | Blocked localhost or misconfigured redirect | Allowlist the callback URI or check your network settings |
| **Access denied** | Insufficient Jira/Confluence permissions | Verify product access with your site admin |
| **No data returned** | Token expired or improperly scoped | Re-authenticate or check granted scopes |

------------------------------------------------------------------------

Need help? [Contact Atlassian
Support](http://support.atlassian.com/ "http://support.atlassian.com/")
or visit the [getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/").

 

Was this helpful?

Yes

No

It wasn't accurateIt wasn't clearIt wasn't relevant

Provide feedback about this article

## Still need help?

The Atlassian Community is here for you.

[Ask the
Community](https://community.atlassian.com/t5/custom/page/page-id/create-post-step-1?add-tags=atlassian-rovo-mcp-server,Cloud)

- [Use Atlassian Rovo MCP
  Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

- [Getting started with the Atlassian Rovo MCP
  Server](/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/)

- [Authentication and
  authorization](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/)

- Configuring OAuth 2.1

- [Configuring authentication via API
  token](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/)

- [Supported tools](/atlassian-rovo-mcp-server/docs/supported-tools/)

- Show
  more

On this page[How OAuth works with
MCP](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/#How-OAuth-works-with-MCP)[Configure
your MCP
client](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/#Configure-your-MCP-client)[Atlassian
apps and
scopes](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/#Atlassian-apps-and-scopes)[Cloud
IDs and
allowlists](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/#Cloud-IDs-and-allowlists)[Security
best
practices](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/#Security-best-practices)[Common
authentication
issues](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/#Common-authentication-issues)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)
