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



//Create New objet with data interface
function interfaces_Data(data) {
    this.id = data.id;
    this.firewall = data.firewall;
    this.name = data.name;
    this.labelName = data.labelName;
    this.type = +data.type;
    this.securityLevel = data.securityLevel;
    this.interface_type = data.interface_type;
    this.comment = data.comment;
    this.id_node = data.id_node;
    this.id_parent_node = data.id_parent_node;
    this.mac = data.mac;
    try {
        this.standard = data.standard;
    } catch (err) {
        this.standard = 0;
    }
    this.ipobjs = [];

};



//Export the object
module.exports = interfaces_Data;
