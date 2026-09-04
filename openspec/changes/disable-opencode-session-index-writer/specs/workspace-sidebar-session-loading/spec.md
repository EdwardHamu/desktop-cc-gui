# Delta: workspace-sidebar-session-loading

## ADDED Requirements

### Requirement: Session Index OpenCode Discovery Follows CLI Configuration

When `AppSettings.disabledCliEngines` does not contain `opencode`, Session Index importer、soft re-sync 与用户触发的 Session Index reload MAY execute `opencode session list` through `opencode_session_list_core`.

When `AppSettings.disabledCliEngines` contains `opencode`, those paths MUST NOT execute `opencode session list` or call `opencode_session_list_core`.

Existing OpenCode rows already persisted in `session_index` MUST remain listable. User-explicit OpenCode conversation and resume flows remain outside this requirement.

#### Scenario: enabled OpenCode is discovered by importer

- **GIVEN** CLI configuration does not disable `opencode`
- **WHEN** the 90s Session Index importer scans a workspace
- **THEN** the OpenCode writer MAY query OpenCode sessions

#### Scenario: disabled OpenCode is not spawned by importer

- **GIVEN** CLI configuration disables `opencode`
- **WHEN** the 90s Session Index importer scans a workspace
- **THEN** it MUST NOT spawn OpenCode or Bun through an OpenCode session-list command
- **AND** other engine writers MUST continue their existing sync behavior

#### Scenario: historical OpenCode rows remain visible

- **GIVEN** an OpenCode row already exists in `session_index`
- **WHEN** the sidebar lists the workspace Session Index
- **THEN** the row MUST remain eligible for the returned page
- **AND** when CLI configuration disables `opencode`, the list operation MUST NOT refresh it through OpenCode CLI
