
//Create New objet with data policy_r
   function policy_position_ipobjs_data (data) {
        this.id= data.id;
        this.name= data.name;
        this.type=data.type;        
    };



//Export the object
module.exports = policy_position_ipobjs_data;


