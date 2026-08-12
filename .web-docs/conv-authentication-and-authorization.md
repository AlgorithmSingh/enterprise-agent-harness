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

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTIgMjJDOS4zNDc4NCAyMiA2LjgwNDMgMjAuOTQ2NCA0LjkyODkzIDE5LjA3MTFDMy4wNTM1NyAxNy4xOTU3IDIgMTQuNjUyMiAyIDEyQzIgOS4zNDc4NCAzLjA1MzU3IDYuODA0MyA0LjkyODkzIDQuOTI4OTNDNi44MDQzIDMuMDUzNTcgOS4zNDc4NCAyIDEyIDJDMTQuNjUyMiAyIDE3LjE5NTcgMy4wNTM1NyAxOS4wNzExIDQuOTI4OTNDMjAuOTQ2NCA2LjgwNDMgMjIgOS4zNDc4NCAyMiAxMkMyMiAxNC42NTIyIDIwLjk0NjQgMTcuMTk1NyAxOS4wNzExIDE5LjA3MTFDMTcuMTk1NyAyMC45NDY0IDE0LjY1MjIgMjIgMTIgMjJWMjJaTTEyIDExLjM3NUMxMS42Njg1IDExLjM3NSAxMS4zNTA1IDExLjUwNjcgMTEuMTE2MSAxMS43NDExQzEwLjg4MTcgMTEuOTc1NSAxMC43NSAxMi4yOTM1IDEwLjc1IDEyLjYyNVYxNS43NUMxMC43NSAxNi4wODE1IDEwLjg4MTcgMTYuMzk5NSAxMS4xMTYxIDE2LjYzMzlDMTEuMzUwNSAxNi44NjgzIDExLjY2ODUgMTcgMTIgMTdDMTIuMzMxNSAxNyAxMi42NDk1IDE2Ljg2ODMgMTIuODgzOSAxNi42MzM5QzEzLjExODMgMTYuMzk5NSAxMy4yNSAxNi4wODE1IDEzLjI1IDE1Ljc1VjEyLjYyNUMxMy4yNSAxMi4yOTM1IDEzLjExODMgMTEuOTc1NSAxMi44ODM5IDExLjc0MTFDMTIuNjQ5NSAxMS41MDY3IDEyLjMzMTUgMTEuMzc1IDEyIDExLjM3NVpNMTIgOS45Njg3NUMxMi40NTU4IDkuOTY4NzUgMTIuODkzIDkuNzg3NjcgMTMuMjE1MyA5LjQ2NTM0QzEzLjUzNzcgOS4xNDMwMSAxMy43MTg4IDguNzA1ODQgMTMuNzE4OCA4LjI1QzEzLjcxODggNy43OTQxNiAxMy41Mzc3IDcuMzU2OTkgMTMuMjE1MyA3LjAzNDY2QzEyLjg5MyA2LjcxMjMzIDEyLjQ1NTggNi41MzEyNSAxMiA2LjUzMTI1QzExLjU0NDIgNi41MzEyNSAxMS4xMDcgNi43MTIzMyAxMC43ODQ3IDcuMDM0NjZDMTAuNDYyMyA3LjM1Njk5IDEwLjI4MTIgNy43OTQxNiAxMC4yODEyIDguMjVDMTAuMjgxMiA4LjcwNTg0IDEwLjQ2MjMgOS4xNDMwMSAxMC43ODQ3IDkuNDY1MzRDMTEuMTA3IDkuNzg3NjcgMTEuNTQ0MiA5Ljk2ODc1IDEyIDkuOTY4NzVaIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+PC9zdmc+)

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
  more![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgcm9sZT0icHJlc2VudGF0aW9uIj48cGF0aCBmaWxsPSJjdXJyZW50Y29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjkyIDEwLjI5M2ExLjAxIDEuMDEgMCAwIDAgMCAxLjQxOWwyLjkzOSAyLjk2NWMuMjE4LjIxNS41LjMyMi43NzkuMzIycy41NTYtLjEwNy43NjktLjMyMmwyLjkzLTIuOTU1YTEuMDEgMS4wMSAwIDAgMCAwLTEuNDE5Ljk4Ny45ODcgMCAwIDAtMS40MDYgMGwtMi4yOTggMi4zMTctMi4zMDctMi4zMjdhLjk5Ljk5IDAgMCAwLTEuNDA2IDAiIC8+PC9zdmc+)

On this page[Supported authentication
methods](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/#Supported-authentication-methods)[Choose
the right authentication
method](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/#Choose-the-right-authentication-method)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)
