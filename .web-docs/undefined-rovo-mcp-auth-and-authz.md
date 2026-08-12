<!-- Source: https://support.atlassian.com/atlassian-rovo-mcp-server/docs/authentication-and-authorization/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Authentication and authorization

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/")

 

The Atlassian Rovo MCP Server uses **OAuth 2.1** as its primary
authentication mechanism, providing a secure and standardized way for
users to authorize access to resources via an interactive consent flow.

In addition, [if enabled by your organization
admin](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/"),
MCP supports **authentication via API token** for **machine‑to‑machine**
and other **non‑interactive** scenarios (for example, backend services,
CI/CD pipelines, bots, and automated agents). Authentication via API
token lets MCP clients authenticate without a browser‑based OAuth
consent screen, using:

- **Personal API tokens** (Basic auth)

- **Service account API keys** (Bearer tokens, where available)

OAuth 2.1 remains the recommended option for interactive, user‑driven
scenarios. We recommend using authentication via API token only for
non‑interactive or machine‑to‑machine use cases.

## Supported authentication methods

[TABLE]

## Choose the right authentication method

**Use OAuth 2.1 authentication when:**

- A user is present and can complete an interactive consent flow

- You want fine‑grained, user‑level consent and context

- You are building interactive apps or integrations

See [Configuring OAuth
2.1](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/")
for more details.

**Use authentication via API token when:**

- No user is present (for example, backend services, CI/CD, bots)

- You need non‑interactive, machine‑to‑machine authentication

- You can manage API tokens or service account keys securely (rotation,
  storage, audit)

- If your organization admin has disabled authentication via API token,
  MCP clients won’t be able to connect and will need to use OAuth 2.1
  instead.

See [Configuring authentication via API
token](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/")
for more details.

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

- Authentication and authorization

- [Configuring OAuth
  2.1](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/)

- [Configuring authentication via API
  token](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/)

- [Supported tools](/atlassian-rovo-mcp-server/docs/supported-tools/)

- Show
  more

On this page[Supported authentication
methods](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/#Supported-authentication-methods)[Choose
the right authentication
method](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/#Choose-the-right-authentication-method)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)


---

## Table pandoc dropped from the page body (extracted from raw HTML of the same page)

### Supported authentication methods

| Authentication method | Description | Auth headers |
|---|---|---|
| OAuth 2.1 | Full OAuth flow that's interactive with token validation and user context enrichment | `Authorization: Bearer <access_token>` |
| API token | Non-interactive; a personal API token created by a user (basic auth) or a service account API key (bearer). Only available if enabled by your organization admin. | `Authorization: Basic <base64(email:api_token)>` or `Authorization: Bearer <api_key>` |
