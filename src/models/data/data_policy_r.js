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



//Create New objet with data policy_r
   function policy_rData (data) {
        this.id= data.id;
        this.idgroup= data.idgroup;
        this.group_name=data.group_name;
        this.group_style=data.group_style;
        this.firewall= data.firewall;        
        this.rule_order= data.rule_order;        
        this.action= data.action;
        this.time_start= data.time_start;
        this.time_end= data.time_end;
        this.active= data.active;
        this.options= data.options;
        this.comment= data.comment;
        this.type= data.type;
        this.style= data.style;
        this.updated_at=data.updated_at;
        this.compiled_at=data.c_updated_at;
        this.rule_compiled=data.rule_compiled;
        this.fw_apply_to= data.fw_apply_to;
        
        
        this.positions=[];
        
    };



//Export the object
module.exports = policy_rData;


