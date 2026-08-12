<!-- Source: https://developer.atlassian.com/cloud/rovo-mcp/ -->
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

# About the Atlassian Rovo MCP Server

The Atlassian Rovo MCP Server is a cloud-hosted [Model Context Protocol
(MCP)](https://modelcontextprotocol.io/introduction)
server that connects AI-powered clients to your Atlassian Cloud
products. It provides a standardized interface for AI assistants, IDEs,
and automation tools to read, create, and update data across Jira,
Confluence, Compass, Jira Service Management, and Bitbucket - all
secured by OAuth 2.1 authorization and your existing Atlassian
permissions.

## What you can do

With the Atlassian Rovo MCP Server, AI clients can:

- **Search and summarize** Jira issues, Confluence pages, and Compass
  components without context switching.
- **Create and update** issues, pages, and components using natural
  language commands.
- **Automate repetitive work**, such as generating Jira tickets from
  meeting notes or creating Confluence documentation from specs.
- **Query across products**, such as finding Confluence docs linked to a
  Compass component or Jira issues related to a project.

## How it works

The MCP Server acts as a bridge between MCP-compatible clients and
Atlassian Cloud APIs:

1.  An AI client connects to the server endpoint at
    `https://mcp.atlassian.com/v1/mcp`.
2.  The server initiates a secure OAuth 2.1 authorization flow (or
    accepts an API token for headless authentication).
3.  Once authorized, the client can invoke tools to interact with
    Atlassian products.
4.  All actions respect the authenticated user's existing permissions -
    the server never grants access beyond what the user already has.

## Supported products

| Product | Capabilities |
|----|----|
| **Jira** | Search, create, edit, transition, and comment on issues; query projects and metadata |
| **Confluence** | Read, create, and update pages; search with CQL; manage comments and spaces |
| **Compass** | Query and create components, relationships, and custom fields; view activity events |
| **Jira Service Management** | Query and update ops alerts, schedules, and team information |
| **Bitbucket** | Browse repositories, pull requests, pipelines, deployments, and environments |
| **Rovo** | Search across Atlassian products using natural language |
| **Teamwork Graph** | Search across the Atlassian Teamwork Graph |

## Supported clients

The server works with any MCP-compatible client, including:

- [OpenAI
  ChatGPT](https://platform.openai.com/docs/guides/tools-connectors-mcp)
- [Claude Desktop and Claude
  Code](https://code.claude.com/docs/en/mcp)
- [Docker](http://mcp.docker.com)
- [GitHub Copilot
  CLI](https://code.visualstudio.com/docs/copilot/customization/mcp-servers#_add-an-mcp-server)
- [Google
  Gemini](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)
- [Amazon
  Q](https://docs.aws.amazon.com/quicksuite/latest/userguide/mcp-integration.html)
- IDEs such as VS Code, Cursor, and Windsurf

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
