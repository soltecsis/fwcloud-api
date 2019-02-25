
//Create New objet with data policy_r
function policy_position_ipobjs_data(data, order, negate, type) {
	this.id = data.id;
	this.name = data.name;
	this.position_order = order;
	this.negate = negate;
	this.fwcloud = data.fwcloud;
	this.comment = data.comment;

	if (type === 'O') {
		this.type = data.type;
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
		this.icmp_type = data.icmp_type;
		this.icmp_code = data.icmp_code;
		if (data.type===5) {// ADDRESS
			this.firewall_id = data.firewall_id;
			this.firewall_name = data.firewall_name;
			this.cluster_id = data.cluster_id;
			this.cluster_name = data.cluster_name;
			this.host_id = data.host_id;
			this.host_name = data.host_name;
		}
	} else if (type === 'I') {
		this.type = data.interface_type;
		this.labelName = data.labelName;

		if (data.interface_type===10 || data.interface_type===11) { // Interfac de firewall o interfaz de host
			this.firewall_id = data.firewall_id;
			this.firewall_name = data.firewall_name;
			this.cluster_id = data.cluster_id;
			this.cluster_name = data.cluster_name;
			this.host_id = data.host_id;
			this.host_name = data.host_name;
		}
	} else if (type === 'G') {
		this.type = data.type;
	} else if (type === 'VPN') {
		this.type = 311;
		this.name = data.cn;
		this.address = data.address;
	} else if (type === 'PRE') {
		this.type = 401;
		this.openvpn = data.openvpn;
		this.firewall_name = data.firewall_name;
		this.cluster_name = data.cluster_name;
		this.cn = data.cn;
	}
};

//Export the object
module.exports = policy_position_ipobjs_data;


