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

import * as http from 'http';
import * as https from 'https';
import type { Socket } from 'net';
import type { TLSSocket } from 'tls';
import { TextDecoder } from 'util';
import { AgentHttpTransportFailure } from './agent-http.types';
import type {
  AgentHttpTransport,
  AgentHttpTransportFailureKind,
  AgentHttpTransportRequest,
  AgentHttpTransportResponse,
} from './agent-http.types';

export const DEFAULT_AGENT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export interface NodeAgentHttpTransportOptions {
  /** A deployment-specific certificate authority. System trust remains the default. */
  ca?: string | Buffer;
  maxResponseBytes?: number;
}

const TLS_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_REVOKED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_TLS_HANDSHAKE_TIMEOUT',
  'ERR_TLS_INVALID_PROTOCOL_METHOD',
  'ERR_TLS_PROTOCOL_VERSION_CONFLICT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Direct Node HTTP transport for agent traffic.
 *
 * Native agents deliberately avoid proxy-environment discovery and redirect
 * handling. HTTPS verification cannot be disabled; callers may only add a CA.
 */
export class NodeAgentHttpTransport implements AgentHttpTransport {
  private readonly httpAgent: http.Agent;
  private readonly httpsAgent: https.Agent;
  private readonly maxResponseBytes: number;

  public constructor(options: NodeAgentHttpTransportOptions = {}) {
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_AGENT_MAX_RESPONSE_BYTES;

    if (!isPositiveInteger(this.maxResponseBytes)) {
      throw new RangeError('Agent maximum response size must be a positive integer.');
    }

    this.httpAgent = new http.Agent({ keepAlive: true });
    this.httpsAgent = new https.Agent({
      ca: options.ca,
      keepAlive: true,
      rejectUnauthorized: true,
    });
  }

