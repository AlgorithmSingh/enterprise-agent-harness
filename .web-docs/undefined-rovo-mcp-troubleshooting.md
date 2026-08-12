<!-- Source: https://support.atlassian.com/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Troubleshooting and verifying your setup

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/") 

After **30th June 2026**, usage of `https://mcp.atlassian.com/v1/sse` as
a server endpoint will no longer be supported.

We recommend updating any configured custom clients to point to `/mcp`:
`https://mcp.atlassian.com/v1/mcp/authv2`

 

Once you've completed the setup for your MCP client, it's important to
confirm that your connection is working correctly. This guide walks you
through validation steps, common symptoms of problems, and how to
resolve them.

## Quick checks

Try these simple actions to verify your setup:

- **Supported clients**: Open a new chat, make sure to use **Atlassian
  Rovo**, and ask to complete a task that references Jira or Confluence
  data, such as “List my Jira issues.”

- **IDE:** Use the command palette or sidebar to access Jira or
  Confluence.

If the connection is successful, you should receive content back from
your Atlassian site, based on your access permissions.

## Expected results

When things are working properly, you should observe the following:

- **Supported clients**: Displays AI-generated responses referencing
  live Jira or Confluence data.

- **IDE**: Shows file tree integration or in-editor search tools.

If nothing happens, you likely have a permissions issue or
authentication failure.

## Common setup problems

|  |  |  |
|----|----|----|
| **Symptom** | **Likely cause** | **How to fix it** |
| No response in supported clients or IDE | Tools not enabled or session not authorized | Re-run the connection flow and enable Jira/Confluence tools |
| Access denied or errors | Insufficient site or product permissions | Confirm you have access to Jira or Confluence in Atlassian Admin |
| Empty or partial results | Token expired or missing scopes | Re-authenticate and check scope approval during login |
| OAuth loop or redirect error | Browser blocking pop-ups or blocked redirect URI | Allow `http://localhost:3334` in browser and firewall settings |

## Re-authenticating

If your token expires, your session will silently fail. You may need to:

- Re-run the setup command (for example, `npx mcp-remote`) to trigger a
  new login

- Close and reopen your Claude chat to restart the flow

- Review the scopes you’ve approved and ensure they match your intended
  use

## Still stuck?

- Check the logs from your MCP client or CLI terminal for additional
  error messages.

- Verify that your Atlassian Cloud site is accessible and not restricted
  by VPN or network filters.

- Ask your site admin to verify your user access.

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

- [Using with other supported MCP
  clients](/atlassian-rovo-mcp-server/docs/using-with-other-supported-mcp-clients/)

- [Using Rovo search and fetch in the Atlassian Rovo MCP
  Server](/atlassian-rovo-mcp-server/docs/using-rovo-search-and-fetch-in-the-atlassian-remote-mcp-server/)

- Troubleshooting and verifying your setup

- [Connect Rovo to Gemini via Google Cloud
  Marketplace](/atlassian-rovo-mcp-server/docs/connect-rovo-to-gemini-via-google-cloud-marketplace/)

- [Teamwork Graph CLI and Rovo MCP decision
  guide](/atlassian-rovo-mcp-server/docs/teamwork-graph-cli-and-rovo-mcp-decision-guide/)

On this page[Quick
checks](/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/#Quick-checks)[Expected
results](/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/#Expected-results)[Common
setup
problems](/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/#Common-setup-problems)[Re-authenticating](/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/#Re-authenticating)[Still
stuck?](/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/#Still-stuck)[Disclaimer](/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/#Disclaimer)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)
