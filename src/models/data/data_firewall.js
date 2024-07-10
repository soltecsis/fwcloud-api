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

//Create New objet with data firewall
function firewalls_Data(data) {
  this.id = data.id;
  this.firewall = data.firewall;
  this.cluster = data.cluster;
  this.name = data.name;
  this.comment = data.comment;
  this.status = data.status;
  this.install_user = data.install_user;
  this.install_pass = data.install_pass;
  this.install_protocol = data.install_protocol;
  this.install_communication = data.install_communication;
  this.install_apikey = data.install_apikey;
  this.save_user_pass = data.save_user_pass;
  this.install_interface = data.install_interface;
  this.install_ipobj = data.install_ipobj;
  this.fwmaster = data.fwmaster;
  this.install_port = data.install_port;
  this.interface_name = data.interface_name;
  this.ip_name = data.ip_name;
  this.ip = data.ip;
  this.options = data.options;
  this.compiled_at = data.compiled_at;
  this.installed_at = data.installed_at;
}

//Export the object
module.exports = firewalls_Data;
