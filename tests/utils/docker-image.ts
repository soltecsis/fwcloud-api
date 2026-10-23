/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com

    This file is part of FWCloud (https://fwcloud.net).
    FWCloud is free software under the GNU Affero General Public License v3 or later.
*/

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// CI runners download the base image and Ubuntu packages without a local build cache.
export const DOCKER_IMAGE_BUILD_TIMEOUT = 15 * 60 * 1000;

/** Keep successful builds quiet while retaining diagnostics, including on timeout. */
export async function buildDockerImage(
  image: string,
  context: string,
  timeout: number = DOCKER_IMAGE_BUILD_TIMEOUT,
): Promise<void> {
  try {
    await execFileAsync('docker', ['build', '--progress=plain', '-t', image, context], {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch (error) {
    // Timeout errors must explain which build failed and expose its last progress messages.
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
    const message = `Docker image "${image}" build failed (timeout: ${timeout} ms): ${error.message}`;
    error.message = output && !message.includes(output) ? `${message}\n${output}` : message;
    throw error;
  }
}
