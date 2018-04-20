
//Create New objet with data ipobj_g
function ipobj_g_Data(data) {
    this.id = data.id;
    this.name = data.name;
    this.comment = data.comment;
    this.type = data.type;
    this.fwcloud = data.fwcloud;
    this.id_node = data.id_node;
    this.id_parent_node = data.id_parent_node;
    try {
        this.fwcloud_tree = data.fwcloud_tree;
    } catch (err) {
        this.fwcloud_tree = data.fwcloud;
    }
    this.ipobjs = [];

}
;



//Export the object
module.exports = ipobj_g_Data;
