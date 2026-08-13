/*!
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

import { Matches } from 'class-validator';

const CROWDSEC_COLLECTION_NAME = /^[A-Za-z0-9._-]{1,64}\/[A-Za-z0-9._-]{1,64}$/;

export class CrowdSecCollectionDto {
  @Matches(CROWDSEC_COLLECTION_NAME, { message: 'Invalid CrowdSec collection name' })
  name: string;
}
