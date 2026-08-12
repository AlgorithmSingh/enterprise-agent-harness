<!-- Source: https://developer.atlassian.com/cloud/rovo-mcp/preview/tools/ -->
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

# Atlassian Rovo MCP Preview tools

This page lists the tools available on the Atlassian Rovo MCP Preview
endpoint (`https://mcp.atlassian.com/v1/mcp/preview`).

The server exposes two kinds of tools:

- **Pre-declared (primary) tools** - a curated set of tools advertised
  directly in the MCP `tools/list` response. These cover the most common
  cross-product operations and are always visible to MCP clients.
- **Discovery operations** - a larger catalog of fine-grained operations
  that are found at runtime through the `discover` tool and invoked with
  the `execute` tool. Use `discover` to find an operation by describing
  what you want to do, then call `execute` with the operation name.

# Tool availability is dynamic

The exact set of discovery operations searchable in a given session
depends on your authentication, OAuth scopes, configured toolsets, and
product access.

## Pre-declared (primary) tools

These tools are exposed directly and require no discovery step.

### Authorization and metadata

| Tool | Description |
|----|----|
| `getAccessibleAtlassianResources` | Returns the cloud ID(s) available to the current user. |
| `atlassianUserInfo` | Returns the account ID of the current user. |
| `getToolDescription` | Get the authoring-guidance prompt for a topic. |

### Confluence

# Whiteboard and database model quality

For whiteboards, Sonnet 4.6 is recommended. GPT 5.5 is compatible, but
other models have not been tested for quality.

For databases, Sonnet 4.6 and Opus 4.6 are recommended.

| Tool | Description |
|----|----|
| `getConfluenceContent` | Read any Confluence content (page, blog, live doc, comment, whiteboard, embed, database, folder). |
| `createConfluenceContent` | Create a new Confluence page, blog post, live doc, whiteboard, database, embed, smart link, or folder. |
| `updateConfluenceContent` | Update Confluence docs, whiteboards, or databases. |
| `searchConfluence` | Search Confluence content with CQL. |

### Jira

| Tool | Description |
|----|----|
| `getJiraIssue` | Get a Jira issue by key or ID. |
| `searchJiraIssuesUsingJql` | Search for Jira issues using JQL with optional count. |
| `createJiraIssue` | Create a new Jira issue. |
| `editJiraIssue` | Edit an existing Jira issue. |
| `transitionJiraIssue` | Transition a Jira issue to a new status. |

### Loom

| Tool | Description |
|----|----|
| `getLoomVideo` | Get a Loom video's metadata, and optionally its transcript, comments, AI-generated briefs, or meeting action items. |

### Discovery and execution

| Tool | Description |
|----|----|
| `discover` | Find available Atlassian operations by describing what you want to do. |
| `execute` | Run an Atlassian operation by name. |

### Teamwork Graph

| Tool | Description |
|----|----|
| `getTeamworkGraphContext` | Retrieve connected context from Teamwork Graph for any Atlassian entity. |
| `getTeamworkGraphObject` | Fetch the entire available data for one or more objects (Atlassian or third-party) using their ARIs or URLs. |
| `addTeamworkGraphContext` | Add a relationship between two entities in the Teamwork Graph. |

## Discovery operations

The following operations are available through the `discover` and
`execute` tools and are not exposed directly via pre-registered tools.

### Confluence

#### Attachments

| Operation | Description |
|----|----|
| `createConfluenceAttachment` | Prepare a Confluence attachment upload and return a local curl command. |
| `downloadConfluenceAttachment` | Get a Confluence attachment download URL and return a local curl command. |
| `getConfluenceAttachment` | Get Confluence attachment metadata by attachment ID. |
| `listConfluenceAttachments` | List attachment metadata for a Confluence content item. |

#### Comments

| Operation | Description |
|----|----|
| `createConfluenceComment` | Create or reply to a comment on a Confluence page or blog post. |
| `getConfluenceComment` | Get a single Confluence comment by ID. |
| `listConfluenceComments` | List comments on a Confluence page or blog post. |
| `updateConfluenceComment` | Update an existing Confluence footer or inline comment on a page or blog post. |
| `updateConfluenceCommentResolution` | Resolve or reopen a Confluence footer or inline comment. |

#### Content

| Operation | Description |
|----|----|
| `archiveConfluenceContent` | Archive a single Confluence content entity. |
| `copyConfluenceContent` | Copy a Confluence page, whiteboard, database, folder, or embed to a new parent. |
| `createConfluenceFolder` | Create a folder in a Confluence space. |
| `exportConfluenceContent` | Export Confluence content as PDF or Word and return a download link. |
| `getConfluenceTemplate` | Get a Confluence template body. |
| `listConfluenceContent` | List Confluence content of one type within a single space (page, blog, live doc, whiteboard, database, embed, smart link, folder, slide). |
| `listConfluenceTemplates` | List Confluence templates and blueprints. |
| `moveConfluenceContent` | Move a Confluence page, whiteboard, database, folder, or embed to a new parent or sibling position. |
| `setConfluenceContentStatus` | Set the content state (status) of a Confluence page or blog post. |
| `unarchiveConfluenceContent` | Unarchive (restore) a single Confluence content entity. |

