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

import { ArrayMaxSize, IsArray, IsString, Matches } from 'class-validator';
import { CROWDSEC_COLLECTION_NAME } from './collection.dto';

export class CrowdSecCollectionAcquisitionQueryDto {
  @Matches(CROWDSEC_COLLECTION_NAME, { message: 'Invalid CrowdSec collection name' })
  name: string;
}

export class CrowdSecCollectionAcquisitionUpdateDto {
  @Matches(CROWDSEC_COLLECTION_NAME, { message: 'Invalid CrowdSec collection name' })
  name: string;

  @IsArray()
  @ArrayMaxSize(256)
  @IsString({ each: true })
  log_paths: string[];
}
