1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Configuring authentication via API token

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/")

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTMuNDg5NyA0LjM0NTkyTDIxLjg1NjEgMTguODYxMUMyMS45NTI1IDE5LjAyODggMjIuMDAyMSAxOS4yMTgxIDIxLjk5OTkgMTkuNDEwMUMyMS45OTc3IDE5LjYwMjEgMjEuOTQzOCAxOS43OTAzIDIxLjg0MzUgMTkuOTU1OUMyMS43NDMyIDIwLjEyMTUgMjEuNjAwMSAyMC4yNTg4IDIxLjQyODIgMjAuMzU0MkMyMS4yNTYzIDIwLjQ0OTcgMjEuMDYxNiAyMC40OTk5IDIwLjg2MzYgMjAuNUgzLjEzNzA3QzIuOTM4ODIgMjAuNSAyLjc0NDAxIDIwLjQ0OTggMi41NzE5NiAyMC4zNTQzQzIuMzk5OTIgMjAuMjU4OCAyLjI1NjYzIDIwLjEyMTMgMi4xNTYzMSAxOS45NTU2QzIuMDU1OTggMTkuNzg5OCAyLjAwMjEyIDE5LjYwMTUgMi4wMDAwNiAxOS40MDkzQzEuOTk4IDE5LjIxNzEgMi4wNDc4MiAxOS4wMjc4IDIuMTQ0NTYgMTguODZMMTAuNTEyMSA0LjM0NTkyQzEwLjY2MDIgNC4wODkzOSAxMC44NzYyIDMuODc1NzcgMTEuMTM3NyAzLjcyNzA4QzExLjM5OTMgMy41NzgzOCAxMS42OTcxIDMuNSAxMi4wMDAzIDMuNUMxMi4zMDM2IDMuNSAxMi42MDEzIDMuNTc4MzggMTIuODYyOSAzLjcyNzA4QzEzLjEyNDUgMy44NzU3NyAxMy4zNDA0IDQuMDg5MzkgMTMuNDg4NSA0LjM0NTkySDEzLjQ4OTdaTTEyLjAwMDMgNy44MjUzOEMxMS44MjMyIDcuODI1MzcgMTEuNjQ4MiA3Ljg2MjEyIDExLjQ4NjkgNy45MzMxN0MxMS4zMjU3IDguMDA0MjMgMTEuMTgyIDguMTA3OTMgMTEuMDY1NiA4LjIzNzNDMTAuOTQ5MiA4LjM2NjY4IDEwLjg2MjcgOC41MTg3MiAxMC44MTE5IDguNjgzMjFDMTAuNzYxMSA4Ljg0NzcgMTAuNzQ3MyA5LjAyMDgzIDEwLjc3MTMgOS4xOTA5M0wxMS4zNTQ2IDEzLjM0MTZDMTEuMzc1NCAxMy40OTMzIDExLjQ1MjMgMTMuNjMyNiAxMS41NzExIDEzLjczMzRDMTEuNjg5OSAxMy44MzQzIDExLjg0MjQgMTMuODg5OSAxMi4wMDAzIDEzLjg4OTlDMTIuMTU4MiAxMy44ODk5IDEyLjMxMDcgMTMuODM0MyAxMi40Mjk1IDEzLjczMzRDMTIuNTQ4MyAxMy42MzI2IDEyLjYyNTMgMTMuNDkzMyAxMi42NDYxIDEzLjM0MTZMMTMuMjI5MyA5LjE5MDkzQzEzLjI1MzMgOS4wMjA4MyAxMy4yMzk1IDguODQ3NyAxMy4xODg3IDguNjgzMjFDMTMuMTM4IDguNTE4NzIgMTMuMDUxNSA4LjM2NjY4IDEyLjkzNSA4LjIzNzNDMTIuODE4NiA4LjEwNzkzIDEyLjY3NDkgOC4wMDQyMyAxMi41MTM3IDcuOTMzMTdDMTIuMzUyNSA3Ljg2MjEyIDEyLjE3NzQgNy44MjUzNyAxMi4wMDAzIDcuODI1MzhWNy44MjUzOFpNMTIuMDAwMyAxNy4zMzY5QzEyLjMzOTUgMTcuMzM2OSAxMi42NjQ5IDE3LjIwNjIgMTIuOTA0NyAxNi45NzM3QzEzLjE0NDYgMTYuNzQxMiAxMy4yNzkzIDE2LjQyNTggMTMuMjc5MyAxNi4wOTY5QzEzLjI3OTMgMTUuNzY4MSAxMy4xNDQ2IDE1LjQ1MjcgMTIuOTA0NyAxNS4yMjAyQzEyLjY2NDkgMTQuOTg3NyAxMi4zMzk1IDE0Ljg1NyAxMi4wMDAzIDE0Ljg1N0MxMS42NjExIDE0Ljg1NyAxMS4zMzU4IDE0Ljk4NzcgMTEuMDk1OSAxNS4yMjAyQzEwLjg1NjEgMTUuNDUyNyAxMC43MjEzIDE1Ljc2ODEgMTAuNzIxMyAxNi4wOTY5QzEwLjcyMTMgMTYuNDI1OCAxMC44NTYxIDE2Ljc0MTIgMTEuMDk1OSAxNi45NzM3QzExLjMzNTggMTcuMjA2MiAxMS42NjExIDE3LjMzNjkgMTIuMDAwMyAxNy4zMzY5VjE3LjMzNjlaIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+PC9zdmc+)

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
  more![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgcm9sZT0icHJlc2VudGF0aW9uIj48cGF0aCBmaWxsPSJjdXJyZW50Y29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjkyIDEwLjI5M2ExLjAxIDEuMDEgMCAwIDAgMCAxLjQxOWwyLjkzOSAyLjk2NWMuMjE4LjIxNS41LjMyMi43NzkuMzIycy41NTYtLjEwNy43NjktLjMyMmwyLjkzLTIuOTU1YTEuMDEgMS4wMSAwIDAgMCAwLTEuNDE5Ljk4Ny45ODcgMCAwIDAtMS40MDYgMGwtMi4yOTggMi4zMTctMi4zMDctMi4zMjdhLjk5Ljk5IDAgMCAwLTEuNDA2IDAiIC8+PC9zdmc+)

- [Authentication and
  authorization](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/)

- [Configuring OAuth
  2.1](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/)

- Configuring authentication via API token

- [Supported tools](/atlassian-rovo-mcp-server/docs/supported-tools/)

- [Setting up
  clients](/atlassian-rovo-mcp-server/docs/setting-up-clients/)

- Show
  more![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgcm9sZT0icHJlc2VudGF0aW9uIj48cGF0aCBmaWxsPSJjdXJyZW50Y29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjkyIDEwLjI5M2ExLjAxIDEuMDEgMCAwIDAgMCAxLjQxOWwyLjkzOSAyLjk2NWMuMjE4LjIxNS41LjMyMi43NzkuMzIycy41NTYtLjEwNy43NjktLjMyMmwyLjkzLTIuOTU1YTEuMDEgMS4wMSAwIDAgMCAwLTEuNDE5Ljk4Ny45ODcgMCAwIDAtMS40MDYgMGwtMi4yOTggMi4zMTctMi4zMDctMi4zMjdhLjk5Ljk5IDAgMCAwLTEuNDA2IDAiIC8+PC9zdmc+)

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
