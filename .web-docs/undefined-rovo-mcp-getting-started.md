<!-- Source: https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Getting started with the Atlassian Rovo MCP Server

In browser and desktop agents, Atlassian Rovo MCP connects your AI agent
to your Atlassian apps and work, all accessible in one conversation –
powered by your [Teamwork
Graph](https://teamworkgraph.com/ "https://teamworkgraph.com/").

**Supported clients and IDEs**

The Atlassian Rovo MCP Server supports any app with MCP support,
including:

- [OpenAI
  ChatGPT](https://platform.openai.com/docs/guides/tools-connectors-mcp "https://platform.openai.com/docs/guides/tools-connectors-mcp")

- [Claude](https://code.claude.com/docs/en/mcp "https://code.claude.com/docs/en/mcp")

- [Docker](http://mcp.docker.com "http://mcp.docker.com")

- [GitHub Copilot
  CLI](https://code.visualstudio.com/docs/copilot/customization/mcp-servers#_add-an-mcp-server "https://code.visualstudio.com/docs/copilot/customization/mcp-servers#_add-an-mcp-server")

- [Google
  Gemini](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md "https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md")

- [Amazon Quick
  Suite](https://docs.aws.amazon.com/quicksuite/latest/userguide/mcp-integration.html "https://docs.aws.amazon.com/quicksuite/latest/userguide/mcp-integration.html")

## How it works

With Rovo MCP, you can:

- **Summarize and search** Jira, Jira Service Management, Confluence,
  and Bitbucket without switching tools.

- **Create and update** work items or pages using natural language
  commands.

- **Automate repetitive tasks**, such as generating work from meeting
  notes or specs.

Connect once, then describe what you want:

- *"What's the status of PROJ-1234?"*

- *"Summarize the Q2 planning page."*

- *"Create five Jira work items from these meeting notes."*

- *“Move PROJ-456 to 'In Review' and add a comment that the PR is up.”*

No tab switching. No copy-pasting. Your AI selects and runs the right
actions.

------------------------------------------------------------------------

## Get started

For full setup instructions, see the
[clients](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-clients/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-clients/")
and
[IDEs](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/")
guides.

### Step 1: Connect your client

Your AI coding agent can install, authenticate, and set up Rovo MCP.
Copy and paste this prompt into your agent:

`Set up Atlassian Rovo MCP for this agent using the official setup guide at https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/ and the MCP server URL https://mcp.atlassian.com/v1/mcp/authv2. Then start the Atlassian MCP authentication flow so I can sign in.`

Alternatively, select your client and add the Atlassian Rovo MCP Server.

#### VS Code / GitHub Copilot

Quick install: [Add to VS
Code](https://insiders.vscode.dev/redirect/mcp/install?name=atlassian&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.atlassian.com%2Fv1%2Fmcp%22%7D "https://insiders.vscode.dev/redirect/mcp/install?name=atlassian&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.atlassian.com%2Fv1%2Fmcp%22%7D")

Or add manually:

1.  Open the **Extensions view** and enter `@mcp Atlassian` in the
    search field.

2.  Select the **Atlassian MCP server** from the gallery.

3.  Select **Install**.

#### Cursor

Quick install: [Add to
Cursor](https://cursor.com/install-mcp?name=atlassian&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vbWNwLmF0bGFzc2lhbi5jb20vdjEvbWNwIn0%3D "https://cursor.com/install-mcp?name=atlassian&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vbWNwLmF0bGFzc2lhbi5jb20vdjEvbWNwIn0%3D")

Or add manually:

1.  Go to [Atlassian plugin for Cursor with
    MCP](https://cursor.com/marketplace/atlassian/atlassian "https://cursor.com/marketplace/atlassian/atlassian")
    on the Cursor Marketplace.

2.  Select **Add to Cursor**.

#### Claude Code

1.  Run the following command:

    `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2`

2.  Run `/mcp` once you’ve opened a Claude Code session to authenticate.

#### Claude Desktop

1.  Open **Claude Desktop**.

2.  Go to **Settings** \> **Extensions**.

3.  Select **Browse extensions**, then select **Plugins**.

4.  Search for **Atlassian** and install it.

Or, add it to your config file:

`{ `` "mcpServers": { `` "atlassian": { `` "url": "https://mcp.atlassian.com/v1/mcp/authv2" `` } `` } ``}`

#### Codex Desktop

1.  Open **Codex Desktop**.

2.  Go to **Plugins** or **Connectors**.

3.  Find **Atlassian Rovo**.

4.  Install the app.

#### Codex

Run the following command:

`codex mcp add atlassian --url https://mcp.atlassian.com/v1/mcp/authv2`

#### Windsurf

1.  Open your **Windsurf** settings

2.  Go to **Cascade** \> **MCP servers**

3.  Select **Add Server** \> **Add custom server**

4.  Add the following:

`{ `` "mcpServers": { `` "atlassian": { `` "serverUrl": "https://mcp.atlassian.com/v1/mcp/authv2" `` } `` } ``}`

#### Other MCP-compatible clients

Use this server URL:

`https://mcp.atlassian.com/v1/mcp/authv2`

------------------------------------------------------------------------

### Step 2: Authenticate

After setup, sign in when your agent or MCP client starts the Atlassian
authentication flow.

Need help? [*How to troubleshoot your Atlassian Rovo MCP
setup*](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/")

Atlassian Rovo MCP is **powered by secure OAuth 2.1 authorization**,
which ensures all actions respect users' existing access controls and
permissions.

[Authentication via API
token](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/")
is also available as optional.

------------------------------------------------------------------------

**_(Disclaimer:)**
_(MCP clients can perform actions on all connected products (such as Jira, Confluence, Bitbucket) with your existing permissions. Use least privilege, review high‑impact changes before confirming, and monitor audit logs for unusual activity.)
[_(*Understanding the security risks of MCP clients*)](https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness "https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness")

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

- Getting started with the Atlassian Rovo MCP Server

- [Authentication and
  authorization](/atlassian-rovo-mcp-server/docs/authentication-and-authorization/)

- [Configuring OAuth
  2.1](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/)

- [Configuring authentication via API
  token](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/)

- [Supported tools](/atlassian-rovo-mcp-server/docs/supported-tools/)

- Show
  more

On this page[How it
works](/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/#How-it-works)[Get
started](/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/#Get-started)[Step
1: Connect your
client](/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/#Step-1--Connect-your-client)[Step
2:
Authenticate](/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/#Step-2--Authenticate)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)
