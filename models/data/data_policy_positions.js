
//Create New objet with data policy_r
   function policy_positions_data (data) {
		this.id= data.id;
		this.name= data.name;
		this.policy_type=data.policy_type;
		this.position_order=data.position_order;
		this.single_object=data.single_object;
		this.content=data.content;
		this.ipobjs=[];
	};



//Export the object
module.exports = policy_positions_data;


