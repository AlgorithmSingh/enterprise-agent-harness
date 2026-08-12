1.  [Atlassian Support](/)
2.  [Security and access policies
    Resources](/security-and-access-policies/resources/)
3.  [Maintain secure access to
    apps](/security-and-access-policies/docs/maintain-secure-access-to-products/)
4.  [Manage Atlassian Rovo MCP
    server](/security-and-access-policies/docs/manage-atlassian-rovo-mcp-server/)

# Control Atlassian Rovo MCP server settings

The Atlassian Rovo MCP server enables AI tools, like Claude.ai or
ChatGPT, and other MCP‑compatible tools to securely connect to Jira,
Confluence, and Compass. As an admin, you can control:

- **Which tools and domains** are allowed to connect using OAuth 2.1

- **How tools authenticate**, including OAuth 2.1 (default, recommended)
  and using API tokens (advanced)

- How these settings work with your existing security controls, such as
  IP allowlisting and app management policies

To see which domains are available and how to add your own, see
[Available Atlassian Rovo MCP server
domains](https://support.atlassian.com/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/ "https://support.atlassian.com/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/").

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTIgMjJDOS4zNDc4NCAyMiA2LjgwNDMgMjAuOTQ2NCA0LjkyODkzIDE5LjA3MTFDMy4wNTM1NyAxNy4xOTU3IDIgMTQuNjUyMiAyIDEyQzIgOS4zNDc4NCAzLjA1MzU3IDYuODA0MyA0LjkyODkzIDQuOTI4OTNDNi44MDQzIDMuMDUzNTcgOS4zNDc4NCAyIDEyIDJDMTQuNjUyMiAyIDE3LjE5NTcgMy4wNTM1NyAxOS4wNzExIDQuOTI4OTNDMjAuOTQ2NCA2LjgwNDMgMjIgOS4zNDc4NCAyMiAxMkMyMiAxNC42NTIyIDIwLjk0NjQgMTcuMTk1NyAxOS4wNzExIDE5LjA3MTFDMTcuMTk1NyAyMC45NDY0IDE0LjY1MjIgMjIgMTIgMjJWMjJaTTEyIDExLjM3NUMxMS42Njg1IDExLjM3NSAxMS4zNTA1IDExLjUwNjcgMTEuMTE2MSAxMS43NDExQzEwLjg4MTcgMTEuOTc1NSAxMC43NSAxMi4yOTM1IDEwLjc1IDEyLjYyNVYxNS43NUMxMC43NSAxNi4wODE1IDEwLjg4MTcgMTYuMzk5NSAxMS4xMTYxIDE2LjYzMzlDMTEuMzUwNSAxNi44NjgzIDExLjY2ODUgMTcgMTIgMTdDMTIuMzMxNSAxNyAxMi42NDk1IDE2Ljg2ODMgMTIuODgzOSAxNi42MzM5QzEzLjExODMgMTYuMzk5NSAxMy4yNSAxNi4wODE1IDEzLjI1IDE1Ljc1VjEyLjYyNUMxMy4yNSAxMi4yOTM1IDEzLjExODMgMTEuOTc1NSAxMi44ODM5IDExLjc0MTFDMTIuNjQ5NSAxMS41MDY3IDEyLjMzMTUgMTEuMzc1IDEyIDExLjM3NVpNMTIgOS45Njg3NUMxMi40NTU4IDkuOTY4NzUgMTIuODkzIDkuNzg3NjcgMTMuMjE1MyA5LjQ2NTM0QzEzLjUzNzcgOS4xNDMwMSAxMy43MTg4IDguNzA1ODQgMTMuNzE4OCA4LjI1QzEzLjcxODggNy43OTQxNiAxMy41Mzc3IDcuMzU2OTkgMTMuMjE1MyA3LjAzNDY2QzEyLjg5MyA2LjcxMjMzIDEyLjQ1NTggNi41MzEyNSAxMiA2LjUzMTI1QzExLjU0NDIgNi41MzEyNSAxMS4xMDcgNi43MTIzMyAxMC43ODQ3IDcuMDM0NjZDMTAuNDYyMyA3LjM1Njk5IDEwLjI4MTIgNy43OTQxNiAxMC4yODEyIDguMjVDMTAuMjgxMiA4LjcwNTg0IDEwLjQ2MjMgOS4xNDMwMSAxMC43ODQ3IDkuNDY1MzRDMTEuMTA3IDkuNzg3NjcgMTEuNTQ0MiA5Ljk2ODc1IDEyIDkuOTY4NzVaIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+PC9zdmc+)

