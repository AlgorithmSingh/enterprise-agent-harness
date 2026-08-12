1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Setting up IDEs (desktop clients)

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/")

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTMuNDg5NyA0LjM0NTkyTDIxLjg1NjEgMTguODYxMUMyMS45NTI1IDE5LjAyODggMjIuMDAyMSAxOS4yMTgxIDIxLjk5OTkgMTkuNDEwMUMyMS45OTc3IDE5LjYwMjEgMjEuOTQzOCAxOS43OTAzIDIxLjg0MzUgMTkuOTU1OUMyMS43NDMyIDIwLjEyMTUgMjEuNjAwMSAyMC4yNTg4IDIxLjQyODIgMjAuMzU0MkMyMS4yNTYzIDIwLjQ0OTcgMjEuMDYxNiAyMC40OTk5IDIwLjg2MzYgMjAuNUgzLjEzNzA3QzIuOTM4ODIgMjAuNSAyLjc0NDAxIDIwLjQ0OTggMi41NzE5NiAyMC4zNTQzQzIuMzk5OTIgMjAuMjU4OCAyLjI1NjYzIDIwLjEyMTMgMi4xNTYzMSAxOS45NTU2QzIuMDU1OTggMTkuNzg5OCAyLjAwMjEyIDE5LjYwMTUgMi4wMDAwNiAxOS40MDkzQzEuOTk4IDE5LjIxNzEgMi4wNDc4MiAxOS4wMjc4IDIuMTQ0NTYgMTguODZMMTAuNTEyMSA0LjM0NTkyQzEwLjY2MDIgNC4wODkzOSAxMC44NzYyIDMuODc1NzcgMTEuMTM3NyAzLjcyNzA4QzExLjM5OTMgMy41NzgzOCAxMS42OTcxIDMuNSAxMi4wMDAzIDMuNUMxMi4zMDM2IDMuNSAxMi42MDEzIDMuNTc4MzggMTIuODYyOSAzLjcyNzA4QzEzLjEyNDUgMy44NzU3NyAxMy4zNDA0IDQuMDg5MzkgMTMuNDg4NSA0LjM0NTkySDEzLjQ4OTdaTTEyLjAwMDMgNy44MjUzOEMxMS44MjMyIDcuODI1MzcgMTEuNjQ4MiA3Ljg2MjEyIDExLjQ4NjkgNy45MzMxN0MxMS4zMjU3IDguMDA0MjMgMTEuMTgyIDguMTA3OTMgMTEuMDY1NiA4LjIzNzNDMTAuOTQ5MiA4LjM2NjY4IDEwLjg2MjcgOC41MTg3MiAxMC44MTE5IDguNjgzMjFDMTAuNzYxMSA4Ljg0NzcgMTAuNzQ3MyA5LjAyMDgzIDEwLjc3MTMgOS4xOTA5M0wxMS4zNTQ2IDEzLjM0MTZDMTEuMzc1NCAxMy40OTMzIDExLjQ1MjMgMTMuNjMyNiAxMS41NzExIDEzLjczMzRDMTEuNjg5OSAxMy44MzQzIDExLjg0MjQgMTMuODg5OSAxMi4wMDAzIDEzLjg4OTlDMTIuMTU4MiAxMy44ODk5IDEyLjMxMDcgMTMuODM0MyAxMi40Mjk1IDEzLjczMzRDMTIuNTQ4MyAxMy42MzI2IDEyLjYyNTMgMTMuNDkzMyAxMi42NDYxIDEzLjM0MTZMMTMuMjI5MyA5LjE5MDkzQzEzLjI1MzMgOS4wMjA4MyAxMy4yMzk1IDguODQ3NyAxMy4xODg3IDguNjgzMjFDMTMuMTM4IDguNTE4NzIgMTMuMDUxNSA4LjM2NjY4IDEyLjkzNSA4LjIzNzNDMTIuODE4NiA4LjEwNzkzIDEyLjY3NDkgOC4wMDQyMyAxMi41MTM3IDcuOTMzMTdDMTIuMzUyNSA3Ljg2MjEyIDEyLjE3NzQgNy44MjUzNyAxMi4wMDAzIDcuODI1MzhWNy44MjUzOFpNMTIuMDAwMyAxNy4zMzY5QzEyLjMzOTUgMTcuMzM2OSAxMi42NjQ5IDE3LjIwNjIgMTIuOTA0NyAxNi45NzM3QzEzLjE0NDYgMTYuNzQxMiAxMy4yNzkzIDE2LjQyNTggMTMuMjc5MyAxNi4wOTY5QzEzLjI3OTMgMTUuNzY4MSAxMy4xNDQ2IDE1LjQ1MjcgMTIuOTA0NyAxNS4yMjAyQzEyLjY2NDkgMTQuOTg3NyAxMi4zMzk1IDE0Ljg1NyAxMi4wMDAzIDE0Ljg1N0MxMS42NjExIDE0Ljg1NyAxMS4zMzU4IDE0Ljk4NzcgMTEuMDk1OSAxNS4yMjAyQzEwLjg1NjEgMTUuNDUyNyAxMC43MjEzIDE1Ljc2ODEgMTAuNzIxMyAxNi4wOTY5QzEwLjcyMTMgMTYuNDI1OCAxMC44NTYxIDE2Ljc0MTIgMTEuMDk1OSAxNi45NzM3QzExLjMzNTggMTcuMjA2MiAxMS42NjExIDE3LjMzNjkgMTIuMDAwMyAxNy4zMzY5VjE3LjMzNjlaIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+PC9zdmc+)

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

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNyAySDE3QzE3LjY2MyAyIDE4LjI5ODkgMi4yNjMzOSAxOC43Njc4IDIuNzMyMjNDMTkuMjM2NiAzLjIwMTA3IDE5LjUgMy44MzY5NiAxOS41IDQuNVYxOS41QzE5LjUgMjAuMTYzIDE5LjIzNjYgMjAuNzk4OSAxOC43Njc4IDIxLjI2NzhDMTguMjk4OSAyMS43MzY2IDE3LjY2MyAyMiAxNyAyMkg3QzYuMzM2OTYgMjIgNS43MDEwNyAyMS43MzY2IDUuMjMyMjMgMjEuMjY3OEM0Ljc2MzM5IDIwLjc5ODkgNC41IDIwLjE2MyA0LjUgMTkuNVY0LjVDNC41IDMuODM2OTYgNC43NjMzOSAzLjIwMTA3IDUuMjMyMjMgMi43MzIyM0M1LjcwMTA3IDIuMjYzMzkgNi4zMzY5NiAyIDcgMlpNOC44NzUgN0M4LjcwOTI0IDcgOC41NTAyNyA3LjA2NTg1IDguNDMzMDYgNy4xODMwNkM4LjMxNTg1IDcuMzAwMjcgOC4yNSA3LjQ1OTI0IDguMjUgNy42MjVWOC44NzVDOC4yNSA5LjA0MDc2IDguMzE1ODUgOS4xOTk3MyA4LjQzMzA2IDkuMzE2OTRDOC41NTAyNyA5LjQzNDE1IDguNzA5MjQgOS41IDguODc1IDkuNUgxNS4xMjVDMTUuMjkwOCA5LjUgMTUuNDQ5NyA5LjQzNDE1IDE1LjU2NjkgOS4zMTY5NEMxNS42ODQyIDkuMTk5NzMgMTUuNzUgOS4wNDA3NiAxNS43NSA4Ljg3NVY3LjYyNUMxNS43NSA3LjQ1OTI0IDE1LjY4NDIgNy4zMDAyNyAxNS41NjY5IDcuMTgzMDZDMTUuNDQ5NyA3LjA2NTg1IDE1LjI5MDggNyAxNS4xMjUgN0g4Ljg3NVpNOC44NzUgMTJDOC43MDkyNCAxMiA4LjU1MDI3IDEyLjA2NTggOC40MzMwNiAxMi4xODMxQzguMzE1ODUgMTIuMzAwMyA4LjI1IDEyLjQ1OTIgOC4yNSAxMi42MjVWMTMuODc1QzguMjUgMTQuMDQwOCA4LjMxNTg1IDE0LjE5OTcgOC40MzMwNiAxNC4zMTY5QzguNTUwMjcgMTQuNDM0MiA4LjcwOTI0IDE0LjUgOC44NzUgMTQuNUgxMi42MjVDMTIuNzkwOCAxNC41IDEyLjk0OTcgMTQuNDM0MiAxMy4wNjY5IDE0LjMxNjlDMTMuMTg0MiAxNC4xOTk3IDEzLjI1IDE0LjA0MDggMTMuMjUgMTMuODc1VjEyLjYyNUMxMy4yNSAxMi40NTkyIDEzLjE4NDIgMTIuMzAwMyAxMy4wNjY5IDEyLjE4MzFDMTIuOTQ5NyAxMi4wNjU4IDEyLjc5MDggMTIgMTIuNjI1IDEySDguODc1WiIgZmlsbD0iY3VycmVudENvbG9yIiAvPjwvc3ZnPg==)

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

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNyAySDE3QzE3LjY2MyAyIDE4LjI5ODkgMi4yNjMzOSAxOC43Njc4IDIuNzMyMjNDMTkuMjM2NiAzLjIwMTA3IDE5LjUgMy44MzY5NiAxOS41IDQuNVYxOS41QzE5LjUgMjAuMTYzIDE5LjIzNjYgMjAuNzk4OSAxOC43Njc4IDIxLjI2NzhDMTguMjk4OSAyMS43MzY2IDE3LjY2MyAyMiAxNyAyMkg3QzYuMzM2OTYgMjIgNS43MDEwNyAyMS43MzY2IDUuMjMyMjMgMjEuMjY3OEM0Ljc2MzM5IDIwLjc5ODkgNC41IDIwLjE2MyA0LjUgMTkuNVY0LjVDNC41IDMuODM2OTYgNC43NjMzOSAzLjIwMTA3IDUuMjMyMjMgMi43MzIyM0M1LjcwMTA3IDIuMjYzMzkgNi4zMzY5NiAyIDcgMlpNOC44NzUgN0M4LjcwOTI0IDcgOC41NTAyNyA3LjA2NTg1IDguNDMzMDYgNy4xODMwNkM4LjMxNTg1IDcuMzAwMjcgOC4yNSA3LjQ1OTI0IDguMjUgNy42MjVWOC44NzVDOC4yNSA5LjA0MDc2IDguMzE1ODUgOS4xOTk3MyA4LjQzMzA2IDkuMzE2OTRDOC41NTAyNyA5LjQzNDE1IDguNzA5MjQgOS41IDguODc1IDkuNUgxNS4xMjVDMTUuMjkwOCA5LjUgMTUuNDQ5NyA5LjQzNDE1IDE1LjU2NjkgOS4zMTY5NEMxNS42ODQyIDkuMTk5NzMgMTUuNzUgOS4wNDA3NiAxNS43NSA4Ljg3NVY3LjYyNUMxNS43NSA3LjQ1OTI0IDE1LjY4NDIgNy4zMDAyNyAxNS41NjY5IDcuMTgzMDZDMTUuNDQ5NyA3LjA2NTg1IDE1LjI5MDggNyAxNS4xMjUgN0g4Ljg3NVpNOC44NzUgMTJDOC43MDkyNCAxMiA4LjU1MDI3IDEyLjA2NTggOC40MzMwNiAxMi4xODMxQzguMzE1ODUgMTIuMzAwMyA4LjI1IDEyLjQ1OTIgOC4yNSAxMi42MjVWMTMuODc1QzguMjUgMTQuMDQwOCA4LjMxNTg1IDE0LjE5OTcgOC40MzMwNiAxNC4zMTY5QzguNTUwMjcgMTQuNDM0MiA4LjcwOTI0IDE0LjUgOC44NzUgMTQuNUgxMi42MjVDMTIuNzkwOCAxNC41IDEyLjk0OTcgMTQuNDM0MiAxMy4wNjY5IDE0LjMxNjlDMTMuMTg0MiAxNC4xOTk3IDEzLjI1IDE0LjA0MDggMTMuMjUgMTMuODc1VjEyLjYyNUMxMy4yNSAxMi40NTkyIDEzLjE4NDIgMTIuMzAwMyAxMy4wNjY5IDEyLjE4MzFDMTIuOTQ5NyAxMi4wNjU4IDEyLjc5MDggMTIgMTIuNjI1IDEySDguODc1WiIgZmlsbD0iY3VycmVudENvbG9yIiAvPjwvc3ZnPg==)

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
  more![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgcm9sZT0icHJlc2VudGF0aW9uIj48cGF0aCBmaWxsPSJjdXJyZW50Y29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjkyIDEwLjI5M2ExLjAxIDEuMDEgMCAwIDAgMCAxLjQxOWwyLjkzOSAyLjk2NWMuMjE4LjIxNS41LjMyMi43NzkuMzIycy41NTYtLjEwNy43NjktLjMyMmwyLjkzLTIuOTU1YTEuMDEgMS4wMSAwIDAgMCAwLTEuNDE5Ljk4Ny45ODcgMCAwIDAtMS40MDYgMGwtMi4yOTggMi4zMTctMi4zMDctMi4zMjdhLjk5Ljk5IDAgMCAwLTEuNDA2IDAiIC8+PC9zdmc+)

