1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Troubleshooting and verifying your setup

[← Back to the getting started
guide](https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ "https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/") 

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJwcmVzZW50YXRpb24iPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTMuNDg5NyA0LjM0NTkyTDIxLjg1NjEgMTguODYxMUMyMS45NTI1IDE5LjAyODggMjIuMDAyMSAxOS4yMTgxIDIxLjk5OTkgMTkuNDEwMUMyMS45OTc3IDE5LjYwMjEgMjEuOTQzOCAxOS43OTAzIDIxLjg0MzUgMTkuOTU1OUMyMS43NDMyIDIwLjEyMTUgMjEuNjAwMSAyMC4yNTg4IDIxLjQyODIgMjAuMzU0MkMyMS4yNTYzIDIwLjQ0OTcgMjEuMDYxNiAyMC40OTk5IDIwLjg2MzYgMjAuNUgzLjEzNzA3QzIuOTM4ODIgMjAuNSAyLjc0NDAxIDIwLjQ0OTggMi41NzE5NiAyMC4zNTQzQzIuMzk5OTIgMjAuMjU4OCAyLjI1NjYzIDIwLjEyMTMgMi4xNTYzMSAxOS45NTU2QzIuMDU1OTggMTkuNzg5OCAyLjAwMjEyIDE5LjYwMTUgMi4wMDAwNiAxOS40MDkzQzEuOTk4IDE5LjIxNzEgMi4wNDc4MiAxOS4wMjc4IDIuMTQ0NTYgMTguODZMMTAuNTEyMSA0LjM0NTkyQzEwLjY2MDIgNC4wODkzOSAxMC44NzYyIDMuODc1NzcgMTEuMTM3NyAzLjcyNzA4QzExLjM5OTMgMy41NzgzOCAxMS42OTcxIDMuNSAxMi4wMDAzIDMuNUMxMi4zMDM2IDMuNSAxMi42MDEzIDMuNTc4MzggMTIuODYyOSAzLjcyNzA4QzEzLjEyNDUgMy44NzU3NyAxMy4zNDA0IDQuMDg5MzkgMTMuNDg4NSA0LjM0NTkySDEzLjQ4OTdaTTEyLjAwMDMgNy44MjUzOEMxMS44MjMyIDcuODI1MzcgMTEuNjQ4MiA3Ljg2MjEyIDExLjQ4NjkgNy45MzMxN0MxMS4zMjU3IDguMDA0MjMgMTEuMTgyIDguMTA3OTMgMTEuMDY1NiA4LjIzNzNDMTAuOTQ5MiA4LjM2NjY4IDEwLjg2MjcgOC41MTg3MiAxMC44MTE5IDguNjgzMjFDMTAuNzYxMSA4Ljg0NzcgMTAuNzQ3MyA5LjAyMDgzIDEwLjc3MTMgOS4xOTA5M0wxMS4zNTQ2IDEzLjM0MTZDMTEuMzc1NCAxMy40OTMzIDExLjQ1MjMgMTMuNjMyNiAxMS41NzExIDEzLjczMzRDMTEuNjg5OSAxMy44MzQzIDExLjg0MjQgMTMuODg5OSAxMi4wMDAzIDEzLjg4OTlDMTIuMTU4MiAxMy44ODk5IDEyLjMxMDcgMTMuODM0MyAxMi40Mjk1IDEzLjczMzRDMTIuNTQ4MyAxMy42MzI2IDEyLjYyNTMgMTMuNDkzMyAxMi42NDYxIDEzLjM0MTZMMTMuMjI5MyA5LjE5MDkzQzEzLjI1MzMgOS4wMjA4MyAxMy4yMzk1IDguODQ3NyAxMy4xODg3IDguNjgzMjFDMTMuMTM4IDguNTE4NzIgMTMuMDUxNSA4LjM2NjY4IDEyLjkzNSA4LjIzNzNDMTIuODE4NiA4LjEwNzkzIDEyLjY3NDkgOC4wMDQyMyAxMi41MTM3IDcuOTMzMTdDMTIuMzUyNSA3Ljg2MjEyIDEyLjE3NzQgNy44MjUzNyAxMi4wMDAzIDcuODI1MzhWNy44MjUzOFpNMTIuMDAwMyAxNy4zMzY5QzEyLjMzOTUgMTcuMzM2OSAxMi42NjQ5IDE3LjIwNjIgMTIuOTA0NyAxNi45NzM3QzEzLjE0NDYgMTYuNzQxMiAxMy4yNzkzIDE2LjQyNTggMTMuMjc5MyAxNi4wOTY5QzEzLjI3OTMgMTUuNzY4MSAxMy4xNDQ2IDE1LjQ1MjcgMTIuOTA0NyAxNS4yMjAyQzEyLjY2NDkgMTQuOTg3NyAxMi4zMzk1IDE0Ljg1NyAxMi4wMDAzIDE0Ljg1N0MxMS42NjExIDE0Ljg1NyAxMS4zMzU4IDE0Ljk4NzcgMTEuMDk1OSAxNS4yMjAyQzEwLjg1NjEgMTUuNDUyNyAxMC43MjEzIDE1Ljc2ODEgMTAuNzIxMyAxNi4wOTY5QzEwLjcyMTMgMTYuNDI1OCAxMC44NTYxIDE2Ljc0MTIgMTEuMDk1OSAxNi45NzM3QzExLjMzNTggMTcuMjA2MiAxMS42NjExIDE3LjMzNjkgMTIuMDAwMyAxNy4zMzY5VjE3LjMzNjlaIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+PC9zdmc+)

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
  more![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdib3g9IjAgMCAyNCAyNCIgcm9sZT0icHJlc2VudGF0aW9uIj48cGF0aCBmaWxsPSJjdXJyZW50Y29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjkyIDEwLjI5M2ExLjAxIDEuMDEgMCAwIDAgMCAxLjQxOWwyLjkzOSAyLjk2NWMuMjE4LjIxNS41LjMyMi43NzkuMzIycy41NTYtLjEwNy43NjktLjMyMmwyLjkzLTIuOTU1YTEuMDEgMS4wMSAwIDAgMCAwLTEuNDE5Ljk4Ny45ODcgMCAwIDAtMS40MDYgMGwtMi4yOTggMi4zMTctMi4zMDctMi4zMjdhLjk5Ljk5IDAgMCAwLTEuNDA2IDAiIC8+PC9zdmc+)

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
