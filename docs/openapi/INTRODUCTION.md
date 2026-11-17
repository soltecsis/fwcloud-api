# FWCloud-API

This documentation describes the FWCloud REST API, the backend module responsible for executing management operations on firewalls, policies, IP objects, VPNs, and other platform resources.

## What you can do with the API

- Operate FWCloud without depending on `FWCloud-UI`.
- Integrate automations (for example, dynamic blocking rules).
- Query operational status (for example, connectivity or service information).
- Manage resources programmatically (FWClouds, firewalls, clusters, etc.).

## Usage requirements

To call the API, you need:

1. API base URL (IP/DNS + listening port).
2. Secure communication over HTTPS.
3. A valid `Origin` header (it must be allowed in the server's CORS configuration).
4. Valid credentials (`customer`, `username`, `password`).

## Recommended authentication flow

1. **Login**  
   Send `POST /user/login` with JSON credentials.

2. **Session**  
   The API returns a session cookie; you must reuse it in subsequent calls.

3. **Mutating Operations**  
   In operations that modify data, the API may require additional confirmation through the `X-FWC-Confirm-Token` header.

## General request structure

A request is composed of:

- **METHOD**: `POST`, `GET`, `PUT`, `DELETE`, etc.
- **URL**: resource endpoint.
- **JSON BODY**: operation parameters (especially on legacy endpoints).
- **HEADERS**: `Content-Type`, `Origin`, session cookie, and confirmation token when applicable.

## Audit log sorting and pagination

`GET /auditlogs` and `PUT /auditlogs` accept these optional query parameters:

| Parameter | Accepted values | Default | Meaning |
| --- | --- | --- | --- |
| `sort_by` | `start`, `end` | `start` | Order by the operation start time or its calculated end time. |
| `sort_order` | `asc`, `desc` | `desc` | Earliest first or latest first. |

Unsupported sorting values are rejected. For example, `/auditlogs?sort_by=end&sort_order=asc` returns the earliest finished operations first. Omitting both parameters preserves the existing order: most recently started operations first.

Sorting uses database timestamps across the complete filtered dataset before `page`/`pageSize` or `limit` pagination. Audit log IDs break timestamp ties in the selected direction. All existing access restrictions and filters continue to apply.

An operation's end time is its start time plus its known, nonnegative `duration_ms` value. Records without a known end time are placed after records with known end times in both directions, with IDs ordered in the selected direction. A zero duration is valid; a missing or invalid duration does not establish a completion time. The duration backfill migration copies valid historical `durationMs` or `duration_ms` payload values into the structured column, so list queries do not need to parse serialized audit data.

Start-time sorting can use the existing timestamp index. End-time sorting calculates the end time for matching records and requires a database sort; it does not have a dedicated end-time index.

For cursor pagination, pass `cursor=<timestamp>:<id>` using the last returned record's `startedAt` when sorting by `start`, or `finishedAt` when sorting by `end`. For a record without a known end time, use `cursor=null:<id>`. URL-encode cursor values and retain the same sorting parameters and filters for subsequent requests. The existing start-time cursor format remains supported. With a cursor, `total` retains its existing meaning: the number of matching records remaining after the cursor, before the page limit.


## Security and best practices

- Always use HTTPS in real environments.
- Properly restrict allowed CORS origins.
- Do not reuse default credentials in production.
- Manage session expiration/rotation and protect cookie/token storage.

## Official reference

This introduction is aligned with the official FWCloud-API usage guide:

- https://fwcloud.net/en/documentation/fwcloud-api/
