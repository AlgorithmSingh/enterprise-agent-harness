<!-- Source: https://support.atlassian.com/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Security and access policies
    Resources](/security-and-access-policies/resources/)
3.  [Maintain secure access to
    apps](/security-and-access-policies/docs/maintain-secure-access-to-products/)
4.  [Manage Atlassian Rovo MCP
    server](/security-and-access-policies/docs/manage-atlassian-rovo-mcp-server/)

# Understand Atlassian Rovo MCP server

The Atlassian Rovo MCP (Model Context Protocol) server allows tools,
like AI assistants and developer environments, to securely access Jira,
Confluence, and Compass data. This enables your AI tools to perform
actions, such searching for work items, summarizing pages, or
bulk-creating new content via natural language commands.

## What are Atlassian-supported domains?

[Atlassian-supported
domains](https://support.atlassian.com/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/#Atlassian-supported-domains "https://support.atlassian.com/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/#Atlassian-supported-domains")
are a list of Atlassian AI partners. Atlassian works with AI companies
like Anthropic or OpenAI that create AI tools like Claude.ai or ChatGPT.

Atlassian-supported domains allow you to connect AI tools that meet
Atlassian standards to Jira, Confluence, and Compass. By default, we
automatically allow the Atlassian-supported domains that enable OAuth
connections between AI tools and the Atlassian apps in your
organization.

You can block all Atlassian-supported domains from accessing apps in
your organization. You cannot block individual domains. You can only
allow or block the entire domain list. See [Block Atlassian-supported
domains](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Block-Atlassian-supported-domains "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Block-Atlassian-supported-domains")
for more details.

## Authorize your domains

You can authorize access to the Atlassian Rovo MCP server for AI tools
that you trust. When you add a domain, this approves it for users in
your organization to connect to AI tools. See [Add
domains](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Add-domains "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/#Add-domains")
for details.

## Authentication methods

Atlassian Rovo MCP server supports two main ways for tools to connect to
Jira, Confluence, and Compass:

- **OAuth 2.1 (recommended, default)**

  - Users connect their AI tools (for example,
    [*Claude.ai*](http://claude.ai/ "http://claude.ai/") or ChatGPT) to
    Atlassian apps using an OAuth 2.1 consent screen.

  - Access is scoped to the user’s existing permissions in Atlassian.

  - Admins control which tools can connect using **domain settings** and
    existing Atlassian app management controls.

- **API tokens (advanced)**

  - Admins can allow tools to connect using an **API token** instead of
    per‑user OAuth consent.

  - This is useful for **service‑style or non‑interactive tools** that
    need consistent access without user prompts.

  - Authentication is controlled by an **organization‑level setting** in
    the Atlassian Rovo MCP server settings.

These authentication methods work together with your existing security
controls:

- **Domain settings** (in Atlassian Rovo MCP server) control **which AI
  tools and domains** are allowed to connect when tools use OAuth 2.1.

- **IP allowlists** (at the organization level) control **where users
  and tools can connect from**, regardless of which tool they use.

- The **authentication method** (OAuth 2.1 or API token) controls
  **how** the tool is authorized to act in Jira, Confluence, and
  Compass.

For a tool call to succeed, all of the following must be true:

- If the tool is using OAuth 2.1, its domain is allowed in the
  **Atlassian Rovo MCP server domain settings**.

- The request originates from an IP address that is allowed by your
  organization’s **IP allowlists** (if configured).

- The tool uses an authentication method that is **allowed by your
  organization’s settings** (for example, authentication via API token
  is enabled if the tool is using an API token).

To learn how to control whether users can connect via API token, see
[Control Atlassian Rovo MCP server
settings](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/").

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
supported, see [Specify IP addresses for app
access](https://support.atlassian.com/security-and-access-policies/docs/specify-ip-addresses-for-product-access/ "https://support.atlassian.com/security-and-access-policies/docs/specify-ip-addresses-for-product-access/").

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

Note, some AI tools set their own outbound IP addresses. This means if a
user tries to connect using the AI tool from an allowed network – for
example, their corporate VPN – the calls may still be blocked unless the
tool’s IP ranges are also added to the allowlist.

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

- Understand Atlassian Rovo MCP server

- [Monitor Atlassian Rovo MCP server
  activity](/security-and-access-policies/docs/monitor-atlassian-rovo-mcp-server-activity/)

- [Control Atlassian Rovo MCP server
  settings](/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/)

- [Available Atlassian Rovo MCP server
  domains](/security-and-access-policies/docs/available-atlassian-rovo-mcp-server-domains/)

- [Configure Atlassian Rovo MCP server
  permission](/security-and-access-policies/docs/Configure-Atlassian-Rovo-MCP-server-permission/)

- Show
  more

On this page[What are Atlassian-supported
domains?](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#What-are-Atlassian-supported-domains)[Authorize
your
domains](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#Authorize-your-domains)[Authentication
methods](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#Authentication-methods)[How
IP allowlisting works with Atlassian Rovo MCP
server](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#How-IP-allowlisting-works-with-Atlassian-Rovo-MCP-server)[Where
you manage IP
allowlists](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#Where-you-manage-IP-allowlists)[How
IP allowlists affect MCP server
usage](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#How-IP-allowlists-affect-MCP-server-usage)[How
IP allowlists relate to domain
settings](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#How-IP-allowlists-relate-to-domain-settings)[Disclaimer](/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/#Disclaimer)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Interests/ct-p/interests)
