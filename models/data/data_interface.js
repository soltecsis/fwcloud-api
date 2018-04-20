
//Create New objet with data interface
function interfaces_Data(data) {
    this.id = data.id;
    this.firewall = data.firewall;
    this.name = data.name;
    this.labelname = data.labelName;
    this.type = data.type;
    this.securityLevel = data.securityLevel;
    this.interface_type = data.interface_type;
    this.comment = data.comment;
    this.id_node = data.id_node;
    this.id_parent_node = data.id_parent_node;
    try {
        this.standard = data.standard;
    } catch (err) {
        this.standard = 0;
    }
    this.ipobjs = [];

}
;



//Export the object
module.exports = interfaces_Data;
