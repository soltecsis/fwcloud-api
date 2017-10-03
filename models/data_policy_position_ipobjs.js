
//Create New objet with data policy_r
function policy_position_ipobjs_data(data, order, negate, type) {
    this.id = data.id;
    this.name = data.name;
    this.position_order = order;
    this.negate = negate;

    if (type === 'O') {
        this.type = data.type;
        this.fwcloud = data.fwcloud;
        this.interface = data.interface;
        this.protocol = data.protocol;
        this.address = data.address;
        this.netmask = data.netmask;
        this.diff_serv = data.diff_serv;
        this.ip_version = data.ip_version;
        this.code = data.code;
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
    } 
    else if (type === 'I') {
        this.type = data.interface_type;
        this.labelName = data.labelName;
        this.securityLevel = data.securityLevel;
    } 
    else if (type === 'G') {
        this.type = data.type;
    }



}
;



//Export the object
module.exports = policy_position_ipobjs_data;


