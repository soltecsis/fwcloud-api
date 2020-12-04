# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
## Fixed
- fwcloud-updater doesn't process update requests (for example, PUT /updates/ui) when all request headers are forwarded. Forward only the cookie header, required for the authentication middleware of the fwcloud-updater.
- Log detailed information for websocket connection/disconnection.
- Disable etag in express for avoid the problem explained in the http-application.ts file.

## [1.0.1] 
### Added
- Log format for http.log.
- Rename log file from 'fwcloud.log' to 'api.log'.
- Unify log format with all other applications (fwcloud-updater and fwcloud-websrv) logs format.
- Store pid in .pid file.
- Npm script for stop process using the pid stored in .pid file.
- SGTERM and SIGINT signal handlers.
- Implement API call for FWCloud Websrv updates (PUT /updates/websrv).
- Ignore self signed certificate for fwcloud-updater.
