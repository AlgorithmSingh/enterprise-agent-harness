<!-- Source: https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Setting up IDEs (desktop clients)

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/")

After **30th June 2026**, usage of `https://mcp.atlassian.com/v1/sse` as
a server endpoint will no longer be supported.

We recommend updating any configured custom clients to point to `/mcp`:
`https://mcp.atlassian.com/v1/mcp/authv2`

 

If you're using a local development environment such as **VS Code**,
**Cursor**, or another IDE that supports the Message Context Protocol
(MCP), this guide will walk you through connecting your editor to the
Atlassian Rovo MCP Server.

This setup uses a **Node.js** based proxy tool called `mcp-remote`,
which handles authentication and communication with the server.

## Before you begin

Ensure the following are installed or accessible:

- **npx** for installation

- **Node.js v18 or later** to run the local MCP proxy (`mcp-remote`)

- An **Atlassian Cloud site** with Jira, Compass, and/or Confluence

- A supported IDE (for example, **Claude desktop, VS Code, or Cursor**)
  or a custom MCP-compatible client

- A modern browser to complete the authorization flow, if using OAuth
  2.1

- An [API
  token](https://id.atlassian.com/manage-profile/security/api-tokens?autofillToken&expiryDays=max&appId=mcp&selectedScopes=all "https://id.atlassian.com/manage-profile/security/api-tokens?autofillToken&expiryDays=max&appId=mcp&selectedScopes=all"),
  if your admin has [enabled authentication via API
  tokens](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/")

## Installation and configuration

### VS Code

You can configure VS Code to use the Atlassian Rovo MCP server in two
ways: using the integrated MCP extension UI or by manually editing your
configuration file.

#### Option 1: From the MCP directory

1.  Visit
    [https://code.visualstudio.com/mcp](https://code.visualstudio.com/mcp "https://code.visualstudio.com/mcp").

2.  Search for and install the [Atlassian Rovo MCP
    provider](https://github.com/mcp/com.atlassian/atlassian-mcp-server "https://github.com/mcp/com.atlassian/atlassian-mcp-server")
    from the marketplace.

#### Option 2: Use the VS Code command palette

1.  Open the command palette in VS Code.

2.  Run the command `MCP: Add Server`

3.  Select **Http** **or** **Server-sent Events** as the connection
    type.

4.  Enter the server URL: `https://mcp.atlassian.com/v1/mcp/authv2`

5.  Provide a name for the server (for example, `atlassian-mcp-server`).

#### Option 3: Add an `mcp.json` file manually

You can also create an `mcp.json` file in your workspace or home
directory:

`{ `` "servers": { `` "atlassian-mcp-server": { `` "url": "https://mcp.atlassian.com/v1/mcp/authv2", `` "type": "http" `` } `` }, `` "inputs": [] ``}`

For the most up-to-date instructions and options, including recent UI
changes or advanced configuration tips, visit the [official VS Code MCP
documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers "https://code.visualstudio.com/docs/copilot/chat/mcp-servers").

You can also use **GitHub Copilot CLI** with VS Code for shell, Git, and
repo-wide tasks and workflows in the terminal. See [Use MCP servers in
VS
Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers#_add-an-mcp-server "https://code.visualstudio.com/docs/copilot/customization/mcp-servers#_add-an-mcp-server")
(official VS Code MCP documentation) for more details.

### Cursor

To use Atlassian Rovo MCP with Cursor, follow these steps:

1.  Open Cursor’s MCP settings panel.

2.  Add the following configuration:

    ` "Atlassian-MCP-Server": { `` "url": "https://mcp.atlassian.com/v1/mcp/authv2" `` }`

    For older version of Cursor, you may need to use the following
    configuration.

    `"Atlassian-Rovo-MCP": { `` "command": "npx", `` "args": [ `` "mcp-remote@latest", `` "https://mcp.atlassian.com/v1/mcp/authv2" `` ] `` }`

3.  Save and restart Cursor’s AI assistant or tools pane.

Cursor updates frequently. Check the [official Cursor MCP
documentation](https://docs.cursor.com/en/context/mcp "https://docs.cursor.com/en/context/mcp")
for the latest supported features and setup advice.

### Other desktop clients

If you're using a legacy or custom MCP-compatible IDE or tool, connect
using the `mcp-remote` proxy as follows:

1.  Open your terminal.

2.  Run:

    `npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2`

     

3.  Configure your client's settings with this format:

    `"mcp.servers": { `` "Atlassian-Rovo-MCP": { `` "command": "npx", `` "args": ["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/mcp/authv2"] `` } ``}`

4.  Authenticate when prompted and leave your terminal session open.

5.  Follow your client’s documentation to trigger or test an MCP action.

## Tips for a successful setup

- Keep your terminal session running while using the IDE.

- If your token expires, re-run the `mcp-remote` command.

- Make sure your IDE’s MCP tooling is installed and enabled.

- If your IDE or client is configured to use API tokens but cannot
  connect, ask your organization admin to confirm whether
  [authentication via API token is
  enabled](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/")
  in the Atlassian Rovo MCP server settings.

## Example actions you can try

- Search Jira: “Find all issues assigned to me in the last 7 days”

- Create a Confluence page: “Create a page titled ‘Engineering Roadmap
  Q4’”

- Cross-reference: “Link the two most recent bugs to the 'Sprint 45'
  page”

------------------------------------------------------------------------

## Disclaimer

MCP clients can perform actions in Jira, Confluence, and Compass with
your existing permissions. Use least privilege, review high‑impact
changes before confirming, and monitor audit logs for unusual activity.

Learn more: [MCP Clients - Understanding the potential security
risks](https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness "https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness")

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

- [Supported tools](/atlassian-rovo-mcp-server/docs/supported-tools/)

- [Setting up
  clients](/atlassian-rovo-mcp-server/docs/setting-up-clients/)

- Setting up IDEs (desktop clients)

- [Using with other supported MCP
  clients](/atlassian-rovo-mcp-server/docs/using-with-other-supported-mcp-clients/)

- [Using Rovo search and fetch in the Atlassian Rovo MCP
  Server](/atlassian-rovo-mcp-server/docs/using-rovo-search-and-fetch-in-the-atlassian-remote-mcp-server/)

- Show
  more

On this page[Before you
begin](/atlassian-rovo-mcp-server/docs/setting-up-ides/#Before-you-begin)[Installation
and
configuration](/atlassian-rovo-mcp-server/docs/setting-up-ides/#Installation-and-configuration)[VS
Code](/atlassian-rovo-mcp-server/docs/setting-up-ides/#VS-Code)[Cursor](/atlassian-rovo-mcp-server/docs/setting-up-ides/#Cursor)[Other
desktop
clients](/atlassian-rovo-mcp-server/docs/setting-up-ides/#Other-desktop-clients)[Tips
for a successful
setup](/atlassian-rovo-mcp-server/docs/setting-up-ides/#Tips-for-a-successful-setup)[Example
actions you can
try](/atlassian-rovo-mcp-server/docs/setting-up-ides/#Example-actions-you-can-try)[Disclaimer](/atlassian-rovo-mcp-server/docs/setting-up-ides/#Disclaimer)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)
