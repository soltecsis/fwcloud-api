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


//create object
function fwc_tree_node(node_data) {
	try {
		this.id = node_data.id;
		this.text = node_data.name;
		this.pid = node_data.id_parent;
		this.node_type = node_data.node_type;
		this.obj_type = node_data.obj_type;
		this.id_obj = node_data.id_obj;
		this.fwcloud = node_data.fwcloud;
	} catch (err) {
		// Handle the error here.
	}
}

//Export the object
module.exports = fwc_tree_node;

