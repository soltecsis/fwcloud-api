//create object


function fwc_tree_node(node_data) {
	try {
		this.id = node_data.id;
		this.text = node_data.name;
		this.pid = node_data.id_parent;
		this.allowdrag = 0;
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

