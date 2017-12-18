
//Create New objet with data policy_r
   function policy_rData (data) {
        this.id= data.id;
        this.idgroup= data.idgroup;
        this.group_name=data.group_name;
        this.firewall= data.firewall;        
        this.rule_order= data.rule_order;        
        this.action= data.action;
        this.time_start= data.time_start;
        this.time_end= data.time_end;
        this.active= data.active;
        this.options= data.options;
        this.comment= data.comment;
        this.type= data.type;
        this.positions=[];
        
    };



//Export the object
module.exports = policy_rData;


