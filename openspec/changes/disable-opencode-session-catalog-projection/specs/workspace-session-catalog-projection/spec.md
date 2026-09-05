# Delta: workspace-session-catalog-projection

## ADDED Requirements

### Requirement: Catalog OpenCode Discovery Follows CLI Visibility

Workspace Session Management catalog projection and projection summary MUST honor `AppSettings.disabledCliEngines` for the OpenCode source in both GUI and installed daemon paths.

#### Scenario: disabled OpenCode is not discovered by catalog

- **GIVEN** `AppSettings.disabledCliEngines` contains `opencode` (case-insensitive, surrounding whitespace ignored)
- **WHEN** the workspace catalog or projection summary is built
- **THEN** the backend MUST NOT call `opencode_session_list_core` or spawn OpenCode/Bun through that source
- **AND** the response MUST include an OpenCode source status with `completeness=authoritative_empty` and `reason=disabled-by-settings`
- **AND** the response MUST NOT mark OpenCode as a partial/degraded failure solely because it is disabled

#### Scenario: enabled OpenCode keeps existing catalog behavior

- **GIVEN** `opencode` is absent from `disabledCliEngines`
- **WHEN** the workspace catalog is built
- **THEN** the backend MAY call `opencode_session_list_core`
- **AND** successful entries, missing CLI handling, and existing OpenCode rows MUST preserve current behavior

#### Scenario: GUI and daemon share the same gate

- **WHEN** GUI or installed daemon serves workspace catalog data with the same `AppSettings`
- **THEN** both paths MUST produce the same OpenCode discovery decision and source status semantics
