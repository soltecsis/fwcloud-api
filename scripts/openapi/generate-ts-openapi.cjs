#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const configFile = path.resolve(__dirname, '../../tsoa.json');
const tsoaBin = path.resolve(__dirname, '../../node_modules/.bin/tsoa');
const specFile = path.resolve(__dirname, '../../docs/openapi/openapi.json');
const introFile = path.resolve(__dirname, '../../docs/openapi/INTRODUCTION.md');
const packageFile = path.resolve(__dirname, '../../package.json');

const CROWDSEC_OPERATION_DESCRIPTIONS = {
  'Get firewall CrowdSec status': 'Returns the CrowdSec runtime state and the FWCloud installation metadata for this firewall.',
  'List firewall CrowdSec collections': 'Lists CrowdSec collections available on this firewall, optionally filtered by installation state.',
  'Get CrowdSec collection acquisition': 'Returns the acquisition configuration managed by FWCloud for an installed CrowdSec collection.',
  'Update CrowdSec collection acquisition': 'Updates the log paths and labels used by the selected CrowdSec collection acquisition.',
  'Select CrowdSec collection acquisition parser': 'Selects one of the parser label types detected for the collection acquisition.',
  'Get firewall CrowdSec Console status': 'Returns the CrowdSec Console status reported by this firewall.',
  'List firewall CrowdSec decisions': 'Lists active CrowdSec decisions using the supplied filters.',
  'List firewall CrowdSec alerts': 'Lists CrowdSec alerts using the supplied filters.',
  'List firewall CrowdSec bouncers': 'Lists Firewall Bouncers registered in the local CrowdSec API.',
  'Get CrowdSec blocking statistics sampling configuration': 'Returns the Firewall Bouncer statistics sampling configuration.',
  'Update CrowdSec blocking statistics sampling configuration': 'Updates the Firewall Bouncer statistics sampling configuration.',
  'List CrowdSec blocking statistics': 'Returns aggregated Firewall Bouncer blocking statistics for the requested period.',
  'List CrowdSec blocking statistics by address': 'Returns aggregated Firewall Bouncer blocking statistics grouped by address.',
  'List CrowdSec blocking statistics address options': 'Lists addresses available for blocking-statistics filtering.',
  'List firewall CrowdSec machines': 'Lists Machines registered in this firewall Local API.',
  'List central LAPI candidates': 'Lists Local API installations in the same FWCloud that can be selected as a managed central LAPI.',
  'Configure central CrowdSec LAPI': 'Configures this Local API as a central LAPI and optionally enables remote listening.',
  'Validate CrowdSec machine': 'Accepts a pending Machine registration in this central Local API.',
  'Remove CrowdSec machine': 'Removes a Machine registration from this central Local API.',
  'Reauthenticate CrowdSec machine': 'Re-registers a Machine against its configured central Local API.',
  'Check external CrowdSec LAPI connectivity': 'Performs a bounded TCP connectivity check from the firewall agent to a Local API URL without changing CrowdSec.',
  'Install CrowdSec machine': 'Installs CrowdSec as a Machine against either a managed central LAPI or a manually supplied external Local API. A Machine installation requires machineName and lapiUrl; an external LAPI with remediation also requires bouncerApiKey.',
  'Change CrowdSec machine LAPI address': 'Changes the manually configured Local API URL of an existing CrowdSec Machine.',
  'Move CrowdSec machine to central LAPI': 'Moves a CrowdSec Machine to a managed central Local API in the same FWCloud.',
  'Change CrowdSec machine remediation': 'Enables or disables the local Firewall Bouncer for this CrowdSec Machine.',
  'Change CrowdSec installation role': 'Converts the firewall between Local API and Machine modes. Machine mode requires machineName and lapiUrl; enrollmentKey is used only when converting to a Local API.',
  'Register CrowdSec bouncer': 'Registers a Firewall Bouncer in this Local API.',
  'Remove CrowdSec bouncer': 'Removes a Firewall Bouncer registration from this Local API.',
  'Delete CrowdSec decision': 'Deletes one CrowdSec decision by identifier.',
  'Flush CrowdSec decisions': 'Deletes CrowdSec decisions matching the supplied filters.',
  'Enroll CrowdSec Console': 'Submits this Local API enrollment request to CrowdSec Console.',
  'Confirm CrowdSec Console enrollment': 'Records that an administrator has manually confirmed the CrowdSec Console enrollment.',
  'Clear CrowdSec Console enrollment confirmation': 'Clears the manual CrowdSec Console enrollment confirmation.',
  'Install CrowdSec collection': 'Installs one CrowdSec collection on this firewall.',
  'Remove CrowdSec collection': 'Removes one CrowdSec collection from this firewall.',
  'Update CrowdSec collections': 'Updates the installed CrowdSec collections on this firewall.',
  'Install CrowdSec': 'Installs CrowdSec as a Local API or Machine. Machine mode has the same managed-versus-external Local API requirements as the machine installation endpoint.',
  'Uninstall CrowdSec': 'Uninstalls CrowdSec and its FWCloud-managed configuration from this firewall.',
  'Install CrowdSec machines in cluster': 'Installs CrowdSec Machines on the selected cluster nodes against a managed or external central Local API. For an external Local API with remediation, bouncerApiKey is required.',
  'Install CrowdSec cluster LAPI master topology': 'Installs a Local API on the cluster master and Machines on the remaining nodes. The Local API URL must use an address assigned to the selected cluster.',
  'Cancel CrowdSec cluster LAPI master topology': 'Cancels a pending cluster Local API master topology and removes its managed CrowdSec configuration.',
  'Check external CrowdSec LAPI connectivity for cluster nodes': 'Performs bounded TCP connectivity checks from the selected cluster nodes to a Local API URL without changing CrowdSec.',
  'Enroll CrowdSec Console from cluster LAPI nodes': 'Submits CrowdSec Console enrollment from eligible Local API nodes in the cluster.',
  'Change CrowdSec role in cluster': 'Converts a uniform cluster installation between Local API and Machine modes. Machine mode requires lapiUrl; nodeIds restrict an operation when the cluster topology permits it.',
  'Move cluster CrowdSec machines to central LAPI': 'Moves the selected cluster Machines to a managed central Local API.',
  'Change cluster CrowdSec machine LAPI address': 'Changes the external Local API URL used by the selected cluster Machines.',
  'Change cluster CrowdSec remediation': 'Enables or disables Firewall Bouncer remediation on all nodes of a uniform cluster or on the selected Machine of a mixed topology.',
  'List cluster CrowdSec collections': 'Lists CrowdSec collections for the selected cluster node.',
  'Get cluster CrowdSec collection acquisition': 'Returns the acquisition configuration for a collection on the selected cluster node.',
  'Update cluster CrowdSec collection acquisition': 'Updates the acquisition configuration for a collection on the selected cluster node.',
  'Select cluster CrowdSec collection acquisition parser': 'Selects the parser label type for a collection acquisition on the selected cluster node.',
  'Get cluster CrowdSec blocking statistics sampling configuration': 'Returns blocking-statistics sampling configuration for the selected cluster node.',
  'Update cluster CrowdSec blocking statistics sampling configuration': 'Updates blocking-statistics sampling configuration for the selected cluster node.',
  'List cluster CrowdSec blocking statistics': 'Returns blocking statistics for the selected cluster node.',
  'List cluster CrowdSec blocking statistics by address': 'Returns blocking statistics grouped by address for the selected cluster node.',
  'List cluster CrowdSec blocking statistics address options': 'Lists blocking-statistics address filters for the selected cluster node.',
  'Install CrowdSec collection in cluster': 'Installs one CrowdSec collection on the selected cluster node.',
  'Remove CrowdSec collection in cluster': 'Removes one CrowdSec collection from the selected cluster node.',
  'Update CrowdSec collections in cluster': 'Updates installed CrowdSec collections on the selected cluster node.',
};

