<!-- Source: https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Configuring authentication via API token

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/")

After **30th June 2026**, usage of `https://mcp.atlassian.com/v1/sse` as
a server endpoint will no longer be supported.

We recommend updating any configured custom clients to point to `/mcp`:
`https://mcp.atlassian.com/v1/mcp/authv2`

 

[If enabled by your organization
admin](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/"),
authentication via API token lets MCP clients authenticate *without* an
interactive OAuth consent screen. Instead of redirecting a user to a
browser, the client sends credentials directly in the `Authorization`
header. For interactive, user‑driven scenarios, see [Configuring OAuth
2.1](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/").

Supported mechanisms:

- **Personal API tokens** using Basic auth:\
  `Authorization: Basic <base64(email:api_token)>`

- **Service account API keys** using Bearer tokens:\
  `Authorization: Bearer <api_key>`

See [this
page](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/")
for more information on supported tools across Atlassian apps.

------------------------------------------------------------------------

## Personal API token (Basic auth)

Use this option when you want to authenticate MCP using a **personal API
token** created by a user.

### Step 1. Create a personal API token

1.  Create a [personal API
    token](https://id.atlassian.com/manage-profile/security/api-tokens?autofillToken&expiryDays=max&appId=mcp&selectedScopes=all "https://id.atlassian.com/manage-profile/security/api-tokens?autofillToken&expiryDays=max&appId=mcp&selectedScopes=all")
    with the required scopes.

2.  If necessary, you can select the scopes you want to your API token
    to have by clicking the **Back** button and manually selecting the
    scopes.

3.  Note the email address of the user who owns the token.

### Step 2. Base64‑encode the credentials

Create a base64‑encoded string in the format `email:api_token`:

`# Format: email:api_token ``echo -n "your.email@example.com:YOUR_API_TOKEN_HERE" | base64`

This produces a base64‑encoded string representing `email:api_token`.

### Step 3. Configure your MCP client

Add the following configuration to your MCP client’s `mcp.json`:

`{ `` "mcpServers": { `` "atlassian-rovo-mcp": { `` "url": "https://mcp.atlassian.com/v1/mcp", `` "headers": { `` "Authorization": "Basic BASE64_ENCODED_EMAIL_AND_TOKEN" `` } `` } `` } ``}`

Replace `BASE64_ENCODED_EMAIL_AND_TOKEN` with the value from Step 2.

------------------------------------------------------------------------

## Service account API key (Bearer token)

Use this option when you want to authenticate MCP using a **service
account API key** managed by an admin.

### Step 1. Obtain a service account API key

1.  Ask your Atlassian admin to create a **service account** and
    generate an **API key** with the required scopes.

2.  Store the API key securely (for example, in your CI/CD secret store
    or secrets manager).

### Step 2. Configure your MCP client

Add the following configuration to your MCP client’s `mcp.json`:

`{ `` "mcpServers": { `` "atlassian-rovo-mcp": { `` "url": "https://mcp.atlassian.com/v1/mcp", `` "headers": { `` "Authorization": "Bearer YOUR_API_KEY_HERE" `` } `` } `` } ``}`

Replace `YOUR_API_KEY_HERE` with your service account API key.

------------------------------------------------------------------------

## Limitations

[TABLE]

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

- Show
  more

- [Authentication and
  authorization](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/)

- [Configuring OAuth
  2.1](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/)

- Configuring authentication via API token

- [Supported tools](/atlassian-rovo-mcp-server/docs/supported-tools/)

- [Setting up
  clients](/atlassian-rovo-mcp-server/docs/setting-up-clients/)

- Show
  more

On this page[Personal API token (Basic
auth)](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Personal-API-token--Basic-auth-)[Step 1.
Create a personal API
token](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Step-1.-Create-a-personal-API-token)[Step
2. Base64‑encode the
credentials](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Step-2.-Base64‑encode-the-credentials)[Step
3. Configure your MCP
client](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Step-3.-Configure-your-MCP-client)[Service
account API key (Bearer
token)](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Service-account-API-key--Bearer-token-)[Step 1.
Obtain a service account API
key](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Step-1.-Obtain-a-service-account-API-key)[Step
2. Configure your MCP
client](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Step-2.-Configure-your-MCP-client)[Limitations](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/#Limitations)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)


---

## Limitations table pandoc dropped from the page body (extracted from raw HTML of the same page)

| Limitation | Detail |
|---|---|
| Limited tool availability | Some MCP tools may not be available with API token auth. Certain tools (for example, some Compass tools) are disabled because the required product scopes are not currently available when creating personal API tokens or API keys. Tool set may be smaller than with OAuth. JSM supported; tool availability depends on granted scopes. |
| No bounded cloud ID | OAuth tokens are typically consented for a specific cloudId. API tokens are NOT bound to a specific cloudId; clients and tools must explicitly pass the cloudId where needed. Enables cross-site workflows but you must ensure the correct cloudId per request. |
| No domain allowlist validation | API token auth does not use an OAuth redirect URI, so redirect-based domain allowlist checks cannot be performed; governed only by IP allowlist configuration. |