You can only block domains for AI tools that use OAuth 2.1, but not when
they use API tokens to access your organization.

## Block Atlassian-supported domains

To block Atlassian-supported domains:

1.  Go to [Atlassian
    Administration](https://support.atlassian.com/organization-administration/docs/explore-an-atlassian-organization/ "https://support.atlassian.com/organization-administration/docs/explore-an-atlassian-organization/").
    Select your organization if you have more than one.

2.  Select **Rovo**, then **Rovo MCP server**.

3.  Deselect **Allow Atlassian supported domains**.

[What are Atlassian-supported
domains?](https://support.atlassian.com/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#What-are-Atlassian-supported-domains "https://support.atlassian.com/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#What-are-Atlassian-supported-domains")

## Add domains

You can add domains you trust to enable integrations with specific AI
tools.

To add a domain:

1.  Go to [Atlassian
    Administration](https://support.atlassian.com/organization-administration/docs/explore-an-atlassian-organization/ "https://support.atlassian.com/organization-administration/docs/explore-an-atlassian-organization/").
    Select your organization if you have more than one.

2.  Select **Rovo**, then **Rovo MCP server**.

3.  Select **Add domain**.

[How to format domain
URLs](https://support.atlassian.com/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/#Patterns-for-domains-you-want-to-add "https://support.atlassian.com/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/#Patterns-for-domains-you-want-to-add")

## Delete domains

You can remove domains from your organization to prevent AI tools from
accessing your apps.

To delete a domain:

1.  Go to [Atlassian
    Administration](https://support.atlassian.com/organization-administration/docs/explore-an-atlassian-organization/ "https://support.atlassian.com/organization-administration/docs/explore-an-atlassian-organization/").
    Select your organization if you have more than one.

2.  Select **Rovo**, then **Rovo MCP server**.

3.  From the domain, select **Delete**.

## Configure authentication

By default, users connect AI tools to Atlassian Rovo MCP server using
**OAuth 2.1**.

Additionally, you can also allow tools to connect using an API token,
which is useful for:

- Service‑style or non‑interactive tools that need consistent access
  without user prompts

- Backend systems or automations that call Atlassian Rovo MCP server on
  behalf of a shared account

Authentication controls how tools authenticate, and works together with
your existing controls:

- **Domains** – The Atlassian Rovo MCP Server settings control **which
  AI tools and domains** are allowed to connect when tools use OAuth
  2.1. Tools that authenticate via API token do not use domain
  allowlists and are instead governed by your IP allowlist configuration
  and the scopes granted to their tokens or API keys.

- **IP allowlists** – Your organization’s IP allowlists still control
  where users and tools can connect from. Requests made through
  Atlassian Rovo MCP server must originate from an IP address that is
  allowed by your organization’s IP allowlist for the relevant Atlassian
  app, regardless of whether the tool uses OAuth 2.1 or an API token.

Disabling authentication via API token does not change allowed domains
or IP allowlists. It only prevents tools from using **API tokens** to
authenticate with the Atlassian Rovo MCP server. If disabled, users will
be advised to contact their admin for access. See [Authentication and
authorization](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/authentication-and-authorization/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/authentication-and-authorization/").

**To control whether tools can authenticate via API token:**

1.  Go to **Atlassian Administration**. Select your organization if you
    have more than one.

2.  Select **Rovo**, then **Rovo MCP server**.

3.  In the **Authentication** section, turn **API token** on or off.

## How IP allowlisting works with Atlassian Rovo MCP server

IP allowlisting is an Atlassian Cloud security control that restricts
access to your products based on trusted source IP addresses or ranges.
If your organization uses IP allowlisting, those policies also apply
when users access Jira, Confluence, Compass, or Rovo through the
Atlassian Rovo MCP Server.

### Where you manage IP allowlists

You manage IP allowlists in **Atlassian Administration**, not in the
Atlassian Rovo MCP Server settings.

For details on how to configure IP ranges and which Atlassian apps are
supported, see [*Specify IP addresses for app
access*](https://support.atlassian.com/security-and-access-policies/docs/specify-ip-addresses-for-product-access/ "https://support.atlassian.com/security-and-access-policies/docs/specify-ip-addresses-for-product-access/").

### How IP allowlists affect MCP server usage

When a user runs tools through the Atlassian Rovo MCP server, the
request is evaluated against your organization’s IP allowlist for the
relevant Atlassian app (for example, Jira, Confluence, Compass, or
Rovo).

- If the user’s IP address is **allowed**, the tool call proceeds,
  subject to their normal Atlassian app permissions.

- If the user’s IP address is **not allowed**, the tool call is blocked
  and the user sees an error similar to:
  `You don't have permission to connect from this IP address. Please ask your admin for access.`

The OAuth 2.1 consent screen may still appear for users connecting from
blocked IPs, but tool calls will fail until their network is included in
the organization’s IP allowlist.

### How IP allowlists relate to domain settings

The Atlassian Rovo MCP server exposes two complementary controls:

- **Domain settings** (on this feature): control **which AI tools and
  domains** are allowed to connect to your organization.

- **IP allowlists** (organization-level): control **where users can
  connect from**, regardless of which AI tool they use.

For a tool call to succeed, it must:

1.  Come from a domain that you allow in the Atlassian Rovo MCP server
    settings, and

2.  Originate from an IP address that is allowed by your organization’s
    IP allowlists (if configured).

3.  **Be able to reach** `*.atlassian.net` from the user's network to
    render interactive widgets.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTIgMjJDOS4zNDc4NCAyMiA2LjgwNDMgMjAuOTQ2NCA0LjkyODkzIDE5LjA3MTFDMy4wNTM1NyAxNy4xOTU3IDIgMTQuNjUyMiAyIDEyQzIgOS4zNDc4NCAzLjA1MzU3IDYuODA0MyA0LjkyODkzIDQuOTI4OTNDNi44MDQzIDMuMDUzNTcgOS4zNDc4NCAyIDEyIDJDMTQuNjUyMiAyIDE3LjE5NTcgMy4wNTM1NyAxOS4wNzExIDQuOTI4OTNDMjAuOTQ2NCA2LjgwNDMgMjIgOS4zNDc4NCAyMiAxMkMyMiAxNC42NTIyIDIwLjk0NjQgMTcuMTk1NyAxOS4wNzExIDE5LjA3MTFDMTcuMTk1NyAyMC45NDY0IDE0LjY1MjIgMjIgMTIgMjJWMjJaTTEyIDExLjM3NUMxMS42Njg1IDExLjM3NSAxMS4zNTA1IDExLjUwNjcgMTEuMTE2MSAxMS43NDExQzEwLjg4MTcgMTEuOTc1NSAxMC43NSAxMi4yOTM1IDEwLjc1IDEyLjYyNVYxNS43NUMxMC43NSAxNi4wODE1IDEwLjg4MTcgMTYuMzk5NSAxMS4xMTYxIDE2LjYzMzlDMTEuMzUwNSAxNi44NjgzIDExLjY2ODUgMTcgMTIgMTdDMTIuMzMxNSAxNyAxMi42NDk1IDE2Ljg2ODMgMTIuODgzOSAxNi42MzM5QzEzLjExODMgMTYuMzk5NSAxMy4yNSAxNi4wODE1IDEzLjI1IDE1Ljc1VjEyLjYyNUMxMy4yNSAxMi4yOTM1IDEzLjExODMgMTEuOTc1NSAxMi44ODM5IDExLjc0MTFDMTIuNjQ5NSAxMS41MDY3IDEyLjMzMTUgMTEuMzc1IDEyIDExLjM3NVpNMTIgOS45Njg3NUMxMi40NTU4IDkuOTY4NzUgMTIuODkzIDkuNzg3NjcgMTMuMjE1MyA5LjQ2NTM0QzEzLjUzNzcgOS4xNDMwMSAxMy43MTg4IDguNzA1ODQgMTMuNzE4OCA4LjI1QzEzLjcxODggNy43OTQxNiAxMy41Mzc3IDcuMzU2OTkgMTMuMjE1MyA3LjAzNDY2QzEyLjg5MyA2LjcxMjMzIDEyLjQ1NTggNi41MzEyNSAxMiA2LjUzMTI1QzExLjU0NDIgNi41MzEyNSAxMS4xMDcgNi43MTIzMyAxMC43ODQ3IDcuMDM0NjZDMTAuNDYyMyA3LjM1Njk5IDEwLjI4MTIgNy43OTQxNiAxMC4yODEyIDguMjVDMTAuMjgxMiA4LjcwNTg0IDEwLjQ2MjMgOS4xNDMwMSAxMC43ODQ3IDkuNDY1MzRDMTEuMTA3IDkuNzg3NjcgMTEuNTQ0MiA5Ljk2ODc1IDEyIDkuOTY4NzVaIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+PC9zdmc+)

**Important: Network egress for widgets**\
The Atlassian Rovo MCP server uses iframes to display interactive Jira
and Confluence widgets within your AI tool (for example, Claude). If
your organization uses strict egress filtering, you must allowlist
`*.atlassian.net`. If this domain is blocked, the MCP server may appear
to be "down" or "not functioning" because the visual components will
fail to load.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTIgMjJDOS4zNDc4NCAyMiA2LjgwNDMgMjAuOTQ2NCA0LjkyODkzIDE5LjA3MTFDMy4wNTM1NyAxNy4xOTU3IDIgMTQuNjUyMiAyIDEyQzIgOS4zNDc4NCAzLjA1MzU3IDYuODA0MyA0LjkyODkzIDQuOTI4OTNDNi44MDQzIDMuMDUzNTcgOS4zNDc4NCAyIDEyIDJDMTQuNjUyMiAyIDE3LjE5NTcgMy4wNTM1NyAxOS4wNzExIDQuOTI4OTNDMjAuOTQ2NCA2LjgwNDMgMjIgOS4zNDc4NCAyMiAxMkMyMiAxNC42NTIyIDIwLjk0NjQgMTcuMTk1NyAxOS4wNzExIDE5LjA3MTFDMTcuMTk1NyAyMC45NDY0IDE0LjY1MjIgMjIgMTIgMjJWMjJaTTEyIDExLjM3NUMxMS42Njg1IDExLjM3NSAxMS4zNTA1IDExLjUwNjcgMTEuMTE2MSAxMS43NDExQzEwLjg4MTcgMTEuOTc1NSAxMC43NSAxMi4yOTM1IDEwLjc1IDEyLjYyNVYxNS43NUMxMC43NSAxNi4wODE1IDEwLjg4MTcgMTYuMzk5NSAxMS4xMTYxIDE2LjYzMzlDMTEuMzUwNSAxNi44NjgzIDExLjY2ODUgMTcgMTIgMTdDMTIuMzMxNSAxNyAxMi42NDk1IDE2Ljg2ODMgMTIuODgzOSAxNi42MzM5QzEzLjExODMgMTYuMzk5NSAxMy4yNSAxNi4wODE1IDEzLjI1IDE1Ljc1VjEyLjYyNUMxMy4yNSAxMi4yOTM1IDEzLjExODMgMTEuOTc1NSAxMi44ODM5IDExLjc0MTFDMTIuNjQ5NSAxMS41MDY3IDEyLjMzMTUgMTEuMzc1IDEyIDExLjM3NVpNMTIgOS45Njg3NUMxMi40NTU4IDkuOTY4NzUgMTIuODkzIDkuNzg3NjcgMTMuMjE1MyA5LjQ2NTM0QzEzLjUzNzcgOS4xNDMwMSAxMy43MTg4IDguNzA1ODQgMTMuNzE4OCA4LjI1QzEzLjcxODggNy43OTQxNiAxMy41Mzc3IDcuMzU2OTkgMTMuMjE1MyA3LjAzNDY2QzEyLjg5MyA2LjcxMjMzIDEyLjQ1NTggNi41MzEyNSAxMiA2LjUzMTI1QzExLjU0NDIgNi41MzEyNSAxMS4xMDcgNi43MTIzMyAxMC43ODQ3IDcuMDM0NjZDMTAuNDYyMyA3LjM1Njk5IDEwLjI4MTIgNy43OTQxNiAxMC4yODEyIDguMjVDMTAuMjgxMiA4LjcwNTg0IDEwLjQ2MjMgOS4xNDMwMSAxMC43ODQ3IDkuNDY1MzRDMTEuMTA3IDkuNzg3NjcgMTEuNTQ0MiA5Ljk2ODc1IDEyIDkuOTY4NzVaIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+PC9zdmc+)

Some AI tools set their own outbound IP addresses. This means if a user
tries to connect using the AI tool from an allowed network (for example,
their corporate VPN) the calls may still be blocked unless the tool’s IP
ranges are also added to the allowlist.

------------------------------------------------------------------------

## Disclaimer

MCP clients can perform actions in Jira, Confluence, and Compass with
your existing permissions. Use least privilege, review high‑impact
changes before confirming, and monitor audit logs for unusual activity.

Learn more: [MCP Clients - Understanding the potential security
risks](https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness "https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness")

 

Was this helpful?

Yes

No

It wasn't accurateIt wasn't clearIt wasn't relevant

Provide feedback about this article

## Still need help?

The Atlassian Community is here for you.

[Ask the
Community](https://community.atlassian.com/t5/custom/page/page-id/create-post-step-1?add-tags=security-and-access-policies,Not%20Applicable)

- [Manage Atlassian Rovo MCP
  server](/security-and-access-policies/docs/manage-atlassian-rovo-mcp-server/)

- [Understand Atlassian Rovo MCP
  server](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/)

- [Monitor Atlassian Rovo MCP server
  activity](/security-and-access-policies/docs/monitor-atlassian-rovo-mcp-server-activity/)

- Control Atlassian Rovo MCP server settings

- [Available Atlassian Rovo MCP server
  domains](/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/)

- [Configure Atlassian Rovo MCP server
  permission](/security-and-access-policies/docs/Configure-Atlassian-Rovo-MCP-server-permission/)

- Show
  more![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgcm9sZT0icHJlc2VudGF0aW9uIj48cGF0aCBmaWxsPSJjdXJyZW50Y29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjkyIDEwLjI5M2ExLjAxIDEuMDEgMCAwIDAgMCAxLjQxOWwyLjkzOSAyLjk2NWMuMjE4LjIxNS41LjMyMi43NzkuMzIycy41NTYtLjEwNy43NjktLjMyMmwyLjkzLTIuOTU1YTEuMDEgMS4wMSAwIDAgMCAwLTEuNDE5Ljk4Ny45ODcgMCAwIDAtMS40MDYgMGwtMi4yOTggMi4zMTctMi4zMDctMi4zMjdhLjk5Ljk5IDAgMCAwLTEuNDA2IDAiIC8+PC9zdmc+)

On this page[Block Atlassian-supported
domains](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Block-Atlassian-supported-domains)[Add
domains](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Add-domains)[Delete
domains](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Delete-domains)[Configure
authentication](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Configure-authentication)[How
IP allowlisting works with Atlassian Rovo MCP
server](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#How-IP-allowlisting-works-with-Atlassian-Rovo-MCP-server)[Where
you manage IP
allowlists](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Where-you-manage-IP-allowlists)[How
IP allowlists affect MCP server
usage](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#How-IP-allowlists-affect-MCP-server-usage)[How
IP allowlists relate to domain
settings](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#How-IP-allowlists-relate-to-domain-settings)[Disclaimer](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Disclaimer)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Interests/ct-p/interests)
