/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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


var express = require('express');
var router = express.Router();

var dateFormat = require('dateformat');

const utilsModel = require('../../utils/utils');
const backupModel = require('../../models/backup/backup');

/**
 * @api {POST} /backup Full system backup
 * @apiName NewBackup
 *  * @apiGroup BACKUP
 * 
 * @apiDescription Create a new full system backup.
 * If all goes fine in the response you will get the id of the new backup.
 * This backup id has the format: YYYY-mm-dd_HH:MM:SS
 * 
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": "2020-01-14_12:30:45"
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1008,
 * 	 "msg":	"You are not an admin user"
 * }
 */
router.post('/', async (req, res) => {
	try {
    // Generate the id for the new backup.
    const backupId=dateFormat(new Date(), "yyyy-mm-dd_HH:MM:ss");

    // Create the backup directory.
    await utilsModel.createBackupDataDir(backupId);

    // Database dump to a file.
    await backupModel.databaseDump(backupId);

    // Copy of the data directories.
    await backupModel.copyDataDirs(backupId);

    res.status(200).json({backupId: backupId});
	} catch(error) { res.status(400).json(error) }
});


/**
 * @api {PUT} /backup/get Get list of all full system backups
 * @apiName GetBackups
 *  * @apiGroup BACKUP
 * 
 * @apiDescription Get the id list of all full system backups.
 * 
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * ["2020-01-14_12:30:45", "2020-01-14_13:01:04"]
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1008,
 * 	 "msg":	"You are not an admin user"
 * }
 */
router.put('/get', async (req, res) => {
	try {
    // Get list of available backups.
    const backupIdList = await backupModel.getList();
          
    res.status(200).json(backupIdList);
	} catch(error) { res.status(400).json(error) }
});


/**
 * @api {PUT} /backup/del Delete full system backup
 * @apiName DelBackup
 *  * @apiGroup BACKUP
 * 
 * @apiDescription Delete the full system backup with the ID specified in the body request.
 * 
 * @apiParam {String} backup Identifier of the backup that we want to remove.
 * 
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1008,
 * 	 "msg":	"You are not an admin user"
 * }
 */
router.put('/del', async (req, res) => {
	try {
    // Delete backup.
    await backupModel.delete(req);
          
    res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;
