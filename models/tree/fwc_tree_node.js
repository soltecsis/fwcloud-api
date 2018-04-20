//create object


function fwc_tree_node(node_data) {
    try {
        this.id = node_data.id;
        this.text = node_data.name;
        this.pid = node_data.id_parent;
        this.node_order = node_data.node_order;
        this.icon = node_data.node_icon;
        this.allowdrag = 0;
        this.expanded = node_data.expanded;
        this.node_type = node_data.node_type;
        this.api_call = node_data.api_call;
        this.obj_type = node_data.obj_type;
        this.id_obj = node_data.id_obj;
        this.node_level = node_data.node_level;
        this.fwcloud = node_data.fwcloud;
        this.show_action = node_data.show_action;
        this.status_compiled = node_data.status_compiled;
        try {
            this.fwcloud_tree = node_data.fwcloud_tree;
        } catch (err) {
            this.fwcloud_tree = node_data.fwcloud;
        }
    } catch (err) {
        // Handle the error here.

    }
}



//Export the object
module.exports = fwc_tree_node;

