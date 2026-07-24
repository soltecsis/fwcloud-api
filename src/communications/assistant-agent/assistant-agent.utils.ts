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

const MAX_IDENTIFIER_LENGTH = 512;
const SAFE_IDENTIFIER = /^[^\u0000-\u001f\u007f]+$/;

export const NOOP_OBSERVER = Object.freeze({
  record: (): void => undefined,
});

interface ObservationLogger {
  info(message: string): unknown;
  warn(message: string): unknown;
}

interface ObservationLoggerApplication {
  logger(): ObservationLogger;
}

export function createObservationLogger<T>(
  application: ObservationLoggerApplication | null,
  scope: string,
  isWarning: (observation: T) => boolean,
): { record(observation: T): void } {
  if (!application) {
    return NOOP_OBSERVER;
  }

  return {
    record: (observation: T): void => {
      const logger = application.logger();
      const message = `${scope} ${JSON.stringify(observation)}`;
      if (isWarning(observation)) {
        logger.warn(message);
      } else {
        logger.info(message);
      }
    },
  };
}

export function safeAgentIdentifier(value: unknown, forbidden?: string): string | undefined {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    SAFE_IDENTIFIER.test(value) &&
    value !== forbidden
    ? value
    : undefined;
}

export function recordObservationSafely<T>(
  observer: { record(observation: T): void },
  observation: T,
): void {
  try {
    observer.record(observation);
  } catch {
    // Observability must never change request outcome.
  }
}
