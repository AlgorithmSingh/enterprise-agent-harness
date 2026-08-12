<!-- Source: https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/ -->
<!-- Accessed: 2026-08-12 -->

1.  [Atlassian Support](/)
2.  [Resources](/atlassian-rovo-mcp-server/resources/)
3.  [Set up Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/set-up-atlassian-rovo-mcp-server/)
4.  [Use Atlassian Rovo MCP
    Server](/atlassian-rovo-mcp-server/docs/use-atlassian-rovo-mcp-server/)

# Supported tools

- Tools marked Beta are currently free to use. In the future, some Beta
  tools may become paid features billed in Rovo credits.

- Teamwork Graph tools (`getTeamworkGraphContext`,
  `getTeamworkGraphObject`) aggregate data across multiple Atlassian
  products and connected apps, and may use AI processing to generate
  contextual insights. When these tools move to general availability,
  they will be billed at a minimum of 1 Rovo credit per call. Calls that
  involve AI inferencing or multi-step graph queries may be billed at a
  higher rate. We will provide at least 90 days' notice before any
  charges take effect, along with published pricing details.

This page lists all the tools supported by Atlassian Rovo MCP server.
Each listed tool is organised into **permission groups**, with each
grouping one or more Atlassian Rovo MCP server tools by intent (for
example, read, write, or search). [Organisation admins grant or revoke
access at the permission-group
level](https://support.atlassian.com/security-and-access-policies/docs/Configure-Atlassian-Rovo-MCP-server-permission/ "https://support.atlassian.com/security-and-access-policies/docs/Configure-Atlassian-Rovo-MCP-server-permission/"),
and each tool inherits the access of its parent group.

## Common tools

|  |  |
|----|----|
| **Tool** | **Description** |
| `atlassianUserInfo` | Get the current authenticated user's account information. |
| `getAccessibleAtlassianResources` | List all Atlassian sites and apps accessible to the authenticated user, including their `cloudId` values. Required first call for any tool because every tool call needs a `cloudId`. |

## Jira tools

### read_jira

**Available using:** OAuth 2.1 and API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `getJiraIssue` | Get a Jira issue by ID or key. | `read:jira-work` |
| `getJiraIssueRemoteIssueLinks` | List remote issue links (for example, Confluence links) on a Jira issue. | `read:jira-work` |
| `getJiraIssueTypeMetaWithFields` | Get create‑field metadata for a project and issue type. | `read:jira-work` |
| `getJiraProjectIssueTypesMetadata` | List issue types available in a Jira project. | `read:jira-work` |
| `getIssueLinkTypes` | List available issue link types | `read:jira-work` |
| `getTransitionsForJiraIssue` | List available workflow transitions for an issue. | `read:jira-work` |
| `getVisibleJiraProjects` | List Jira projects the user can access. | `read:jira-work` |
| `lookupJiraAccountId` | Find Jira user account IDs by name or email. | `read:jira-work` |

### write_jira

**Available using:** OAuth 2.1 and API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `addCommentToJiraIssue` | Add a comment to an existing Jira issue, or update an existing comment when `commentID` is provided. | `write:jira-work` |
| `addWorklogToJiraIssue` | Adds a time-tracking worklog to a Jira issue. | `write:jira-work` |
| `createJiraIssue` | Create a link between two Jira issues. | `write:jira-work` |
| `editJiraIssue` | Update fields on an existing Jira issue. | `write:jira-work` |
| `transitionJiraIssue` | Perform a workflow transition on a Jira issue. | `write:jira-work` |

### search_jira

**Available using:** OAuth 2.1 and API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `searchJiraIssuesUsingJql` | Search Jira issues using a JQL query | `search:jira-work` |

## Confluence tools

### read_confluence

**Available using:** OAuth 2.1 and API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `getConfluencePage` | Get a Confluence page or live doc by ID. | `read:page:confluence` |
| `getConfluencePageDescendants` | List descendant pages under a parent page. | `read:hierarchical-content:confluence` |
| `getConfluencePageFooterComments` | List footer comments on a page. | `read:comment:confluence` |
| `getConfluencePageInlineComments` | List inline comments on a page. | `read:comment:confluence` |
| `getConfluenceCommentChildren` | List child comments (replies) of a comment. | `read:comment:confluence` |
| `getConfluenceSpaces` | List Confluence spaces. | `read:space:confluence` |
| `getPagesInConfluenceSpace` | List pages in a space. | `read:page:confluence` |

### write_confluence

**Available using:** OAuth 2.1 and API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `createConfluencePage` | Create a new Confluence page or live doc. | `write:page:confluence` |
| `updateConfluencePage` | Update an existing Confluence page or live doc. | `write:page:confluence` |
| `createConfluenceFooterComment` | Create a footer comment or reply on a page. | `write:page:confluence` |
| `createConfluenceInlineComment` | Create an inline comment tied to selected text. | `write:page:confluence` |

### search_confluence

**Available using:** OAuth 2.1 and API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `searchConfluenceUsingCql` | Search Confluence content using CQL. | `search:confluence` |

## Jira Service Management tools

Jira Service Management tools only support authentication via API token.
These tools are only available if authentication via API token is
[*enabled by your organization
admin*](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/").

### read_jsm

**Available using:** API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `getJsmOpsAlerts` | Get an operations alert by ID or alias, or search query. | `read:ops-alert:jira-service-management`, `read:ops-config:jira-service-management`, `read:jira-user` |
| `getJsmOpsScheduleInfo` | List on-call schedules or get current/next responders. | `read:ops-config:jira-service-management`, `read:jira-user` |
| `getJsmOpsTeamInfo` | List operation teams and team details. | `read:ops-config:jira-service-management`, `read:jira-user` |

### write_jsm

**Available using:** API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `updateJsmOpsAlert` | Perform alert actions, like acknowledge, unacknowledge, close, or escalate an alert. | `read:ops-alert:jira-service-management`, `write:ops-alert:jira-service-management` |

## Bitbucket Cloud tools

Bitbucket Cloud tools only support authentication via API tokens with
scopes. These tools are only available if authentication via an API
token with scopes is [*enabled by your organization
admin*](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ "https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/")
and your [*Bitbucket workspace is linked to an
organization*](https://support.atlassian.com/bitbucket-cloud/kb/linking-your-bitbucket-cloud-workspace-to-an-atlassian-organization/ "https://support.atlassian.com/bitbucket-cloud/kb/linking-your-bitbucket-cloud-workspace-to-an-atlassian-organization/").

### read_bitbucket

**Available using:** API token authentication

|  |  |  |  |
|----|----|----|----|
| **Tool** | **Actions** | **Description** | **Required scopes** |
| `bitbucketWorkspace` | `list`, `get` | Get workspace details. | `read:workspace:bitbucket` |
| `bitbucketRepository` | `list`, `get`, `defaultReviewers` | Get repository details and content. | `read:repository:bitbucket` |
| `bitbucketUser` | `pullRequests` | Get pull requests for the authenticated user. | `read:pullrequest:bitbucket` |
| `bitbucketDeployment` | `list`, `get` | Get deployment information. | `read:pipeline:bitbucket` |
| `bitbucketPullRequest` | `list`, `get`, `comments`, `diff` | Get pull requests. | `read:pullrequest:bitbucket` |
| `bitbucketRepoContent` | `branch.get`, `commit.get`, `files.get` | Get repository content. | `read:repository:bitbucket` |
| `bitbucketPipeline` | `list`, `get`, `steps`, `step.get`, `step.log` | Get pipeline details. | `read:pipeline:bitbucket` |
| `bitbucketEnvironment` | `list`, `get` | Get an environment. | `read:pipeline:bitbucket` |

### write_bitbucket

**Available using:** API token authentication

[TABLE]

## Atlassian Platform

### read_teamwork_graph

**Available using:** OAuth 2.1 and API token authentication

**Third-party data access:** Teamwork Graph MCP tools can retrieve data
from third-party services connected to Jira, such as linked pull
requests, builds, and deployments.

**GitHub for Atlassian:** the data retrievable via MCP depends on the
permission level you've granted to the connector.

- **Full access** – MCP tools can retrieve GitHub data based on the
  user’s GitHub permissions

- **Limited access** – MCP tools can retrieve GitHub data based on the
  user’s Jira permissions, which may differ from the user’s GitHub
  permissions. If a user can see a GitHub link in a Jira work item, they
  can retrieve only what they see on the Jira work item

You can check or change your access level in the GitHub for Atlassian
configuration screen in Jira.

**Other connectors:** Azure DevOps, GitLab, Jenkins, and Spinnaker
connectors follow the *limited access* model referenced above, meaning
MCP tools can retrieve data based on Jira permissions and not the
permissions set in the underlying third party service (e.g. Azure
DevOps). 

[TABLE]

### search_atlassian

**Available using:** OAuth 2.1 and API token authentication

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `searchAtlassian` (beta) | Search across Jira and Confluence using natural language via Rovo. | `search:rovo:mcp` |
| `fetchAtlassian` (beta) | Fetch Jira or Confluence content by Atlassian Resource Identifier (ARI). | `search:rovo:mcp` |

## Compass tools

You can only use [*OAuth
authentication*](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/ "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/")
with Compass tools.

### read_compass

**Available using:** OAuth 2.1

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `getCompassComponent` | Get details for a Compass component by ID. | `read:component:compass` |
| `getCompassComponents` | Search or list Compass components. | `read:component:compass` |
| `getCompassComponentActivityEvents` | List recent activity events for a component. | `read:component:compass` |
| `getCompassComponentLabels` | Get the labels applied to a component. | `read:component:compass` |
| `getCompassComponentTypes` | List available Compass component types. | `read:component:compass` |
| `getCompassCustomFieldDefinitions` | List custom field definitions. | `read:component:compass` |
| `getCompassComponentsOwnedByMyTeams` | List components owned by your teams. | `read:component:compass` |

### write_compass

**Available using:** OAuth 2.1

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `createCompassComponent` | Create a Compass component. | `write:component:compass` |
| `createCompassComponentRelationship` | Create a relationship between two components. | `write:component:compass` |
| `createCompassCustomFieldDefinition` | Create a Compass custom field definition. | `write:component:compass` |

## Shared platform tools

These tools do not belong to a permission group and are required for
overall MCP server operation.

|  |  |  |
|----|----|----|
| **Tool** | **Description** | **Required scopes** |
| `atlassianUserInfo` | Get current Atlassian user details, such as account ID. | `read:me` |
| `getAccessibleAtlassianResources` | List Atlassian cloud sites (`cloudId`) that the user can access. | `read:account` , `read:me` |

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

- [Configuring OAuth
  2.1](/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/)

- [Configuring authentication via API
  token](/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/)

- Supported tools

- [Setting up
  clients](/atlassian-rovo-mcp-server/docs/setting-up-clients/)

- [Setting up IDEs (desktop
  clients)](/atlassian-rovo-mcp-server/docs/setting-up-ides/)

- Show
  more

On this page[Common
tools](/atlassian-rovo-mcp-server/docs/supported-tools/#Common-tools)
[Jira
tools](/atlassian-rovo-mcp-server/docs/supported-tools/#Jira-tools)[read_jira](/atlassian-rovo-mcp-server/docs/supported-tools/#read)[write_jira](/atlassian-rovo-mcp-server/docs/supported-tools/#write)[search_jira](/atlassian-rovo-mcp-server/docs/supported-tools/#search)[Confluence
tools](/atlassian-rovo-mcp-server/docs/supported-tools/#Confluence-tools)[read_confluence](/atlassian-rovo-mcp-server/docs/supported-tools/#read)[write_confluence](/atlassian-rovo-mcp-server/docs/supported-tools/#write)[search_confluence](/atlassian-rovo-mcp-server/docs/supported-tools/#search)[Jira
Service Management
tools](/atlassian-rovo-mcp-server/docs/supported-tools/#Jira-Service-Management-tools)[read_jsm](/atlassian-rovo-mcp-server/docs/supported-tools/#read)[write_jsm](/atlassian-rovo-mcp-server/docs/supported-tools/#write)[Bitbucket
Cloud
tools](/atlassian-rovo-mcp-server/docs/supported-tools/#Bitbucket-Cloud-tools)[read_bitbucket](/atlassian-rovo-mcp-server/docs/supported-tools/#read)[write_bitbucket](/atlassian-rovo-mcp-server/docs/supported-tools/#write)[Atlassian
Platform](/atlassian-rovo-mcp-server/docs/supported-tools/#Atlassian-Platform)[read_teamwork_graph](/atlassian-rovo-mcp-server/docs/supported-tools/#read)[search_atlassian](/atlassian-rovo-mcp-server/docs/supported-tools/#search)[Compass
tools](/atlassian-rovo-mcp-server/docs/supported-tools/#Compass-tools)[read_compass](/atlassian-rovo-mcp-server/docs/supported-tools/#read)[write_compass](/atlassian-rovo-mcp-server/docs/supported-tools/#write)[Shared
platform
tools](/atlassian-rovo-mcp-server/docs/supported-tools/#Shared-platform-tools)[Disclaimer](/atlassian-rovo-mcp-server/docs/supported-tools/#Disclaimer)

Community[Questions, discussions, and
articles](https://community.atlassian.com/t5/Products/ct-p/products)


---

## Tables pandoc dropped from the page body (extracted from raw HTML of the same page)

### write_bitbucket (Available using: API token authentication)

| Tool | Actions | Description | Required scopes |
|---|---|---|---|
| `bitbucketPullRequest` | `create`, `merge`, `approve`, `comment` | Create and update pull requests. | `write:pullrequest:bitbucket` |
| `bitbucketRepoContent` | `branch.create`, `commit.create` | Create or update repository content. | `write:repository:bitbucket` |
| `bitbucketPipeline` | `run` | Run or manage pipelines. | `write:pipeline:bitbucket` |
| `bitbucketEnvironment` | `create`, `delete`, `update` | Manage deployment environments. | `admin:pipeline:bitbucket` |

### read_teamwork_graph (Available using: OAuth 2.1 and API token authentication)

| Tool | Description | Required scopes |
|---|---|---|
| `getTeamworkGraphContext` (beta) | Retrieves connected context from Teamwork Graph for any Atlassian entity. Returns all relationships and linked objects in one traversal, including cross-product and third-party connections. Entry points: Jira issues/projects/sprints/versions/comments; Confluence pages/blogposts/whiteboards/databases/spaces; Goals/Projects/Focus Areas/Tags; People (users, teams, orgs); DevOps (PRs, repos, deployments, services, builds, designs); Loom videos/meetings; Compass components; incidents, conversations, calendar events, external documents. | `read:jira-work`, `read:page:confluence`, `read:comment:confluence`, `read:space:confluence`, `read:account`, `read:3p-data:mcp`, `read:home:mcp`, `read:whiteboard:confluence`, `read:confluence:mcp`, `read:focus:mcp`, `read:loom:mcp`, `read:talent:mcp` |
| `getTeamworkGraphObject` (beta) | Fetches all available data for one or more objects (Atlassian or third-party) using their ARIs or URLs. | same scope list as above |
| `addTeamworkGraphContext` | Adds a relationship between two objects in the Teamwork Graph. | `write:all:twg` |