  public request(input: AgentHttpTransportRequest): Promise<AgentHttpTransportResponse> {
    if (input.url.protocol !== 'http:' && input.url.protocol !== 'https:') {
      return Promise.reject(this.failure('unknown', false));
    }

    if (!isPositiveInteger(input.connectTimeoutMs) || !isPositiveInteger(input.readTimeoutMs)) {
      return Promise.reject(this.failure('unknown', false));
    }

    if (input.signal?.aborted === true) {
      return Promise.reject(this.failure('cancelled', false));
    }

    return new Promise<AgentHttpTransportResponse>((resolve, reject) => {
      const secure = input.url.protocol === 'https:';
      let clientRequest: http.ClientRequest | undefined;
      let response: http.IncomingMessage | undefined;
      let assignedSocket: Socket | TLSSocket | undefined;
      let connectTimer: NodeJS.Timeout | undefined;
      let readTimer: NodeJS.Timeout | undefined;
      let tcpConnected = false;
      let established = false;
      let settled = false;

      const clearTimers = (): void => {
        if (connectTimer !== undefined) {
          clearTimeout(connectTimer);
          connectTimer = undefined;
        }
        if (readTimer !== undefined) {
          clearTimeout(readTimer);
          readTimer = undefined;
        }
      };

      const removeSocketListeners = (): void => {
        if (secure) {
          assignedSocket?.removeListener('connect', markTcpConnected);
          (assignedSocket as TLSSocket | undefined)?.removeListener(
            'secureConnect',
            markEstablished,
          );
        } else {
          assignedSocket?.removeListener('connect', markEstablished);
        }
      };

      const cleanup = (): void => {
        clearTimers();
        removeSocketListeners();
        input.signal?.removeEventListener('abort', handleAbort);
      };

      const fail = (kind: AgentHttpTransportFailureKind, mayHaveReached: boolean): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        response?.destroy();
        clientRequest?.destroy();
        reject(this.failure(kind, mayHaveReached));
      };

      const succeed = (result: AgentHttpTransportResponse): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(result);
      };

      function markTcpConnected(): void {
        tcpConnected = true;
      }

      function markEstablished(): void {
        if (established || settled) {
          return;
        }

        tcpConnected = true;
        established = true;
        if (connectTimer !== undefined) {
          clearTimeout(connectTimer);
          connectTimer = undefined;
        }

        readTimer = setTimeout(() => {
          fail('read_timeout', true);
        }, input.readTimeoutMs);
        readTimer.unref?.();
      }

      function handleAbort(): void {
        fail('cancelled', established);
      }

      const handleSocket = (socket: Socket): void => {
        assignedSocket = socket;

        if (!secure) {
          if (socket.connecting) {
            socket.once('connect', markEstablished);
          } else {
            markEstablished();
          }
          return;
        }

        const tlsSocket = socket as TLSSocket;
        if (tlsSocket.connecting) {
          tlsSocket.once('connect', markTcpConnected);
        } else {
          markTcpConnected();
        }

        if (tlsSocket.connecting || !tlsSocket.authorized) {
          tlsSocket.once('secureConnect', markEstablished);
        } else {
          // A non-connecting TLS socket was obtained from this transport's agent.
          markEstablished();
        }
      };

      const handleResponse = (incoming: http.IncomingMessage): void => {
        response = incoming;
        // This is also a fallback for a reused socket where no connection event
        // was observable by this request.
        markEstablished();

        const status = incoming.statusCode;
        if (status === undefined) {
          fail('invalid_http_response', true);
          return;
        }

        const chunks: Buffer[] = [];
        let byteLength = 0;

        incoming.on('data', (chunk: Buffer | string) => {
          if (settled) {
            return;
          }

          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          byteLength += bytes.length;
          if (byteLength > this.maxResponseBytes) {
            fail('invalid_http_response', true);
            return;
          }
          chunks.push(bytes);
        });

        incoming.once('aborted', () => {
          fail('invalid_http_response', true);
        });

        incoming.once('error', () => {
          fail('invalid_http_response', true);
        });

        incoming.once('end', () => {
          if (!incoming.complete) {
            fail('invalid_http_response', true);
            return;
          }

          let body: string;
          try {
            body = UTF8_DECODER.decode(Buffer.concat(chunks, byteLength));
          } catch {
            // Keep raw bytes out of errors and logs. On HTTP success this safe
            // non-JSON representation is rejected and audited by API-1.
            body = '';
          }

          succeed({
            body,
            headers: incoming.headers,
            status,
          });
        });

        incoming.once('close', () => {
          if (!settled && !incoming.complete) {
            fail('invalid_http_response', true);
          }
        });
      };

      const handleRequestError = (error: Error): void => {
        if (settled) {
          return;
        }

        const code = this.errorCode(error);
        if (input.signal?.aborted === true || code === 'ABORT_ERR') {
          fail('cancelled', established);
          return;
        }
        if (code?.startsWith('HPE_') === true) {
          fail('invalid_http_response', established);
          return;
        }
        if (secure && !established && (tcpConnected || this.isTlsErrorCode(code))) {
          fail('tls', false);
          return;
        }
        if (!established) {
          fail('connection', false);
          return;
        }

        fail('unknown', true);
      };

      connectTimer = setTimeout(() => {
        if (secure && tcpConnected) {
          fail('tls', false);
        } else {
          fail('connection', false);
        }
      }, input.connectTimeoutMs);
      connectTimer.unref?.();

      input.signal?.addEventListener('abort', handleAbort, { once: true });

      const requestOptions: http.RequestOptions = {
        agent: secure ? this.httpsAgent : this.httpAgent,
        headers: input.headers,
        hostname: this.hostnameWithoutIpv6Brackets(input.url.hostname),
        method: input.method,
        path: `${input.url.pathname}${input.url.search}`,
        port: input.url.port || undefined,
        protocol: input.url.protocol,
      };

      try {
        clientRequest = secure
          ? https.request(requestOptions, handleResponse)
          : http.request(requestOptions, handleResponse);
        clientRequest.once('socket', handleSocket);
        clientRequest.once('error', handleRequestError);
        clientRequest.end(input.body);
      } catch (_error) {
        fail('unknown', established);
      }
    });
  }

  public close(): void {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  private failure(
    kind: AgentHttpTransportFailureKind,
    requestMayHaveReachedAgent: boolean,
  ): AgentHttpTransportFailure {
    return new AgentHttpTransportFailure(kind, requestMayHaveReachedAgent);
  }

  private errorCode(error: Error): string | undefined {
    const code = (error as NodeJS.ErrnoException).code;
    return typeof code === 'string' ? code : undefined;
  }

  private isTlsErrorCode(code: string | undefined): boolean {
    return (
      code !== undefined &&
      (TLS_ERROR_CODES.has(code) || code.startsWith('ERR_SSL_') || code.startsWith('ERR_TLS_'))
    );
  }

  private hostnameWithoutIpv6Brackets(hostname: string): string {
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  }
}
