# FWCloud-API
This is the repository for the API REST of the <a href="https://fwcloud.net">FWCloud</a> project.<br>
Please, go to our main website for full information about it:<br>
https://fwcloud.net

FWCloud's source code is published under the free software license <a href="http://www.gnu.org/licenses/agpl-3.0.en.html">GNU AGPL, v3</a> and thus is freely available for download, use and share.<br>

## Audit event categories

Run the database migrations (`npm run fwcloud -- migration:run`) before deploying this API.
The audit log list and detail responses include nullable `eventType` and `outcome` fields.
Existing response fields and descriptions remain available.

`GET /auditlogs?event_type=compilation,installation` filters by one or more categories.
A single value (`event_type=login`) and repeated query parameters
(`event_type=login&event_type=logout`) are also supported. Unsupported or empty values
return HTTP 422. Omit `event_type` to display all accessible events, including historical
records. The filter combines with existing date, username, session, FWCloud, firewall,
cluster and source IP filters, `limit`, `page`, and `cursor`. Filtering and total counts
are computed in the database before page limits are applied. Cursor totals describe the
remaining matching records after the cursor, preserving the existing API behavior.

| Category | Classification |
| --- | --- |
| `compilation` | Policy compilation routes (including rule compilation), or a `compile` route action. |
| `installation` | Policy installation routes, or an `install` route action. |
| `creation` | Explicit add/create/store/clone/copy actions, known legacy collection creation routes, or POST responses with status 201. |
| `modification` | Explicit update, move, assignment, attachment, enable/disable, lock/unlock and sync actions; otherwise PUT/PATCH operations. |
| `deletion` | DELETE operations, explicit delete/remove actions, and the legacy firewall deletion instrumentation. |
| `login` | POST `/user/login`. |
| `logout` | POST `/user/logout`. |
| `other` | Newly recorded operations without a reliable classification, including internal events unless explicitly categorized. |

Classification uses route actions, paths and HTTP operation metadata, never free text
descriptions or client-supplied operation hints. Compilation and installation take
precedence over generic modifications. Read operations remain excluded. Historical
records retain a null category and outcome; the migration does not guess their category
or backfill authentication events. They remain visible when no category filter is set.

Authentication events are recorded once on response completion, with `outcome` equal to
`success` or `failure`, request start time, duration, source IP and HTTP status. An
interrupted response is a failure. Successful logins use the authenticated session identity;
logout snapshots the identity before session destruction. Failed logins have null user,
username and session references, with no lookup of the attempted username. Administrators
can read anonymous failures; regular users can read only their own authentication events,
even when another event shares their session reference. Existing access policies for other
audit records are preserved.

Authentication payloads contain only method, route path (without query strings), HTTP
status, duration, source IP, category and outcome. Request bodies, headers, query parameters,
response bodies, credentials, TFA codes and raw session cookies are excluded. Session
references use the existing numeric audit identifier rather than the session cookie.
Audit persistence failures do not change authentication responses or session handling.

The audit panel in `fwcloud-ui-src` provides a category multiselect. Empty selection means
all events; its clear action resets only the category selection, and the existing filter
reset clears all editable filters. Changing categories resets pagination, preserves the
remaining filters and stores the selection with the existing filter preferences. List
and detail views show category and authentication outcome, with labels for unauthenticated
and historical events.

## Policy rule copy and move

`PUT /policy/rule/copy` and `PUT /policy/rule/move` paste the rules in `rulesIds` next to
`pasteOnRuleId`: above it with `pasteOffset: -1`, below it with `pasteOffset: 1`. They keep
the policy order of the selected rules, whatever the order of `rulesIds`. For copies,
`pasteOffset: 0` pastes above the rule. For moves, it keeps the rules where they are and only
changes their group.

The optional `idgroup` sets the group of the pasted rules:

| `idgroup` | Group of the pasted rules |
| --- | --- |
| Omitted | The group of `pasteOnRuleId` (previous behavior). |
| `null` | No group. Allowed only at a group boundary, e.g. above the first rule or below the last rule of a group. |
| Group id | The group of `pasteOnRuleId` or of the rule on the other side of the insertion point. |

Values that would split a group, or `null`/another group with `pasteOffset: 0` on a move, return
HTTP 400 "Not allowed". Unknown groups and groups of other firewalls return HTTP 400 "Not found".
Moves run in a single transaction and remove the groups they leave empty.

## Login DAST in CI

GitHub Actions uses official ZAP API Scan profiles for public login and ten authenticated queries,
plus real HTTP checks for sessions, optional 2FA, permissions, isolation and audit.
See [ZAP and HTTP security checks](docs/ZAP.md) for coverage, credential-free evidence and ENS mapping.

## Dependency scanning and SBOM

GitHub Actions runs the pinned official Trivy CLI directly, scans runtime and
development dependencies, and generates a CycloneDX SBOM. HIGH/CRITICAL findings
and invalid or incomplete evidence block `backend-ci`.
The `backend-sca-sbom-<RUN_ID>-<ATTEMPT>` artifact retains the complete vulnerability
report, SBOM, scanner/database version and aggregate metadata, including on gate failure.
It also includes a readable `blocking.txt` report, scan/SBOM diagnostic logs and
`context.txt` with step outcomes and native exit codes. Context and available evidence
are uploaded even when an earlier failure prevents scanning; partial evidence does
not count as a successful scan.
Requested retention is 90 days.

There are no project-specific local Trivy launchers or `security:*` npm commands.
For optional local analysis, install the official CLI and use the commands in
[the CI specification](.github/CI-BACKEND.md#79-cli-nativa-y-simplificación-alineada-con-ui).

## SonarQube in CI

SonarQube Cloud analyzes TypeScript and legacy JavaScript with the official scan action,
reusing the Node 22/MySQL 8.0 LCOV artifact in the same CI workflow. `backend-ci` requires
the Quality Gate on pushes and internal PRs; external fork PRs are scanned after merge.
See [SonarQube setup](docs/SONARQUBE.md) for registration,
`SONAR_TOKEN`, project identifiers in `sonar-project.properties`, required checks and ENS evidence.
