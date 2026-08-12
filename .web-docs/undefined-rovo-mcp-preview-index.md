<!-- Source: https://developer.atlassian.com/cloud/rovo-mcp/preview/index/ -->
<!-- Accessed: 2026-08-12 -->

[](https://www.atlassian.com/)

[Developer](https://developer.atlassian.com/)

Documentation

Resources

[News and Updates](/news-and-updates/)

[Get Support](https://developer.atlassian.com/support)

[](/account/login?returnTo=)

Sign in

[](https://www.atlassian.com/)

[Developer](https://developer.atlassian.com/)

[Get Support](https://developer.atlassian.com/support)

[](/account/login?returnTo=)

Sign in

DOCUMENTATION

Cloud

Data Center

Resources

[](/news-and-updates/)

News and Updates

[](/support/)

Get support

[](/account/login?returnTo=)

Sign in

[](https://www.atlassian.com/)

[Developer](https://developer.atlassian.com/)

[](/account/login?returnTo=)

Sign in

DOCUMENTATION

Cloud

Data Center

Resources

[](/news-and-updates/)

News and Updates

[](/support/)

Get support

[](/account/login?returnTo=)

Sign in

# Atlassian Rovo MCP

- [Guides](/cloud/rovo-mcp/)
- [Changelog](/cloud/rovo-mcp/changelog/)

# Atlassian Rovo MCP

- Guides
- [Changelog](/cloud/rovo-mcp/changelog/)

- [](/cloud/rovo-mcp/)Atlassian Rovo MCP Overview

&nbsp;

- Guides

  

  - [](/cloud/rovo-mcp/guides/getting-started/)Getting started

  - [](/cloud/rovo-mcp/guides/authentication-and-authorization/)Authentication
    and authorization

  - [](/cloud/rovo-mcp/guides/supported-tools/)Supported tools

  - [](/cloud/rovo-mcp/guides/configuring-oauth-2-1/)Configuring OAuth
    2.1

  - [](/cloud/rovo-mcp/guides/configuring-authentication-via-api-token/)Configuring
    authentication via API token

- Atlassian Rovo MCP Preview

  

  - [](/cloud/rovo-mcp/preview/index/)Preview Details

  - [](/cloud/rovo-mcp/preview/tools/)Preview Tools

  - [](/cloud/rovo-mcp/preview/api-token-scopes/)API token scopes

Last updated Jun 30, 2026

# About the Atlassian Rovo MCP Preview

# Preview release

This is a **Preview** release. The Preview endpoint is early access and
is subject to change, including the available MCP tools and their
responses. Please share any feedback, bugs, or learnings in the
[Atlassian Rovo MCP Server
community](https://community.atlassian.com/forums/Atlassian-Rovo-MCP-Server/gh-p/AtlassianMCPServer).

Atlassian provides a Preview endpoint for consuming and testing new
features before they become generally available. It gives early access
to the next version of the [Atlassian Rovo MCP Server](/cloud/rovo-mcp/)
(MCP v2) ahead of its broader release.

## Preview endpoint

Connect your MCP client to the Preview endpoint:

    1
    2

``` text
https://mcp.atlassian.com/v1/mcp/preview
```

This is separate from the generally available endpoint
(`https://mcp.atlassian.com/v1/mcp`). Authentication, supported
products, and supported clients are the same as the GA server - see the
[Atlassian Rovo MCP overview](/cloud/rovo-mcp/) for details. Use the
Preview endpoint only when you want to evaluate upcoming features.

## What's new in the current v2 preview

The Preview release introduces several significant changes:

- **Dozens of new tools** abstracted behind the `discover` and `execute`
  tools, so clients can find and run a much larger catalog of operations
  without inflating the default tool list.
- **New and improved Confluence tools**, including support for
  attachments, whiteboards, databases, and more.
- **Reduced default tool exposure**, cutting context window consumption
  by more than 50%.
- **Optimised tool responses**, substantially reducing the context
  window consumed by tool invocations.

As the preview endpoint will continue to evolve, tools and their
responses may change.

For the full list of tools available on the Preview endpoint, see
[Atlassian Rovo MCP Preview tools](/cloud/rovo-mcp/preview/tools/).

## Network allowlist

Some tools, like whiteboards and attachments, need your agent to reach
additional Atlassian domains. If your agent runs in a sandboxed or
network-restricted environment, you'll need to allowlist these domains
for those tools to work:

- `api.media.atlassian.com`
- `*.frontend.public.atl-paas.net`

If you're using Claude Code, add these domains to the
`network.allowedDomains` setting. See the [Claude Code sandbox
settings](https://code.claude.com/docs/en/settings#sandbox-settings)
for details.

## Share feedback

The Preview endpoint will evolve. If you hit a bug, have a feature
request, or want to share how you're using it, post in the [Atlassian
Rovo MCP Server
community](https://community.atlassian.com/forums/Atlassian-Rovo-MCP-Server/gh-p/AtlassianMCPServer).

Rate this page:

Unusable

Poor

Okay

Good

Excellent

[](https://www.atlassian.com/)

[Changelog](/changelog/)[System
status](https://status.developer.atlassian.com)[Privacy](https://www.atlassian.com/legal/privacy-policy)[Notice
at
Collection](https://www.atlassian.com/legal/privacy-policy#additional-disclosures-for-ca-residents)[Developer
Terms](/platform/marketplace/atlassian-developer-terms/)[Trademark](https://www.atlassian.com/legal/trademark)Cookie
preferences© 2026 Atlassian