#### Labels

| Operation | Description |
|----|----|
| `addLabelsToConfluenceContent` | Add labels to any Confluence content (page, blogpost, attachment, custom content). |

#### Public Link

| Operation | Description |
|----|----|
| `disableConfluencePublicLink` | Disable the external public link (anonymous share) for a Confluence page. |
| `enableConfluencePublicLink` | Enable the external public link (anonymous share) for a Confluence page. |
| `getConfluencePublicLinkStatus` | Get the external public-link (anonymous share) status of a Confluence page. |

#### Reactions

| Operation                | Description                                |
|--------------------------|--------------------------------------------|
| `addConfluenceReaction`  | Add emoji reaction to Confluence content.  |
| `getConfluenceReactions` | Get emoji reactions on Confluence content. |

#### Space

| Operation | Description |
|----|----|
| `createConfluenceSpace` | Create a Confluence space. |
| `getConfluencePersonalSpace` | Get the current user's Confluence personal space. |
| `listConfluenceSpaces` | List Confluence spaces accessible to the caller. |

### Jira

#### Issues

| Operation | Description |
|----|----|
| `addOrEditJiraIssueComment` | Add a comment to a Jira issue, or edit an existing comment. |
| `addOrEditJiraIssueWorklog` | Log time on a Jira issue, or edit an existing worklog. |
| `createIssueLink` | Create a link between two Jira issues. |
| `downloadJiraIssueAttachment` | Get a short-lived download URL for a Jira attachment and return a local download command. |
| `getIssueLinkTypes` | Get available issue link types in Jira. |
| `getIssueWorklog` | List worklogs for a Jira issue to read entries and discover worklog IDs for edits or deletes. |
| `getJiraIssueRemoteIssueLinks` | Get remote links associated with a Jira issue. |
| `getTransitionsForJiraIssue` | Get available workflow transitions for a Jira issue. |
| `uploadAttachmentToJiraIssue` | Attach a single local file to a Jira issue. |

#### Projects

| Operation | Description |
|----|----|
| `getJiraIssueTypeMetaWithFields` | Get metadata for a specific Jira issue type including available fields. |
| `getJiraProjectIssueTypesMetadata` | Get all issue types and their metadata for a Jira project. |
| `getJiraProjectVersions` | Get the releases/versions for a Jira project. |
| `getVisibleJiraProjects` | Get Jira projects visible to the current user. |
| `manageJiraProjectVersion` | Get, create, update, release, or archive a Jira project version (release). |

#### Users

| Operation | Description |
|----|----|
| `findAssignableUsers` | Find users assignable to a Jira project or issue. |
| `lookupJiraAccountId` | Look up a Jira user account ID by display name or email. |

### Loom

# Loom requires OAuth 2.1

Loom tools are only available when authenticating via OAuth 2.1. They
are not available with API token authentication.

#### Videos

| Operation | Description |
|----|----|
| `getLoomVideoComments` | List the comments on a Loom video. |
| `createLoomVideoComment` | Post a comment on a Loom video at a specific timestamp. |
| `createLoomVideoReaction` | Add an emoji reaction to a Loom video at a specific timestamp. |
| `getLoomVideoDownloadUrl` | Get a time-limited signed URL to download a Loom video's MP4 file. |
| `listLoomVideos` | List the Loom videos owned by the current user. |
| `listLoomVideosSharedWithMe` | List the Loom videos shared with the current user. |
| `updateLoomVideoTitle` | Rename a Loom video. |
| `updateLoomVideoPermissions` | Update the visibility of a Loom video (owner, workspace, or public). |
| `recoverLoomVideo` | Recover a Loom video that failed to process. |
| `shareLoomVideo` | Share a Loom video with one or more Atlassian users. |
| `createLoomVideoUpload` | Start uploading a new video to Loom (step 1 of 2). |
| `publishLoomVideo` | Finalize and publish an uploaded Loom video (step 2 of 2). |

#### Meetings

| Operation | Description |
|----|----|
| `getLoomMeetingActionItems` | Get the AI-generated meeting action items for a Loom video. |

#### Folders

| Operation               | Description                                     |
|-------------------------|-------------------------------------------------|
| `listLoomFolders`       | List the folders in the current Loom workspace. |
| `createLoomFolder`      | Create a folder in the current Loom workspace.  |
| `moveLoomVideoToFolder` | Move a Loom video into a folder.                |

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
