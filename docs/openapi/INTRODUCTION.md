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


## Security and best practices

- Always use HTTPS in real environments.
- Properly restrict allowed CORS origins.
- Do not reuse default credentials in production.
- Manage session expiration/rotation and protect cookie/token storage.

## Official reference

This introduction is aligned with the official FWCloud-API usage guide:

- https://fwcloud.net/en/documentation/fwcloud-api/
