# MCP Architecture — AI Social Media OS

**Version:** 1.0.0  
**Last Updated:** 2026-07-22  
**Status:** Draft — Internal Review

---

## Table of Contents

1. [What is MCP and Why It Fits This Platform](#1-what-is-mcp-and-why-it-fits-this-platform)
2. [MCP Gateway Service Architecture](#2-mcp-gateway-service-architecture)
3. [MCP Server Registry](#3-mcp-server-registry)
4. [Built-in MCP Servers](#4-built-in-mcp-servers)
5. [Custom MCP Server Protocol](#5-custom-mcp-server-protocol)
6. [MCP Marketplace Design](#6-mcp-marketplace-design)
7. [Security Model](#7-security-model)
8. [MCP Tool Definition Format](#8-mcp-tool-definition-format)
9. [MCP Resource Definition Format](#9-mcp-resource-definition-format)
10. [Integration Points](#10-integration-points)
11. [Example: Blog-to-Social Pipeline](#11-example-blog-to-social-pipeline)

---

## 1. What is MCP and Why It Fits This Platform

### 1.1 Definition

The **Model Context Protocol (MCP)** is an open standard that enables AI agents to interact with external tools, data sources, and services through a unified, typed interface. It defines how an AI host (client) connects to an MCP server, discovers its capabilities (tools, resources, prompts), and invokes them with structured JSON arguments.

### 1.2 Why MCP for a Social Media OS

A social media operating system is inherently an **integration platform**. It must:

- Read data from many sources (Google Drive, Notion, Airtable, Dropbox)
- Write to many destinations (social platforms, CRMs, databases)
- Orchestrate workflows across disconnected SaaS tools
- Allow users to extend functionality without modifying core code

MCP provides a **standardized plugin architecture** for exactly this:

```
┌─────────────────────────────────────────────────────────────┐
│                   AI Social Media OS                         │
│                                                             │
│  ┌─────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │ AI       │   │ Workflow     │   │ Content Pipeline     │  │
│  │ Agents   │──▶│ Engine       │──▶│ (repurpose, publish) │  │
│  └────┬────┘   └──────┬───────┘   └──────────┬───────────┘  │
│       │               │                       │             │
│       └───────────────┼───────────────────────┘             │
│                       │                                     │
│              ┌────────▼────────┐                             │
│              │ MCP Gateway     │                             │
│              │ (Service Layer) │                             │
│              └────────┬────────┘                             │
│                       │                                     │
│        ┌──────────────┼──────────────┐                      │
│        ▼              ▼              ▼                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │MCP Server│  │MCP Server│  │MCP Server│  ...              │
│  │ (Google  │  │ (Notion) │  │ (Custom) │                  │
│  │  Drive)  │  │          │  │          │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Design Goals

| Goal | How MCP Achieves It |
|---|---|
| Extensibility | Anyone can write an MCP server — no fork, no PR to core repo |
| Type Safety | Tools have JSON Schema inputs — validated before execution |
| Discoverability | Servers advertise their capabilities via `listTools`, `listResources`, `listPrompts` |
| Security | Servers run in sandboxed processes with explicit permission scopes |
| Composability | Multiple MCP servers can be chained in a single workflow |
| Language Agnostic | MCP servers can be written in any language (Python, Node, Go, Rust) |

---

## 2. MCP Gateway Service Architecture

### 2.1 High-Level Architecture

```
                          ┌──────────────────┐
                          │   Configuration   │
                          │     Store         │
                          │  (PostgreSQL)     │
                          └────────┬─────────┘
                                   │
┌─────┐    HTTP/WS     ┌──────────▼──────────┐    MCP Protocol    ┌────────────┐
│Client│◄─────────────►│   MCP Gateway        │◄─────────────────►│ MCP Server │
│(Web) │               │   Service            │                   │ (Process)  │
└─────┘               │                      │                   └────────────┘
                      │  ┌────────────────┐  │
┌─────┐               │  │ Connection Pool │  │                   ┌────────────┐
│AI   │◄──────────────┤  │   (Redis)       │  │◄─────────────────►│ MCP Server │
│Agent│  Internal RPC │  └────────────────┘  │                   │ (Process)  │
└─────┘               │                      │                   └────────────┘
                      │  ┌────────────────┐  │
┌────────┐            │  │  Rate Limiter   │  │                   ┌────────────┐
│Workflow│◄───────────┤  │  Circuit Breaker│  │◄─────────────────►│ MCP Server │
│Engine  │            │  └────────────────┘  │                   │ (Remote)   │
└────────┘            │                      │                   └────────────┘
                      │  ┌────────────────┐  │
┌─────────┐           │  │  Audit Logger   │  │
│Analytics│◄──────────┤  │   (Postgres)    │  │
└─────────┘           │  └────────────────┘  │
                      └──────────────────────┘
```

### 2.2 Core Components

#### Gateway Service

The central orchestrator that:

- Accepts incoming MCP calls from internal consumers (AI agents, workflow engine, API)
- Routes calls to the appropriate MCP server
- Manages server lifecycle (connect, health check, reconnect, disconnect)
- Enforces rate limits, permissions, and timeouts
- Logs every call to the audit trail
- Caches server capabilities for fast discovery

#### Connection Pool

Manages persistent connections to MCP servers:

| Connection Type | Protocol | Use Case |
|---|---|---|
| `sse` | Server-Sent Events | Remote servers (cloud-hosted) |
| `streamable-http` | HTTP POST | Remote servers, request-response |
| `stdio` | STDIN/STDOUT | Local servers (same machine) |
| `websocket` | WS | Bidirectional real-time servers |

Pool configuration per server:

```json
{
  "maxConnections": 5,
  "idleTimeoutMs": 300000,
  "heartbeatIntervalMs": 30000,
  "reconnectDelayMs": 1000,
  "maxReconnectAttempts": 5
}
```

#### Capability Cache

MCP servers are polled on connect for their capabilities (`listTools`, `listResources`, `listPrompts`). Results are cached in Redis with a TTL of 5 minutes. Cache is invalidated when a server reconnects or on explicit refresh.

#### Rate Limiter

Token-bucket rate limiter per MCP server, per consumer (workspace-level):

| Tier | Calls/Minute |
|---|---|
| Free | 50 |
| Pro | 500 |
| Business | 2000 |
| Enterprise | 10000 |

#### Circuit Breaker

Each MCP server connection has a circuit breaker with three states:

| State | Behavior |
|---|---|
| `CLOSED` | Normal operation |
| `OPEN` | Failing continuously — reject calls immediately |
| `HALF_OPEN` | Allow one probe call after timeout |

Thresholds: 5 consecutive failures within 60 seconds → circuit opens. After 30 seconds, transitions to `HALF_OPEN`.

#### Audit Logger

Every MCP call is logged:

```json
{
  "id": "mcp_log_abc123",
  "timestamp": "2026-07-22T12:00:00Z",
  "workspaceId": "ws_5a7b3c",
  "serverId": "mcp_xyz789",
  "consumer": "ai_agent:content_agent",
  "tool": "get_drive_file",
  "arguments": { "fileId": "..." },
  "resultSize": 2048,
  "durationMs": 1234,
  "status": "success",
  "costCredits": 0
}
```

### 2.3 Request Flow

```
1. Consumer sends MCP call request to Gateway
   │
2. Gateway validates:
   │  ├─ Server exists and is enabled for workspace
   │  ├─ Consumer has permission for the tool
   │  ├─ Rate limit not exceeded
   │  └─ Circuit breaker is CLOSED
   │
3. Gateway serializes the request to MCP JSON-RPC format
   │
4. Gateway dispatches to the server via its transport protocol
   │
5. Server processes and returns result
   │
6. Gateway:
   │  ├─ Validates result against tool's output schema
   │  ├─ Logs to audit trail
   │  ├─ Updates metrics (latency, success/failure)
   │  └─ Returns result to consumer
   │
7. If failure:
   │  ├─ Circuit breaker records failure
   │  ├─ Retry logic (if enabled)
   │  └─ Error returned to consumer
```

### 2.4 Timeout Configuration

| Context | Timeout |
|---|---|
| Tool call (fast) | 30 seconds |
| Tool call (slow) | 5 minutes |
| Resource read | 10 seconds |
| Server connect | 15 seconds |
| Server health check | 5 seconds |

---

## 3. MCP Server Registry

### 3.1 Registry Data Model

Stored in PostgreSQL:

```sql
CREATE TABLE mcp_servers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  type          VARCHAR(50) NOT NULL CHECK (type IN ('builtin', 'custom', 'marketplace')),
  source        VARCHAR(255), -- marketplace package name or custom URL
  transport     JSONB NOT NULL, -- { type, url, config }
  auth_config   JSONB, -- encrypted credential config
  capabilities  JSONB, -- { tools: [], resources: [], prompts: [] }
  status        VARCHAR(50) NOT NULL DEFAULT 'disconnected'
                CHECK (status IN ('connected', 'disconnected', 'error', 'connecting')),
  health        JSONB, -- { status, latencyMs, lastCheckAt }
  settings      JSONB DEFAULT '{}',
  enabled       BOOLEAN DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_servers_workspace ON mcp_servers(workspace_id);
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);

CREATE TABLE mcp_server_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  scope         VARCHAR(100) NOT NULL, -- e.g., "drive:read", "notion:write"
  granted       BOOLEAN NOT NULL DEFAULT false,
  granted_at    TIMESTAMPTZ,
  granted_by    UUID REFERENCES users(id)
);

CREATE TABLE mcp_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  server_id     UUID NOT NULL REFERENCES mcp_servers(id),
  consumer_type VARCHAR(50) NOT NULL, -- 'ai_agent', 'workflow', 'api'
  consumer_id   VARCHAR(255),
  tool          VARCHAR(255),
  arguments     JSONB,
  result_size   INTEGER,
  duration_ms   INTEGER,
  status        VARCHAR(50) NOT NULL, -- 'success', 'error', 'timeout'
  error_message TEXT,
  cost_credits  NUMERIC(10, 4) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_audit_workspace ON mcp_audit_log(workspace_id);
CREATE INDEX idx_mcp_audit_server ON mcp_audit_log(server_id);
CREATE INDEX idx_mcp_audit_created ON mcp_audit_log(created_at);
```

### 3.2 Registry API

Internal service (not exposed directly, accessed via MCP Gateway):

| Method | Description |
|---|---|
| `register(workspaceId, config)` | Register a new MCP server |
| `unregister(serverId)` | Remove server and disconnect |
| `get(serverId)` | Get server details with health |
| `list(workspaceId, filters)` | List servers with status filter |
| `update(serverId, config)` | Update server settings |
| `refreshCapabilities(serverId)` | Re-fetch capabilities from server |
| `getPermissions(serverId)` | Get permission scopes |
| `setPermission(serverId, scope, granted)` | Toggle a permission |
| `getUsage(serverId, period)` | Get usage metrics |

### 3.3 Server Lifecycle

```
                 register
                    │
                    ▼
             ┌──────────────┐
             │  REGISTERED   │
             └──────┬───────┘
                    │
               connect()
                    │
                    ▼
             ┌──────────────┐
    ┌────────│  CONNECTING   │────────┐
    │        └──────┬───────┘        │
    │               │ success        │ error
    │               ▼                │
    │        ┌──────────────┐        │
    │        │  CONNECTED    │        │
    │        └──────┬───────┘        │
    │               │                │
    │        health_check()          │
    │          (every 30s)           │
    │               │                │
    │         ┌─────┴─────┐          │
    │         ▼           ▼          ▼
    │   ┌──────────┐ ┌──────────┐ ┌──────────┐
    │   │ HEALTHY  │ │DEGRADED  │ │  ERROR   │
    │   └────┬─────┘ └────┬─────┘ └────┬─────┘
    │        │            │            │
    │        └────────────┴────────────┘
    │                     │
    │               reconnect()
    │                     │
    └─────────────────────┘
                                     disconnect()
                                          │
                                          ▼
                                   ┌──────────┐
                                   │DISCONNECTED│
                                   └──────────┘
```

---

## 4. Built-in MCP Servers

### 4.1 Server Catalog

Each built-in server ships with the platform and can be activated per workspace with a single click. Authentication is handled via OAuth or API key stored in the platform's credential vault.

#### OpenAI MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_openai` |
| Auth | OpenAI API key (user-provided) |
| Transport | `streamable-http` (internal) |

**Tools:**
```
- chat_completion(model, messages, temperature, max_tokens) → { content, usage }
- image_generation(prompt, size, quality, style) → { url, revised_prompt }
- embedding(input, model) → { embedding, usage }
- moderation(input) → { flagged, categories, scores }
- transcription(audio_data, language) → { text, segments }
- text_to_speech(text, voice, speed) → { audio_data }
- structured_output(prompt, json_schema) → { parsed_output }
```

**Resources:**
```
- openai://models → list of available models
- openai://models/{id} → model details
```

#### Claude (Anthropic) MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_claude` |
| Auth | Anthropic API key |
| Transport | `streamable-http` (internal) |

**Tools:**
```
- chat_completion(model, messages, max_tokens, system_prompt) → { content, usage }
- extended_thinking(prompt, thinking_budget) → { thinking, answer }
- content_generation(prompt, tone, length, format) → { text }
- content_analysis(content, analysis_type) → { scores, insights }
- document_analysis(document, questions) → { answers, citations }
```

**Resources:**
```
- claude://models → available Claude models
- claude://usage → current usage stats
```

#### Gemini MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_gemini` |
| Auth | Google AI API key |
| Transport | `streamable-http` (internal) |

**Tools:**
```
- chat_completion(model, messages, config) → { content, usage }
- multimodal_analysis(image_data, prompt) → { analysis }
- video_analysis(video_data, prompt) → { analysis }
- grounding_search(query) → { grounded_response, sources }
```

**Resources:**
```
- gemini://models → available models
- gemini://safety_settings → current safety configuration
```

#### GitHub MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_github` |
| Auth | GitHub OAuth (user token) |
| Transport | `sse` (internal) |

**Tools:**
```
- list_repositories(owner, type, sort) → [{ repo }]
- get_file_content(owner, repo, path, ref) → { content, encoding }
- create_issue(owner, repo, title, body, labels, assignees) → { issue }
- create_pull_request(owner, repo, title, body, head, base) → { pr }
- get_issue(owner, repo, issue_number) → { issue }
- search_code(query, language, repo) → [{ file }]
- get_repository_content(owner, repo, path) → [{ file_tree }]
- list_releases(owner, repo) → [{ release }]
- get_latest_release(owner, repo) → { release }
- create_comment(owner, repo, issue_number, body) → { comment }
```

**Resources:**
```
- github://repositories/{owner}/{repo} → repository details
- github://issues/{owner}/{repo}/{number} → issue details
- github://user → authenticated user info
```

#### Notion MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_notion` |
| Auth | Notion OAuth (Internal Integration) |
| Transport | `sse` (internal) |

**Tools:**
```
- list_databases() → [{ database }]
- query_database(database_id, filter, sorts, page_size) → [{ page }]
- get_page(page_id) → { page_content }
- create_page(database_id, properties, content) → { page }
- update_page(page_id, properties, content) → { page }
- append_block(page_id, blocks) → { blocks }
- search(query, filter) → [{ result }]
- get_comments(block_id) → [{ comment }]
- create_comment(block_id, rich_text) → { comment }
```

**Resources:**
```
- notion://databases → list all accessible databases
- notion://pages/{page_id} → page content
- notion://users → workspace users
```

#### Google Drive MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_googledrive` |
| Auth | Google OAuth (drive.readonly or drive.file) |
| Transport | `sse` (internal) |

**Tools:**
```
- list_files(query, page_size, order_by) → [{ file }]
- get_file(file_id) → { file, content }
- upload_file(name, parent_id, content, mime_type) → { file }
- create_document(title, parent_id, content) → { file }
- search_files(query, mime_type) → [{ file }]
- download_file(file_id, format) → { content }
- get_file_metadata(file_id) → { metadata }
- list_comments(file_id) → [{ comment }]
```

**Resources:**
```
- gdrive://files/{file_id} → file content
- gdrive://shared_drives → shared drives list
- gdrive://recent → recently accessed files
```

#### Slack MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_slack` |
| Auth | Slack OAuth Bot Token |
| Transport | `sse` (internal) |

**Tools:**
```
- post_message(channel, text, blocks, thread_ts) → { ts, channel }
- send_file(channel, file, title, initial_comment) → { file }
- list_channels(types, limit, cursor) → [{ channel }]
- get_channel_history(channel, limit) → [{ message }]
- get_thread_replies(channel, thread_ts) → [{ message }]
- search_messages(query, sort, count) → [{ message }]
- create_channel(name, is_private) → { channel }
- invite_user(channel, user_ids) → { channel }
- set_topic(channel, topic) → { channel }
- add_reaction(channel, timestamp, reaction) → { ok }
```

**Resources:**
```
- slack://channels → accessible channels
- slack://users → workspace users
- slack://conversations/{channel_id} → conversation history
```

#### Dropbox MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_dropbox` |
| Auth | Dropbox OAuth |
| Transport | `sse` (internal) |

**Tools:**
```
- list_folder(path, recursive, limit) → [{ entry }]
- get_file(path) → { content, metadata }
- upload_file(path, content, mode) → { metadata }
- search(query, file_status, max_results) → [{ match }]
- create_folder(path) → { metadata }
- delete(path) → { metadata }
- get_file_metadata(path) → { metadata }
- get_shared_link(path) → { url, expiry }
```

**Resources:**
```
- dropbox://files/{path} → file/folder listing
- dropbox://search/{query} → search results
```

#### HubSpot MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_hubspot` |
| Auth | HubSpot OAuth (private app) |
| Transport | `sse` (internal) |

**Tools:**
```
- list_contacts(limit, properties, sort) → [{ contact }]
- get_contact(contact_id) → { contact }
- create_contact(properties) → { contact }
- update_contact(contact_id, properties) → { contact }
- list_companies(limit, properties) → [{ company }]
- get_company(company_id) → { company }
- list_deals(limit, properties) → [{ deal }]
- create_deal(properties, associated_contacts) → { deal }
- search_contacts(query, limit) → [{ contact }]
- get_engagement_timeline(contact_id) → [{ engagement }]
- create_note(contact_id, body, owner_id) → { note }
- list_owners() → [{ owner }]
```

**Resources:**
```
- hubspot://contacts → recent contacts
- hubspot://companies → recent companies
- hubspot://deals → recent deals
- hubspot://pipelines → deal pipelines
```

#### Salesforce MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_salesforce` |
| Auth | Salesforce OAuth (connected app) |
| Transport | `sse` (internal) |

**Tools:**
```
- query(soql_query, limit) → { records, totalSize }
- get_object(object_type, record_id, fields) → { record }
- create_object(object_type, fields) → { id }
- update_object(object_type, record_id, fields) → { success }
- delete_object(object_type, record_id) → { success }
- search(sosl_query) → [{ record }]
- describe_object(object_type) → { fields, relationships }
- get_recent_items(limit) → [{ record }]
- get_user_info() → { user }
- create_task(subject, description, priority, status, related_to) → { task }
- create_event(subject, start_datetime, end_datetime, description) → { event }
```

**Resources:**
```
- salesforce://objects → available sObjects
- salesforce://objects/{type} → object schema
- salesforce://query/{soql} → query results
```

#### Google Calendar MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_googlecalendar` |
| Auth | Google OAuth (calendar scopes) |
| Transport | `sse` (internal) |

**Tools:**
```
- list_events(calendar_id, time_min, time_max, max_results) → [{ event }]
- create_event(calendar_id, summary, description, start, end, attendees) → { event }
- update_event(calendar_id, event_id, fields) → { event }
- delete_event(calendar_id, event_id) → { success }
- list_calendars() → [{ calendar }]
- find_free_busy(calendar_ids, time_min, time_max) → { calendars }
- add_attendee(calendar_id, event_id, email) → { event }
- set_reminder(calendar_id, event_id, minutes, method) → { event }
- get_event(calendar_id, event_id) → { event }
```

**Resources:**
```
- gcal://calendars → accessible calendars
- gcal://events/{calendar_id} → upcoming events
- gcal://freebusy/{calendar_id} → free/busy info
```

#### Airtable MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_airtable` |
| Auth | Airtable Personal Access Token |
| Transport | `sse` (internal) |

**Tools:**
```
- list_bases() → [{ base }]
- list_tables(base_id) → [{ table }]
- list_records(base_id, table_id, max_records, view, sort, filter) → [{ record }]
- get_record(base_id, table_id, record_id) → { record }
- create_record(base_id, table_id, fields) → { record }
- update_record(base_id, table_id, record_id, fields) → { record }
- delete_record(base_id, table_id, record_id) → { success }
- search_records(base_id, table_id, field, query) → [{ record }]
- get_table_schema(base_id, table_id) → { fields, views }
```

**Resources:**
```
- airtable://bases → user's bases
- airtable://tables/{base_id} → tables in a base
- airtable://records/{base_id}/{table_id} → records
```

#### Linear MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_linear` |
| Auth | Linear OAuth OR API key |
| Transport | `sse` (internal) |

**Tools:**
```
- list_issues(team_id, status, assignee, limit) → [{ issue }]
- get_issue(issue_id) → { issue }
- create_issue(team_id, title, description, assignee_id, priority) → { issue }
- update_issue(issue_id, title, description, status, assignee_id) → { issue }
- delete_issue(issue_id) → { success }
- list_teams() → [{ team }]
- list_projects(team_id) → [{ project }]
- create_comment(issue_id, body) → { comment }
- search_issues(query, limit) → [{ issue }]
- get_issue_attachments(issue_id) → [{ attachment }]
- add_attachment(issue_id, url, title) → { attachment }
- list_workflow_states(team_id) → [{ state }]
```

**Resources:**
```
- linear://teams → teams
- linear://issues/{team_id} → team issues
- linear://projects/{team_id} → team projects
- linear://users → workspace users
```

#### ClickUp MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_clickup` |
| Auth | ClickUp OAuth |
| Transport | `sse` (internal) |

**Tools:**
```
- list_spaces(team_id) → [{ space }]
- list_folders(space_id) → [{ folder }]
- list_lists(folder_id) → [{ list }]
- list_tasks(list_id, status, assignee, page) → [{ task }]
- get_task(task_id) → { task }
- create_task(list_id, name, description, status, assignees, priority) → { task }
- update_task(task_id, fields) → { task }
- delete_task(task_id) → { success }
- create_list(space_id, name, content) → { list }
- create_folder(space_id, name) → { folder }
- add_task_comment(task_id, comment_text) → { comment }
- get_task_comments(task_id) → [{ comment }]
- set_task_dependency(task_id, depends_on_task_id) → { task }
- get_team() → { team }
- get_views(list_id) → [{ view }]
```

**Resources:**
```
- clickup://teams → teams
- clickup://spaces/{team_id} → spaces
- clickup://tasks/{list_id} → tasks in a list
```

#### Jira MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_jira` |
| Auth | Jira OAuth OR Atlassian API token |
| Transport | `sse` (internal) |

**Tools:**
```
- list_projects() → [{ project }]
- get_project(project_key) → { project }
- search_issues(jql, max_results, fields) → [{ issue }]
- get_issue(issue_key, fields) → { issue }
- create_issue(project_key, summary, description, issuetype, priority) → { issue }
- update_issue(issue_key, fields) → { issue }
- delete_issue(issue_key) → { success }
- add_comment(issue_key, body) → { comment }
- transition_issue(issue_key, transition_id) → { issue }
- list_issue_types(project_key) → [{ issuetype }]
- list_transitions(issue_key) → [{ transition }]
- get_project_versions(project_key) → [{ version }]
- create_issue_link(inward_issue_key, outward_issue_key, link_type) → { link }
- get_issue_attachments(issue_key) → [{ attachment }]
- search_users(query, max_results) → [{ user }]
```

**Resources:**
```
- jira://projects → projects
- jira://issues/{project_key} → issues by project
- jira://issue/{issue_key} → single issue
- jira://users → project users
```

#### Discord MCP Server

| Property | Value |
|---|---|
| ID | `mcp_builtin_discord` |
| Auth | Discord Bot Token |
| Transport | `sse` (internal) |

**Tools:**
```
- send_message(channel_id, content, embeds, components) → { message }
- edit_message(channel_id, message_id, content, embeds) → { message }
- delete_message(channel_id, message_id) → { success }
- get_channel(channel_id) → { channel }
- list_channels(guild_id) → [{ channel }]
- get_guild(guild_id) → { guild }
- create_thread(channel_id, name, message_id, auto_archive_duration) → { thread }
- add_reaction(channel_id, message_id, emoji) → { success }
- get_message(channel_id, message_id) → { message }
- get_channel_messages(channel_id, limit, before, after) → [{ message }]
- search_guild_members(guild_id, query, limit) → [{ member }]
- create_webhook(channel_id, name) → { webhook }
- execute_webhook(webhook_id, webhook_token, content, embeds) → { message }
```

**Resources:**
```
- discord://guilds → user's guilds
- discord://channels/{guild_id} → guild channels
- discord://messages/{channel_id} → recent messages
```

### 4.2 Server Configuration Defaults

| Setting | Default | Description |
|---|---|---|
| Timeout | 30s | Max execution time per tool call |
| Max Retries | 2 | Number of automatic retries on failure |
| Cache TTL | 300s | How long to cache server capabilities |
| Enable Circuit Breaker | true | Automatically degrade on repeated failures |
| Log Level | `info` | `debug`, `info`, `warn`, `error` |
| Max Concurrency | 5 | Max simultaneous calls to a single server |

---

## 5. Custom MCP Server Protocol

### 5.1 Overview

Any developer can build and connect a custom MCP server to the platform. The server implements the standard MCP protocol and is registered via the API or dashboard.

### 5.2 Building an MCP Server

**Minimum requirements:**

1. Implement the MCP protocol (JSON-RPC 2.0 over transport of choice)
2. Host the server at a public HTTPS URL (for SSE/HTTP transport)
3. Implement at least `initialize`, `listTools`, and one tool
4. Return responses within the configured timeout

**Quick start (Node.js):**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new Server({
  name: 'my-custom-analytics-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

server.setRequestHandler('listTools', async () => ({
  tools: [{
    name: 'get_analytics',
    description: 'Get analytics data for a date range',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'ISO date start' },
        endDate: { type: 'string', description: 'ISO date end' },
        metrics: { type: 'array', items: { type: 'string' } },
      },
      required: ['startDate', 'endDate'],
    },
  }],
}));

server.setRequestHandler('callTool', async (request) => {
  if (request.params.name === 'get_analytics') {
    const { startDate, endDate, metrics } = request.params.arguments;
    const data = await fetchAnalytics(startDate, endDate, metrics);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Quick start (Python):**

```python
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
import mcp.types as types

server = Server("my-analytics-server")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="get_analytics",
            description="Get analytics data",
            inputSchema={
                "type": "object",
                "properties": {
                    "startDate": {"type": "string"},
                    "endDate": {"type": "string"},
                },
                "required": ["startDate", "endDate"],
            },
        )
    ]

@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent]:
    if name == "get_analytics":
        data = await fetch_analytics(arguments["startDate"], arguments["endDate"])
        return [types.TextContent(type="text", text=str(data))]
    raise ValueError(f"Unknown tool: {name}")
```

### 5.3 Transport Options

#### SSE (Server-Sent Events)

Standard for remote servers. The server exposes two endpoints:

```
GET  https://mcp.myanalytics.com/sse    → SSE stream (server → client)
POST https://mcp.myanalytics.com/message → Client → server messages
```

MCP SDKs handle this automatically. The platform connects via `sse` transport and sends JSON-RPC messages to the `/message` endpoint while receiving responses on the SSE stream.

#### Streamable HTTP

Simpler request-response model. Single endpoint:

```
POST https://mcp.myanalytics.com/mcp
```

The client sends a JSON-RPC request and receives a JSON-RPC response in the HTTP response body. No persistent connection required.

#### STDIO

For local-only servers. The platform spawns a subprocess and communicates via STDIN/STDOUT. This is used for development testing or on-premises deployments only.

### 5.4 Registration Process

```
1. Developer builds MCP server and deploys to hosting
2. Developer registers server via dashboard or API:
   POST /v1/mcp/servers { name, transport, auth, tools }
3. Platform validates connectivity:
   - Sends initialize request
   - Calls listTools and listResources
   - Validates response schema
4. Server appears in workspace with "Connected" status
5. Platform begins periodic health checks (every 30s)
6. Server is available to AI agents, workflows, and API calls
```

### 5.5 Credential Vault

Credentials for MCP servers are stored encrypted at rest using AES-256-GCM. The encryption key is managed by the platform's key management service (KMS). Credentials are decrypted in-memory only when dispatching a call to a server.

**Supported credential types:**

| Type | Storage |
|---|---|
| API Key | Encrypted string |
| OAuth 2.0 Token | Encrypted JSON (access_token, refresh_token, expiry) |
| Basic Auth | Encrypted base64 credentials |
| Bearer Token | Encrypted string |
| Custom Headers | Encrypted key-value store |

---

## 6. MCP Marketplace Design

### 6.1 Concept

The MCP Marketplace is a curated directory of community and partner-built MCP servers that users can discover, install, and manage with one click. Think of it as the "App Store" for the Social Media OS.

### 6.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   MCP Marketplace                              │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Server       │  │ Server       │  │ Server       │          │
│  │ Listing      │  │ Listing      │  │ Listing      │          │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤          │
│  │ Shopify      │  │ Mailchimp    │  │ WordPress    │          │
│  │ ★★★★☆ (42)  │  │ ★★★★☆ (28)  │  │ ★★★☆☆ (15)  │          │
│  │ Marketing    │  │ Marketing    │  │ CMS          │          │
│  │ v2.1.0       │  │ v1.4.0       │  │ v3.0.1       │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                 │
│         ▼                 ▼                 ▼                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              Package Registry (S3 + PostgreSQL)       │     │
│  │  { name, version, schema, manifest, checksum }       │     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Listing Schema

Each marketplace listing contains:

```json
{
  "id": "mcp_market_shopify",
  "name": "Shopify Integration",
  "description": "Connect your Shopify store to monitor products, orders, and customers. Automatically generate social posts for new products.",
  "publisher": {
    "name": "SMOS Partners",
    "verified": true,
    "website": "https://partners.smos.io"
  },
  "version": "2.1.0",
  "latestVersion": "2.1.0",
  "category": "ecommerce",
  "tags": ["shopify", "ecommerce", "products", "orders"],
  "capabilities": {
    "tools": 12,
    "resources": 4,
    "prompts": 2
  },
  "rating": 4.5,
  "totalReviews": 42,
  "totalInstalls": 1250,
  "pricing": {
    "model": "free",
    "trialDays": null
  },
  "permissions": ["shopify:read_products", "shopify:read_orders", "shopify:read_customers"],
  "updatedAt": "2026-07-20T10:00:00Z",
  "changelog": [
    { "version": "2.1.0", "date": "2026-07-20", "changes": ["Added order analytics tool"] }
  ]
}
```

### 6.4 Categories

| Category | Examples |
|---|---|
| `analytics` | Google Analytics, Mixpanel, Amplitude |
| `cms` | WordPress, Contentful, Strapi, Sanity |
| `ecommerce` | Shopify, WooCommerce, BigCommerce |
| `crm` | HubSpot, Salesforce, Pipedrive |
| `email` | Mailchimp, SendGrid, ConvertKit |
| `project_management` | Linear, Jira, ClickUp, Asana, Monday |
| `storage` | Google Drive, Dropbox, OneDrive, Box |
| `design` | Figma, Canva, Adobe Creative Cloud |
| `video` | Vimeo, Wistia, Loom |
| `ads` | Google Ads, Meta Ads, TikTok Ads |
| `customer_support` | Intercom, Zendesk, Freshdesk |
| `data` | Airtable, Notion, Coda |
| `ai` | Custom AI models, vector databases |

### 6.5 Review & Rating System

Users can leave reviews after installing a marketplace server:

```json
{
  "id": "review_abc123",
  "userId": "user_2f3a1b",
  "serverId": "mcp_market_shopify",
  "rating": 4,
  "title": "Great integration, needs more tools",
  "body": "Works perfectly for product syncing. Would love to see order management tools added.",
  "version": "2.0.0",
  "createdAt": "2026-07-15T14:00:00Z",
  "helpfulCount": 12
}
```

### 6.6 Versioning & Updates

| Aspect | Detail |
|---|---|
| SemVer | Marketplace servers follow strict semver |
| Breaking Changes | Major version bumps must be clearly communicated |
| Auto-update | Users can opt-in to automatic minor/patch updates |
| Changelog | Every version must include a changelog entry |
| Deprecation | Old versions are supported for 90 days after replacement |

When a new version is available:
1. Dashboard shows update badge
2. User reviews changelog
3. User clicks "Update" → platform re-registers the server with new capabilities
4. Old version is preserved for rollback (3 versions back)

### 6.7 Submission Process

```
1. Developer builds and tests MCP server locally
2. Developer packages server definition (manifest + transport config)
3. Developer submits to marketplace via developer portal:
   - Server manifest
   - Tool/resource schemas
   - Logo and screenshots
   - Pricing model
4. Automated validation:
   - Schema compliance check
   - Connectivity test
   - Security scan (credential handling, endpoint analysis)
5. Manual review (24-48h):
   - Capability verification
   - Documentation quality check
   - Security audit
6. Approved → published to marketplace
7. Rejected → developer receives detailed feedback
```

### 6.8 Monetization

| Model | Description | Platform Cut |
|---|---|---|
| Free | No charge | 0% |
| Freemium | Free tier + paid features | 15% |
| Paid | One-time purchase | 20% |
| Subscription | Monthly/yearly recurring | 20% |
| Usage-based | Per-call pricing | 10% |

---

## 7. Security Model

### 7.1 Sandboxing

| Transport | Sandbox Method |
|---|---|
| `sse` (remote) | N/A — server runs on developer infrastructure |
| `streamable-http` | N/A — server runs on developer infrastructure |
| `stdio` (local) | Process runs in isolated container with seccomp, no network access (unless configured) |

For marketplace servers hosted by the platform (managed hosting):

- Each server runs in its own Docker container
- CPU: limited to 0.5 cores
- Memory: limited to 512MB
- Network: restricted to outbound only, no inbound
- Filesystem: ephemeral (no persistent storage)
- Execution timeout: max 5 minutes per tool call

### 7.2 Permission Scopes

Each MCP server declares required permission scopes during registration. The workspace admin must explicitly grant each scope:

| Scope | Description | Risk Level |
|---|---|---|
| `drive:read` | Read files from Google Drive | Low |
| `drive:write` | Create, update, delete files | Medium |
| `notion:read` | Read Notion databases and pages | Low |
| `notion:write` | Create, update Notion content | Medium |
| `github:read` | Read repositories and issues | Low |
| `github:write` | Create issues, PRs, comments | Medium |
| `github:admin` | Admin repo operations | High |
| `slack:post` | Send messages to channels | Medium |
| `slack:read` | Read channel history | Low |
| `hubspot:read` | Read contacts and deals | High (PII) |
| `hubspot:write` | Modify CRM data | High |
| `salesforce:read` | Read Salesforce objects | High (PII) |
| `salesforce:write` | Modify Salesforce objects | Critical |

### 7.3 Credential Storage

```
┌──────────────────┐
│   Client Input    │
│   (API Key)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Encryption       │
│  AES-256-GCM      │
│  + Key Rotation   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  PostgreSQL       │
│  (encrypted col)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Decryption       │
│  (in-memory,      │
│   on call)        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MCP Server Call  │
└──────────────────┘
```

- Credentials are never logged or exposed in error messages
- Credentials are masked in the dashboard (e.g., `****...xyz`)
- Key rotation: automatic every 90 days, or manual on demand
- Credential access is audited

### 7.4 Audit Trail

Every MCP interaction is logged immutably:

| Field | Description |
|---|---|
| `id` | Unique event ID |
| `workspaceId` | Workspace that owns the server |
| `serverId` | Target MCP server |
| `consumerType` | `ai_agent`, `workflow`, `api` |
| `consumerId` | Specific agent name or workflow ID |
| `tool` | Called tool name |
| `arguments` | Full arguments (redacted for sensitive fields) |
| `status` | `success`, `error`, `timeout` |
| `durationMs` | Execution time |
| `errorMessage` | Error details (no credentials) |
| `ip` | Source IP (for API calls) |

Audit logs are retained for:
- Free: 30 days
- Pro: 90 days
- Business: 1 year
- Enterprise: 7 years

### 7.5 Deny List

Workspace admins can maintain a deny list of MCP servers or specific tools:

```json
{
  "deniedServers": ["mcp_abc123"],
  "deniedTools": {
    "mcp_def456": ["delete_records", "update_schema"]
  },
  "deniedResources": {
    "mcp_ghi789": ["drive://secrets/*"]
  }
}
```

---

## 8. MCP Tool Definition Format

### 8.1 Schema

Every MCP tool follows the JSON-RPC 2.0 specification with MCP extensions:

```json
{
  "name": "get_analytics",
  "description": "Retrieve analytics data for a specified date range and platform",
  "inputSchema": {
    "type": "object",
    "properties": {
      "startDate": {
        "type": "string",
        "format": "date",
        "description": "Start date in ISO 8601 format (YYYY-MM-DD)"
      },
      "endDate": {
        "type": "string",
        "format": "date",
        "description": "End date in ISO 8601 format (YYYY-MM-DD)"
      },
      "platform": {
        "type": "string",
        "enum": ["twitter", "instagram", "linkedin", "facebook"],
        "description": "Social platform to get analytics for"
      },
      "metrics": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["impressions", "engagements", "clicks", "reach"]
        },
        "description": "Metrics to include in the response"
      },
      "granularity": {
        "type": "string",
        "enum": ["day", "week", "month"],
        "default": "day",
        "description": "Data granularity"
      }
    },
    "required": ["startDate", "endDate", "platform"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "summary": {
        "type": "object",
        "properties": {
          "totalImpressions": { "type": "integer" },
          "totalEngagements": { "type": "integer" }
        }
      },
      "trends": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "date": { "type": "string" },
            "impressions": { "type": "integer" },
            "engagements": { "type": "integer" }
          }
        }
      }
    }
  }
}
```

### 8.2 Tool Categories

| Category | Description | Example Tool |
|---|---|---|
| `read` | Retrieve data without side effects | `get_file`, `list_records` |
| `write` | Create or modify data | `create_post`, `update_record` |
| `delete` | Remove data | `delete_file`, `remove_item` |
| `search` | Search across data | `search_files`, `query_database` |
| `action` | Execute an action | `send_message`, `approve_workflow` |
| `transform` | Process and return modified data | `resize_image`, `convert_format` |

### 8.3 Tool Execution Model

```
1. Input Validation
   - Arguments validated against inputSchema
   - Rejected immediately if schema violation

2. Permission Check
   - Consumer has permission for this tool?
   - Tool is not in deny list?

3. Rate Limit Check
   - Workspace within rate limit for this server?

4. Execution
   - Call dispatched to server
   - Server responds with content

5. Output Validation
   - Response validated against outputSchema (if defined)
   - Malformed response → error logged

6. Cost Accounting
   - Credits consumed logged
   - Usage metrics updated
```

---

## 9. MCP Resource Definition Format

### 9.1 Schema

MCP resources expose data that can be read by consumers. Resources follow a URI template pattern:

```json
{
  "uri": "drive://files/{fileId}",
  "name": "Google Drive File",
  "description": "Read the content of a Google Drive file by its ID",
  "mimeType": "text/plain",
  "template": true,
  "variables": {
    "fileId": {
      "type": "string",
      "description": "The Google Drive file ID"
    }
  }
}
```

### 9.2 Resource Types

| Type | URI Pattern | Description |
|---|---|---|
| `list` | `drive://files` | List all files |
| `single` | `drive://files/{id}` | Single file content |
| `search` | `drive://search/{query}` | Search results |
| `tree` | `drive://folders/{id}` | Folder tree structure |
| `static` | `drive://info` | Static metadata |

### 9.3 Resource Templates

For parameterized resources, MCP defines URI templates:

```
Template:          notion://databases/{databaseId}/pages
Filled URI:        notion://databases/abc123/pages
```

Resources are fetched via `readResource` or `subscribeResource` (for real-time updates).

### 9.4 Resource Subscription

Consumers can subscribe to resource changes:

```json
{
  "method": "subscribe",
  "params": {
    "uri": "drive://files/recent"
  }
}
```

When the resource changes, the server sends a `notifications/resources/list_changed` notification.

---

## 10. Integration Points

### 10.1 How MCP Connects to AI Agents

AI agents use MCP tools as part of their reasoning loop:

```
┌────────────────────────────────────────────────────────────┐
│                      Content Agent                           │
│                                                              │
│  User prompt: "Create a post about our new feature"          │
│                                                              │
│  Agent reasoning:                                            │
│  1. "I need context from Notion about the feature"           │
│     → call mcp.notion.query_database("Product Updates")      │
│                                                              │
│  2. "I need images from Google Drive"                        │
│     → call mcp.googledrive.search_files("feature launch")     │
│                                                              │
│  3. "I'll generate the post content"                         │
│     → call mcp.openai.chat_completion(...)                   │
│                                                              │
│  4. "Let me check brand voice guidelines"                    │
│     → call mcp.hubspot.get_brand_guidelines()                │
│                                                              │
│  5. "Now I'll save the draft"                                │
│     → internal API: createPost()                             │
│                                                              │
│  Result: Draft post created with context from Notion,        │
│          images from Drive, generated by OpenAI,              │
│          consistent with brand voice from HubSpot             │
└────────────────────────────────────────────────────────────┘
```

### 10.2 How MCP Connects to Workflows

Workflow steps can directly invoke MCP tools:

```json
{
  "id": "step_2",
  "type": "mcp_call",
  "config": {
    "serverId": "mcp_googledrive",
    "tool": "get_file",
    "arguments": {
      "fileId": "{{trigger.data.fileId}}"
    },
    "resultVariable": "drive_file"
  },
  "next": "step_3"
}
```

The workflow engine:
1. Resolves `{{trigger.data.fileId}}` from previous step output
2. Calls the MCP gateway with the resolved arguments
3. Stores the result in `steps.step_2.drive_file`
4. Makes it available for subsequent steps

### 10.3 How MCP Connects to the Content Pipeline

```
    Blog Post           MCP Servers              Social Posts
        │                     │                        │
        ▼                     ▼                        ▼
┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  WordPress   │───▶│  MCP: WordPress  │───▶│  Repurpose &     │
│  (published) │    │  (read content)  │    │  Create Drafts   │
└─────────────┘    └──────────────────┘    └──────────────────┘
                             │                        │
                    ┌───────┴───────┐         ┌───────┴───────┐
                    ▼               ▼         ▼               ▼
            ┌────────────┐  ┌────────────┐  ┌───────────┐  ┌───────────┐
            │ MCP: OpenAI │  │ MCP: Drive  │  │ Twitter   │  │ LinkedIn  │
            │ (generate)  │  │ (get images)│  │ Post      │  │ Post      │
            └────────────┘  └────────────┘  └───────────┘  └───────────┘
```

### 10.4 MCP as a Workflow Trigger

MCP resource subscriptions can trigger workflows:

```json
{
  "trigger": {
    "type": "mcp_resource",
    "config": {
      "serverId": "mcp_wordpress",
      "resource": "wordpress://posts/recent",
      "condition": "new_post_published"
    }
  }
}
```

When the resource changes (new blog post published), the workflow is triggered automatically.

---

## 11. Example: Blog-to-Social Pipeline

### 11.1 Scenario

A blog post is published on WordPress. The platform automatically:
1. Reads the blog post content
2. Analyzes it for key themes and keywords
3. Generates platform-specific social posts
4. Finds or generates relevant images
5. Creates drafts in the content library
6. Notifies the team in Slack

### 11.2 MCP Servers Involved

| Server | Role |
|---|---|
| WordPress (MCP) | Detect new post, read content |
| Claude/OpenAI (MCP) | Analyze, repurpose, generate |
| Google Drive (MCP) | Find featured images |
| Notion (MCP) | Store content calendar entry |
| Slack (MCP) | Notify team |

### 11.3 Pipeline Execution

```
Step 1: WordPress MCP → Detect new post
────────────────────────────────────────
Server: wordpress (built-in custom)
Tool:   list_recent_posts
Input:  { since: last_check_timestamp }
Output: { posts: [{ id: 123, title: "10 AI Trends", content: "...", date: "..." }] }

Step 2: AI MCP → Analyze content
─────────────────────────────────
Server: claude (built-in)
Tool:   content_analysis
Input:  { content: "10 AI Trends...", analysis_type: "keywords" }
Output: { keywords: ["AI", "machine learning", "automation"], topics: ["technology"] }

Step 3: AI MCP → Generate social posts
───────────────────────────────────────
Server: openai (built-in)
Tool:   chat_completion
Input:  { 
  model: "gpt-4o",
  messages: [{
    role: "system",
    content: "You repurpose blog posts for social media. Twitter: max 280 chars. LinkedIn: professional tone. Instagram: engaging with emojis."
  }, {
    role: "user",
    content: "Repurpose this blog for Twitter, LinkedIn, Instagram: 10 AI Trends..."
  }],
  temperature: 0.7
}
Output: {
  content: "Twitter: 10 AI trends reshaping 2026...\nLinkedIn: As AI continues to evolve...",
  usage: { prompt_tokens: 450, completion_tokens: 180 }
}

Step 4: Google Drive MCP → Find images
───────────────────────────────────────
Server: googledrive (built-in)
Tool:   search_files
Input:  { query: "AI technology featured", mime_type: "image/png" }
Output: { files: [{ id: "img_abc", name: "ai-tech.png", url: "..." }] }

Step 5: Create drafts in content library
─────────────────────────────────────────
Action: Internal API call
Tool:   createPost (platform API)
Input:  { 
  title: "10 AI Trends - Social Posts",
  content: { text: "Generated content..." },
  platforms: [
    { platform: "twitter", contentOverride: { text: "..." } },
    { platform: "linkedin", contentOverride: { text: "..." } }
  ]
}
Output: { postId: "post_xyz789", status: "draft" }

Step 6: Notion MCP → Content calendar
──────────────────────────────────────
Server: notion (built-in)
Tool:   create_page
Input: {
  database_id: "content_calendar_db",
  properties: {
    "Title": { title: [{ text: { content: "10 AI Trends" } }] },
    "Date": { date: { start: "2026-07-23" } },
    "Status": { select: { name: "Draft" } }
  }
}
Output: { page: { id: "page_abc" } }

Step 7: Slack MCP → Notify team
─────────────────────────────────
Server: slack (built-in)
Tool:   post_message
Input: {
  channel: "#content-team",
  text: "New social posts drafted for '10 AI Trends'! Review at https://app.smos.io/posts/post_xyz789"
}
Output: { ts: "12345.67890", channel: "C123" }
```

### 11.4 MCP Gateway Call Sequence

```
Time    Consumer          Gateway           WordPress MCP     Claude MCP        OpenAI MCP        Drive MCP
│       │                 │                 │                 │                 │                 │
├─ 0s   │ list_recent     │────────────────►│                 │                 │                 │
│       │                 │◄────────────────│ { posts }       │                 │                 │
├─ 1s   │ content_analysis│──────────────────────────────────►│                 │                 │
│       │                 │◄──────────────────────────────────│ { keywords }    │                 │
├─ 3s   │ chat_completion │──────────────────────────────────────────────────►│                 │
│       │                 │◄──────────────────────────────────────────────────│ { content }     │
├─ 6s   │ search_files    │───────────────────────────────────────────────────────────────────►│
│       │                 │◄───────────────────────────────────────────────────────────────────│ { files }
├─ 7s   │ create_post     │─── internal API ──►                                                │
│       │                 │◄── { postId } ─────                                                │
├─ 8s   │ create_page     │────────────────────────────────────►                               │
│       │                 │◄────────────────────────────────────│ { page }                      │
├─ 9s   │ post_message    │────────────────────────────────────────────────────►               │
│       │                 │◄────────────────────────────────────────────────────│ { ok }        │
└─ 10s                                                                                         │
```

Total: ~10 seconds to turn a blog post into drafts across 3 platforms with images, calendar entry, and Slack notification. All powered by 5 MCP servers working together.
