# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2024-09-29
### Added
- CI scripts update.
- HAProxy service API calls and service compiler.
- KeepAlived service API calls and service compiler.
- DHCP service API calls and service compiler.
- Database migration for the KeepAlived service management.
- Database migration for the HAProxy service management.
- Database migration for the DHCP service management.
- Added query data to get Agent host information.
- HAProxy plugin.
- Systemctl management API call.
- Database migration for the DHCP service management.
- In the firewalls/clusters tree new sort of nodes under a firewall or cluster node. 
- Migrations are added to create the System nodes and their children: DHCP, Keepalived, and HAProxy.

### Changed
- Dependencies upgraded to the last version.
- 'TypeORM' upgraded and made changes from last version (v0.3.20). 
- 'SocketIO' upgraded as well.
- Replaced 'ip' package by 'ipaddr.js' package. 
- Replaced 'chalk' package by 'kleur' package.
- Added 'husky' and 'lint-staged' to manage Prettier and ESlint before each commit.
- ESLint and Prettier configured into the project and fixed errors afterwards.
- Optimize and reduce the time for the firewalls and clusters tree creation.


## [1.9.2] - 2023-06-07
### Added
- `GET updates/type/pkg` API call. It will be used by FWCloud-UI to get the updates information in a FWCloud DEB/RPM packages based installation.

### Changed
- Updated EASY-RSA to the latest version.
- Updated OpenVPN GUI installer to the latest version.


## [1.9.1] - 2023-05-15 
### Fixed
- Bug in GitHub Actions procedure for automatically generate packages for `deb` and `rpm` based Linux distributions.


## [1.9.0] - 2023-05-11 
### Added
- Automatically generated packages by means of GitHub Actions for `deb` and `rpm` based Linux distributions.
- `After=mariadb-server.service mysql-server.service` to the `fwcloud-api.service` systemd file to make sure that the database engine is started before the `fwcloud-api` service.


## [1.8.4] - 2023-03-27
### Added
- Relation with countries and continents in `ipobj_type__policy_position` table.

### Fixed
- Bug in database migration: 1653374901932-add_relation_countries_ipobj_type__policy_position


## [1.8.2] - 2023-03-23
### Added
- ISC DHCP plugin.
- ISC Bind9 plugin.


## [1.8.1] - 2023-03-13
### Fixed
- Avoid update errors that can arise if we update FWCloud-Updater together with other modules at the same time. For example, if we update FWCloud-Updater first and next FWCloud-Websrv, if we don't wait, we will try to communicate with FWCloud-Updater for make the FWCloud-Websrv update before the fwcloud-updater service is available.


## [1.8.0] - 2023-03-13
### Added
- Task in package.json file for TLS certificates update.
- Script for TLS certificate update.
- Changes in the compiled policy script for detect if the `iptables` or `nft` commands exists depending of the policy compiler. For example, if the selected policy compiler is `IPTables` and the `iptables` command doesn't exists in the destination firewall then stop the policy load script and notify the error.

### Changed
- If PID file exists, stop before start.


## [1.7.2] - 2023-01-30
### Fixed
- Several vulnerabilities reported by the command `npm audit`. 
- Bug in `iptables-save` import procedure when `-p tcp` and `-m tcp` are used at the same time in combination with the `multiport` IPTables module. This bug created TCP port 0 service in affected policy rules. Reported by Jeremy Mueller.


## [1.7.1] - 2022-12-01
### Added
- Database migration for create some new indexes to the `openvpn_status_history` table.
- Debug logs for the worker that collects and processes OpenVPN history data.