- [Supported tools](/atlassian-rovo-mcp-server/docs/supported-tools/)

- [Setting up
  clients](/atlassian-rovo-mcp-server/docs/setting-up-clients/)

- Setting up IDEs (desktop clients)

- [Using with other supported MCP
  clients](/atlassian-rovo-mcp-server/docs/using-with-other-supported-mcp-clients/)

- [Using Rovo search and fetch in the Atlassian Rovo MCP
  Server](/atlassian-rovo-mcp-server/docs/using-rovo-search-and-fetch-in-the-atlassian-remote-mcp-server/)

- Show
  more![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgcm9sZT0icHJlc2VudGF0aW9uIj48cGF0aCBmaWxsPSJjdXJyZW50Y29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjkyIDEwLjI5M2ExLjAxIDEuMDEgMCAwIDAgMCAxLjQxOWwyLjkzOSAyLjk2NWMuMjE4LjIxNS41LjMyMi43NzkuMzIycy41NTYtLjEwNy43NjktLjMyMmwyLjkzLTIuOTU1YTEuMDEgMS4wMSAwIDAgMCAwLTEuNDE5Ljk4Ny45ODcgMCAwIDAtMS40MDYgMGwtMi4yOTggMi4zMTctMi4zMDctMi4zMjdhLjk5Ljk5IDAgMCAwLTEuNDA2IDAiIC8+PC9zdmc+)

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
