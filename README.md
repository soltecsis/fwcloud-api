# FWCloud-API
This is the repository for the API REST of the <a href="https://fwcloud.net">FWCloud</a> project.<br>
Please, go to our main website for full information about it:<br>
https://fwcloud.net

FWCloud's source code is published under the free software license <a href="http://www.gnu.org/licenses/agpl-3.0.en.html">GNU AGPL, v3</a> and thus is freely available for download, use and share.<br>

## Login DAST in CI

GitHub Actions uses official ZAP API Scan profiles for public login and ten authenticated queries,
plus real HTTP checks for sessions, optional 2FA, permissions, isolation and audit.
See [ZAP and HTTP security checks](docs/ZAP.md) for coverage, credential-free evidence and ENS mapping.

## SonarQube in CI

SonarQube Cloud analyzes TypeScript and legacy JavaScript with the official scan action,
reusing the Node 22/MySQL 8.0 LCOV artifact in the same CI workflow. `backend-ci` requires
the Quality Gate on pushes and internal PRs; external fork PRs are scanned after merge.
See [SonarQube setup](docs/SONARQUBE.md) for registration,
`SONAR_TOKEN`, project identifiers in `sonar-project.properties`, required checks and ENS evidence.