function schemaFromExample(value, requiredProperties = false) {
  if (value === null) {
    return { nullable: true };
  }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length === 0 ? {} : schemaFromExample(value[0]),
    };
  }

  switch (typeof value) {
    case 'boolean':
      return { type: 'boolean' };
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'string':
      return { type: 'string' };
    case 'object': {
      const properties = Object.fromEntries(
        Object.entries(value).map(([key, propertyValue]) => [key, schemaFromExample(propertyValue)]),
      );
      return {
        type: 'object',
        ...(requiredProperties ? { required: Object.keys(properties) } : {}),
        properties,
      };
    }
    default:
      return {};
  }
}

function crowdSecSchemaName(operationId) {
  return `CrowdSec${operationId.replace(/[^A-Za-z0-9]+/g, '')}Response`;
}

const result = spawnSync(tsoaBin, ['spec', '--configuration', configFile], {
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

try {
  if (!fs.existsSync(specFile)) {
    console.error(`OpenAPI spec not found: ${specFile}`);
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));

  spec.info = spec.info || {};

  if (fs.existsSync(packageFile)) {
    const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    if (packageJson.version) {
      spec.info.version = packageJson.version;
    }
  }

  if (fs.existsSync(introFile)) {
    const introMarkdown = fs.readFileSync(introFile, 'utf8').trim();
    spec.info.description = introMarkdown;
  }

  // CrowdSec controller methods keep their TSOA body parameters optional so
  // existing direct controller calls in unit tests remain source-compatible.
  // Runtime validation still requires each mutation payload. Reflect that API
  // contract in the generated OpenAPI document without changing controller
  // invocation semantics.
  spec.components = spec.components || {};
  spec.components.schemas = spec.components.schemas || {};

  for (const [pathName, pathItem] of Object.entries(spec.paths || {})) {
    if (!pathName.includes('/system/crowdsec/')) {
      continue;
    }

    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      if (operation.requestBody) {
        operation.requestBody.required = true;
      }

      const description = CROWDSEC_OPERATION_DESCRIPTIONS[operation.operationId];
      if (description) {
        operation.description = description;
      }

      const response = operation.responses?.['200'];
      const content = response?.content?.['application/json'];
      const example = content?.examples && Object.values(content.examples)[0]?.value;
      if (example && typeof example === 'object' && 'data' in example) {
        const schemaName = crowdSecSchemaName(operation.operationId);
        spec.components.schemas[schemaName] = schemaFromExample(example, true);
        content.schema = { $ref: `#/components/schemas/${schemaName}` };
      }
    }
  }

  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2) + '\n');
} catch (error) {
  console.error(error);
  process.exit(1);
}
