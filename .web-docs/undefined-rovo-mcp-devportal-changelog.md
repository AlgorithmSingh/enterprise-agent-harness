<!-- Source: https://developer.atlassian.com/cloud/rovo-mcp/changelog/ -->
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

Last updated Jul 1, 2026

Filter
types

## 1 July 2026

#### Announcement Atlassian Rovo MCP v2 - Preview

This is a **Preview** release of the Atlassian Rovo MCP v2. This
endpoint is considered early access and will be subject to change;
including the MCP tools and their responses.

We’re excited to share that a preview release of our new Atlassian Rovo
MCP is now available for early access. This release introduces some
significant changes including:

- Dozens of new tools abstracted behind *discover* and *execute* tools

- New and improved Confluence tools, introducing support for
  attachments, whiteboards, databases and more.

- Reduced default tool exposure, reducing context window consumption by
  \>50%

- Optimised tool responses, substantially reducing context window
  consumption from tool invocations

The *preview* endpoint is now available at
`https://mcp.atlassian.com/v1/mcp/preview` and can be utilised today.

## 27 April 2026

#### Announcement Atlassian MCP moving to new DCR OAuth provider

Atlassian Rovo MCP will start utilising a different auth server
(Atlassian Identity) for DCR OAuth from May 27, 2026. Any existing
client implementations must ensure that they are not caching the auth
state (including `client_id` and the
`/.well-known/oauth-authorization-server` discovery document) as these
will not be recognised the by the new server.

The new DCR OAuth implementation can be tested in the interim through
the use of the `https://mcp.atlassian.com/v1/mcp/authv2` url. In
addition, this the new authorisation server details can be temporarily
obtained via
`https://mcp.atlassian.com/.well-known/oauth-protected-resource/v1/mcp/authv2`.

From May 27, 2026 all requests to `https://mcp.atlassian.com/v1/mcp/`
will utilise the new auth server and any clients which are still caching
may start to fail.

1

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