### Fixed
- Out of memory error for OpenVPN history data worker (issue #569).


## [1.7.0] - 2022-11-18
### Added
- fwcli command `standard:services:add` for add new standard services.
- Keepalived plugin.
- Suricata plugin.
- Zeek plugin.
- Elasticsearch plugin.
- Kibana plugin.
- Logstash plugin.
- Filebeat plugin.
- Web Safety Proxy plugin.
- DNS Safety plugin.
- CrowdSec plugin.
- NtopNG plugin.


## [1.6.3] - 2022-10-10
### Changed
- Authentication required for the `config` API call.
- Only run GitHub actions on pull requests over the `devel` branch and on `push` over the `main` branch.
- Avoid running GitHub actions in the repository forks.
- Changed the default repository branch to `devel` in order to avoid the generation of pull requests over the `main` branch by mistake. 


## [1.6.2] - 2022-10-06
### Fix
- Commit revert problem in `main` branch.


## [1.6.1] - 2022-10-06
### Added
- Configuration that allows disabling communication with firewalls by means of SSH protocol.
- Configuration options for limit the amount of FWClouds that can be created and, into each fwcloud, the amount of firewalls, clusters and nodes within a cluster.


## [1.6.0] - 2022-09-22
### Added
- Mutex for avoir race conditions in backup tasks.
- API call for gather FWC-Agent information.
- Use of the 'ws' NPM module for for realtime output in plugins enabling/disabling procedure by means of WebSocket communication with FWCloud-Agent.
- API call for plugins management.
- Allow option OpenVPNArchiver to store records of openvpn status history. Also added CRON tasks to schedule the process.
- 2FA Support.
- Allow option 'apply to' for routes and routing policy.
- Download and show policy script.
- Allow the use of continents and countries in objects tree to filter by IPs of a full continent or country.

### Changed
- In the API call for policy load script, allow the use of a websocket with FWCloud-Agent for realtime output display in FWCloud-UI.
- New call created returns the openvpn nodes with additional information such as the address.
- Backup sql is compressed (zip) in order to save space.
- Changed OpenVPN status history worker iteration in order to avoid iteration overlaps.

### Fixed
- Out of memory error in OpenVPN history data collector task.
- Ip6tables script logic error results in repeated rules.
- Avoid session expiration in long lasting plugins actions.
- Fix sync ccd operation when destination directory does not exist
- Fixed error handler when a ccd file is removed using the agent
- Special rules not created for new firewall/clusters.
- Backup related tasks are not scheduled twice.
- Backup retention policy task is scheduled.
- Fixed tree repair process.
- Updated easy-rsa package from 3.0.6 to 3.1.0.
- Syntax error in some OpenVPN logs.


## [1.5.1] - 2022-04-28
### Fixed
- Bug in new release deployment procedure.


## [1.5.0] - 2022-04-28
### Added
- Added `mysql:8` support.
- New special Hook script rule.
- New special CrowdSec compatibility rule for IPTables/NFTables CrowdSec firewall bouncer.
- New special Fail2Ban compatibility rule.
- Code in policy script for detect if Docker automatic rule generation is disabled when the Docker compatibility option is enabled.


## [1.4.3] - 2022-03-18
### Added
- Generate self signed TLS certificates for Docker image.
- Enable HTTPS for API access in the Docker image.


## [1.4.2] - 2022-03-07
### Fixed
- Bug in Docker workflow.



## [1.4.1] - 2022-03-07
### Added
- Added `Dockerfile`.
- Added `CORS.enabled` configuration parameter which enables/disables CORS middleware.

### Fixed
- Bug in restrictions check when removing node from a firewall cluster.
- Prevent `keys:generate` cli command from generating new keys if they are already defined (included `--force` option)
- Prevent `migration:data` cli command from importing default data if data is already imported (included `--force` option)


## [1.4.0] - 2021-12-02
### Added
- Firewall communication through FWCloud Agent.
- OpenVPN history statistics and graphs.

### Fixed
- Remove `_object` property from ValidationError response.


## [1.3.1] - 2021-10-08
### Added
- Allow the use of vtun interfaces in OpenVPN configurations. 
  
### Fixed
- Bug in compiler for firewall policy comments.


## [1.3.0] - 2021-09-22
### Added
- Advanced routing management using the drag and drop features of FWCloud-UI. It is possible to easily create routing tables, routes and routing policy by means of the user web interface FWCloud-UI and the new set of API calls for routing management.
- Routing compiler for generate the script code that allows apply the routing configuration in the destination firewall.
- NFTables compiler. A new firewall policy compiler that allows generate the policy installation script using the NFTables Linux kernel packet classification framework. At this moment two compilers are available: IPTables and NFTables.
- Improved the `Where used` feature including the new routing feature.
- Better control to avoid leaving empty groups or hosts used in policy, routes or routing policy.
- Take into account routes and routing rules in the API call for the most used colors.
- Compilation of several firewall rules, routes or routing rules.
- Hundreds of new software tests.

### Fixed
- Fixed 'After adding host to a group it is not possible move it to policy positions'.
- Fixed 'Bug in firewall cluster node remove'.
- Remove restrictions added for groups which are being used in policy rules.
- Fixed 'Problem getting host information'
- Disallow adding hosts without addresses to groups.
- Adding/removing IPs from hosts used by firewalls updates firewall status flags
- Changing mark name updates its node in the tree node
- Changing the OpenVPN prefixes updates all nodes which reference to it
- Changing mark settings updates firewalls status flags which use it


## [1.2.0] - 2021-04-30
### Added
- Hook scripts feature at the rule level. It allows to add shell script code before and/or after a policy rule load.
- Extended the information displayed by the "where used" search feature. For example, if we use this feature over an OpenVPN, display the rules with groups that include OpenVPN prefixes that include this OpenVPN.
- Include VPN connection status (enabled/disabled) in tree's nodes for the OpenVPN connections.
- Additional info (TCP/UDP port and IPv4/IPv6 address) in tree's nodes.
- Hundreds of new software tests for IPTables compiler.

### Fixed
- Error in interfaces discover feature in CentOS 7.
- Set `MYSQL_PWD` environment variable for database password (mysqldump and mysql commands) instead of using it in command line.
- In iptables-save import process lines like this `-A CHAIN.NAME -j RETURN`.
- Detect FWCloud accounting rules in the iptables-save import procedure.
- Bug removing a firewall cloud with OpenVPN in group (table openvpn__ipobj_g).
- Restore related firewall, cluster and host information for objects in rules.
- Bug in OpenVPN pending CCD files synchronization.
- IPTables compiler error when using a service in the Translated `Service position` of a DNAT rule.
- Performance improvements in `snapshot` import process.

### Security
- Updated npm module y18n from 3.2.1 to 3.2.2.


## [1.1.0] - 2021-03-18
### Added
- Optimizations in API calls for policy and trees (firewalls, objects, services and CA) get. Around 10 times faster.
- Huge improvement in IPTables compiler process. Nearly 40 times faster. 
- Option for only sync the CCD files of the OpenVPN clients pending of install.
- New API call `PUT /policy/rule/type/ingroup/get` for get only the firewall rules into a rules group, including the data about objects into rules positions.
- New API call `PUT /policy/rule/type/grouped/get` for get firewall policy rules of one type but without getting data about objects into rules positions into rules groups. This is very useful for speed up policy load in FWCloud-UI.
- Improved performance in the process for harvest information about each object in each rule position. It is now nearly 3 times faster.
- Improve snapshots performance.
- Improve backup and restore performance.
- Header description in OpenVPN configuration files.
- Configuration parameters for socket.io pingInterval and pingTimeout.
- Send heartbeats through socket.io in FWCloud import/export operations.
- For SSH connections detect if we are using the `root` user and don't use `sudo` in such cases.
- Improve session check in socket.io connection establishment.
- API call `PUT /ping`.
- Improved SSH errors management.
- Include rule metadata (color, group, group color, etc.) in the comment of rule compilation. Thanks to this it is possible to restore these metadata information when we import a FWCloud firewall using `iptables-save import feature`.
- API call `PUT /iptables-save/import`: Import iptables-save data into an existing firewall.
- API call `PUT /iptables-save/export`: Get iptables-save data exit from a FWCloud managed firewall.
- Upgrade to Socket.IO v3. Upgraded npm module socket.io from 2.3.0 to 3.0.4.
- By default listen to localhost.

### Fixed
- Remove standard objects when a fwcloud is removed.
- Ignore maintenance mode for ping API requests.
- Set the mysqldump node module format option to false for avoid long high CPU usage in backups of databases with lot of registers.
- Multiport module, up to 15 ports limit control.
- Bug in session expiration.
- fwcloud-updater doesn't process update requests (for example, PUT /updates/ui) when all request headers are forwarded. Forward only the cookie header, required for the authentication middleware of the fwcloud-updater.
- Log detailed information for websocket connection/disconnection.
- Disable etag in express for avoid the problem explained in the http-application.ts file.
- Bug in autodiscover when the `ip a` command returns interfaces with name like this one: `ens193.40@ens193:` In such cases the interface name must be the string preceding the `@` character.

### Changed
- Removed table policy_c and all the code that uses it.
- Removed `mysqldump` and `mysql-import` node modules.
- Set the maximum size of accepted data for BodyParser to 2MB.
- Disable confirmation token for `PUT /ping` API call.
- Clean firewall policy before iptables-save import.
- Don't add comment in firewall rules generated by iptables-save import procedure.

### Security
- Updated npm module highlight.js from 9.18.0 to 9.18.5.
- Updated npm module ini from 1.3.5 to 1.3.7.
- Updated npm module axios from 0.21.0 to 0.21.1.


## [1.0.1] 
### Added
- Log format for http.log.
- Rename log file from 'fwcloud.log' to 'api.log'.
- Unify log format with all other applications (fwcloud-updater and fwcloud-websrv) logs format.
- Store pid in .pid file.
- Npm script for stop process using the pid stored in .pid file.
- SGTERM and SIGINT signal handlers.
- Implement API call for FWCloud Websrv updates (PUT /updates/websrv).
- Ignore self signed certificate for fwcloud-updater.
