//create object


function fwc_tree_node(node_data) {
    this.id = node_data.id;
    this.name= node_data.name;
    this.idparent= node_data.id_parent;
    this.node_order= node_data.node_order;
    this.icon= node_data.node_icon;
    this.allowdrag=0;
    this.expanded= node_data.expanded;
    this.node_type= node_data.node_type;
    this.api_call= node_data.api_call;
    this.obj_type= node_data.obj_type;
    this.id_obj= node_data.id_obj;
    this.node_level= node_data.node_level;

}


//Export the object
module.exports = fwc_tree_node;

