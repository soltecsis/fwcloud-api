export type OpenVPNServerConfigInstallData = {
  clientConfigDir: string | null;
  group: string;
};

const DEFAULT_OPENVPN_GROUP = 'nogroup';
const OPENVPN_GROUP_PATTERN = /^[A-Za-z0-9_.-]+$/;
const OPENVPN_DIRECTIVE_PATTERN = /^(?:--)?([A-Za-z0-9][A-Za-z0-9_-]*)(?:\s+|=)(.+)$/;

export const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

export function getOpenVPNServerConfigInstallData(
  configContent: string,
): OpenVPNServerConfigInstallData {
  const directives = getOpenVPNDirectives(configContent);
  const clientConfigDir = directives.get('client-config-dir') ?? null;
  const group = clientConfigDir
    ? (directives.get('group') ?? DEFAULT_OPENVPN_GROUP)
    : DEFAULT_OPENVPN_GROUP;

  if (clientConfigDir && !OPENVPN_GROUP_PATTERN.test(group)) {
    throw new Error(`Invalid OpenVPN group: ${group}`);
  }

  return {
    clientConfigDir,
    group,
  };
}

export function getOpenVPNClientConfigDirScript(dir: string, group: string): string {
  return `
#!/bin/sh
set -eu

if [ "\${1:-}" = "install" ]; then
  mkdir -p ${shellQuote(dir)}
  chown ${shellQuote(`root:${group}`)} ${shellQuote(dir)}
  chmod 750 ${shellQuote(dir)}
fi
`.trim();
}

function getOpenVPNDirectives(configContent: string): Map<string, string> {
  const directives = new Map<string, string>();
  let inInlineBlock = false;

  for (const line of configContent.split(/\r?\n/)) {
    const cleanedLine = stripOpenVPNComments(line).trim();
    if (cleanedLine.startsWith('</')) {
      inInlineBlock = false;
      continue;
    }

    if (cleanedLine.startsWith('<')) {
      inInlineBlock = true;
      continue;
    }

    if (inInlineBlock) {
      continue;
    }

    const match = cleanedLine.match(OPENVPN_DIRECTIVE_PATTERN);
    if (!match) {
      continue;
    }

    const argument = firstOpenVPNArgument(match[2].trim());
    if (argument) {
      directives.set(match[1], argument);
    }
  }

  return directives;
}

function stripOpenVPNComments(line: string): string {
  let quote: string | null = null;
  let result = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const previous = i > 0 ? line[i - 1] : '';

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      result += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      continue;
    }

    if (char === '#' || char === ';') {
      break;
    }

    result += char;
  }

  return result;
}

function firstOpenVPNArgument(value: string): string | null {
  if (!value) {
    return null;
  }

  const quote = value[0];
  if (quote === '"' || quote === "'") {
    let result = '';
    for (let i = 1; i < value.length; i++) {
      const char = value[i];
      const previous = i > 0 ? value[i - 1] : '';

      if (char === quote && previous !== '\\') {
        return result;
      }

      result += char;
    }

    return result || null;
  }

  return value.split(/\s+/)[0] || null;
}
