//Create New objet with data ipobj
function ipobjs_Data(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.fwcloud = data.fwcloud;
    this.interface = data.interface;
    this.protocol = data.protocol;
    this.address = data.address;
    this.netmask = data.netmask;
    this.diff_serv = data.diff_serv;
    this.ip_version = data.ip_version;
    this.icmp_code = data.icmp_code;
    this.icmp_type = data.icmp_type;
    this.tcp_flags_mask = data.tcp_flags_mask;
    this.tcp_flags_settings = data.tcp_flags_settings;
    this.range_start = data.range_start;
    this.range_end = data.range_end;
    this.source_port_start = data.source_port_start;
    this.source_port_end = data.source_port_end;
    this.destination_port_start = data.destination_port_start;
    this.destination_port_end = data.destination_port_end;
    this.options = data.options;
    this.comment = data.comment;
    this.id_node=data.id_node;
    this.id_parent_node= data.id_parent_node;
}
;

//Export the object
module.exports = ipobjs_Data;


