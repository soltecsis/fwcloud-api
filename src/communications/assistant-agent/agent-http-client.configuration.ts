/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { createSecureContext } from 'node:tls';
import { ConfigurationErrorException } from '../../config/exceptions/configuration-error.exception';

export const DEFAULT_AGENT_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_AGENT_READ_TIMEOUT_MS = 180_000;
export const MAX_AGENT_TIMEOUT_MS = 2_147_483_647;

export interface AgentHttpClientConfigurationInput {
  readonly url?: string;
  readonly apiKey?: string;
  readonly connectTimeoutMs?: number | string;
  readonly readTimeoutMs?: number | string;
  readonly caFile?: string | null;
  readonly allowInsecureHttp?: boolean;
  /** Base used only to resolve a relative caFile path. Defaults to cwd. */
  readonly baseDirectory?: string;
}

export interface AgentHttpClientConfiguration {
  readonly endpoint: URL;
  /** Credential-free endpoint label suitable for logs and metrics. */
  readonly endpointIdentifier: string;
  readonly apiKey: string;
  readonly connectTimeoutMs: number;
  readonly readTimeoutMs: number;
  readonly ca?: Buffer;
}

function configurationError(message: string): ConfigurationErrorException {
  return new ConfigurationErrorException(`Configuration Error: ${message}`);
}

function requiredNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw configurationError(`${name} must be defined`);
  }

  return value.trim();
}

function validApiKey(value: unknown): string {
  if (typeof value === 'string' && /\p{Cc}/u.test(value)) {
    throw configurationError('Assisted Profile agent API key contains invalid characters');
  }

  const apiKey = requiredNonEmptyString(value, 'Assisted Profile agent API key');

  // Header values must never allow line breaks or other control characters.
  // Do not include the rejected value in the configuration error.
  return apiKey;
}

function positiveIntegerTimeout(
  value: number | string | undefined,
  fallback: number,
  name: string,
): number {
  const candidate = value ?? fallback;
  const trimmed = typeof candidate === 'string' ? candidate.trim() : candidate;
  const normalized =
    typeof trimmed === 'string' && /^\d+$/.test(trimmed) ? Number(trimmed) : candidate;

  if (
    typeof normalized !== 'number' ||
    !Number.isInteger(normalized) ||
    normalized <= 0 ||
    normalized > MAX_AGENT_TIMEOUT_MS
  ) {
    throw configurationError(
      `${name} must be a positive integer no greater than ${MAX_AGENT_TIMEOUT_MS}`,
    );
  }

  return normalized;
}

function parseAgentUrl(rawUrl: string, allowInsecureHttp: boolean | undefined): URL {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw configurationError('Assisted Profile agent URL is invalid');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw configurationError('Assisted Profile agent URL must use http or https');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw configurationError('Assisted Profile agent URL must not contain credentials');
  }

  // URL.search/hash are empty for a bare trailing delimiter, so inspect the
  // configured representation as well to reject every query/hash form.
  if (rawUrl.includes('?') || rawUrl.includes('#')) {
    throw configurationError('Assisted Profile agent URL must not contain a query or fragment');
  }

  if (url.protocol === 'http:' && allowInsecureHttp !== true) {
    throw configurationError(
      'HTTP transport for the Assisted Profile agent requires allowInsecureHttp=true',
    );
  }

  return url;
}

function loadCustomCa(
  caFile: string | null | undefined,
  baseDirectory: string | undefined,
  protocol: string,
): Buffer | undefined {
  const normalizedCaFile = caFile?.trim();
  if (!normalizedCaFile) {
    return undefined;
  }

  if (protocol !== 'https:') {
    throw configurationError('A custom CA can only be configured for HTTPS agent transport');
  }

  const resolvedCaFile = resolve(baseDirectory ?? process.cwd(), normalizedCaFile);
  let ca: Buffer;

  try {
    if (!statSync(resolvedCaFile).isFile()) {
      throw new Error('not a regular file');
    }
    ca = readFileSync(resolvedCaFile);
  } catch {
    throw configurationError(`Assisted Profile agent CA file is not readable: ${resolvedCaFile}`);
  }

  if (ca.length === 0) {
    throw configurationError(`Assisted Profile agent CA file is empty: ${resolvedCaFile}`);
  }

  try {
    const pem = ca.toString('utf8');
    const certificatePattern = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
    const certificates = pem.match(certificatePattern);
    if (!certificates || certificates.length === 0) {
      throw new Error('no certificate PEM block');
    }
    if (pem.replace(certificatePattern, '').trim().length > 0) {
      throw new Error('unexpected content outside certificate PEM blocks');
    }
    for (const certificate of certificates) {
      new X509Certificate(certificate);
    }

    // Node's TLS parser is the final authority for the exact CA representation
    // that the production HTTPS agent will receive.
    createSecureContext({ ca });
  } catch {
    throw configurationError(`Assisted Profile agent CA file is not valid PEM: ${resolvedCaFile}`);
  }

  return ca;
}

/**
 * Resolves already-loaded application configuration into the immutable values
 * used by AgentHttpClient. Environment access deliberately stays outside this
 * module so Convict remains the application's single configuration authority.
 */
export function resolveAgentHttpClientConfiguration(
  input: AgentHttpClientConfigurationInput,
): AgentHttpClientConfiguration {
  if (!input || typeof input !== 'object') {
    throw configurationError('Assisted Profile agent configuration must be defined');
  }

  const rawUrl = requiredNonEmptyString(input.url, 'Assisted Profile agent URL');
  const apiKey = validApiKey(input.apiKey);
  const baseUrl = parseAgentUrl(rawUrl, input.allowInsecureHttp);
  const connectTimeoutMs = positiveIntegerTimeout(
    input.connectTimeoutMs,
    DEFAULT_AGENT_CONNECT_TIMEOUT_MS,
    'Assisted Profile agent connect timeout',
  );
  const readTimeoutMs = positiveIntegerTimeout(
    input.readTimeoutMs,
    DEFAULT_AGENT_READ_TIMEOUT_MS,
    'Assisted Profile agent read timeout',
  );
  const ca = loadCustomCa(input.caFile, input.baseDirectory, baseUrl.protocol);
  const endpoint = new URL('/generate', baseUrl);

  return {
    endpoint,
    endpointIdentifier: endpoint.href,
    apiKey,
    connectTimeoutMs,
    readTimeoutMs,
    ca,
  };
}
