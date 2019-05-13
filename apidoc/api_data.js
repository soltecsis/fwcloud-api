define({ "api": [
  {
    "type": "PUT",
    "url": "/customer/del",
    "title": "Delete customer",
    "name": "DelCustomer",
    "group": "CUSTOMER",
    "description": "<p>Delete customer from the database. <br>A middleware is used for verify that the customer has no users before allow the deletion.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Customer's id.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 1\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1002,\n  \"msg\": \"Not found\"\n}",
          "type": "json"
        },
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 403 Forbidden\n{\n   \"result\": true,\n   \"restrictions\": {\n       \"CustomerHasUsers\": true\n   }\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/customer.js",
    "groupTitle": "CUSTOMER"
  },
  {
    "type": "PUT",
    "url": "/customer/restricted",
    "title": "Restrictions for customer deletion",
    "name": "DelCustomer",
    "group": "CUSTOMER",
    "description": "<p>Check that there are no restrictions for customer deletion.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Customer's id.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 10\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 403 Forbidden\n{\n   \"result\": true,\n   \"restrictions\": {\n       \"CustomerHasUsers\": true\n   }\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/customer.js",
    "groupTitle": "CUSTOMER"
  },
  {
    "type": "PUT",
    "url": "/customer/get",
    "title": "Get customer data",
    "name": "GetCustomer",
    "group": "CUSTOMER",
    "description": "<p>Get customer data.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": true,
            "field": "customer",
            "description": "<p>Id of the customer. <br>If empty, the API will return an array with the id and name for all the customers. <br>If it is not empty, it will return a json object with all the data for the indicated customer id.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n\t\"customer\": 2\n}",
          "type": "json"
        },
        {
          "title": "Request-Example:",
          "content": "{\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n{\n   \"id\": 2,\n   \"name\": \"FWCloud.net\",\n   \"addr\": \"C/Carrasca, 7 - 03590 Altea (Alicante) - Spain\",\n   \"phone\": \"+34 966 446 046\",\n   \"email\": \"info@fwcloud.net\",\n   \"web\": \"https://fwcloud.net\",\n   \"created_at\": \"2019-05-13T10:40:36.000Z\",\n   \"updated_at\": \"2019-05-13T10:40:36.000Z\",\n   \"created_by\": 0,\n   \"updated_by\": 0\n}",
          "type": "json"
        },
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n[\n   {\n       \"id\": 1,\n       \"name\": \"SOLTECSIS, S.L.\"\n   },\n   {\n       \"id\": 2,\n       \"name\": \"FWCloud.net\"\n   }\n]",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1002,\n  \"msg\": \"Not found\"\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/customer.js",
    "groupTitle": "CUSTOMER"
  },
  {
    "type": "POST",
    "url": "/customer",
    "title": "New customer",
    "name": "NewCustomer",
    "group": "CUSTOMER",
    "description": "<p>Create new customer. Customers allow group users.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": true,
            "field": "customer",
            "description": "<p>New customer's id. <br>The API will check that don't exists another customer with this id.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Customer's name. <br>The API will check that don't exists another customer with the same name.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "addr",
            "description": "<p>Customer's address.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "phone",
            "description": "<p>Customer's telephone.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "email",
            "description": "<p>Customer's e-mail.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "web",
            "description": "<p>Customer's website.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 1,\n  \"name\": \"FWCloud.net\",\n  \"addr\": \"C/Carrasca, 7 - 03590 Altea (Alicante) - Spain\",\n  \"phone\": \"+34 966 446 046\",\n  \"email\": \"info@fwcloud.net\",\n  \"web\": \"https://fwcloud.net\"\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1004,\n  \"msg\": \"Already exists with the same id\"\n}",
          "type": "json"
        },
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1005,\n  \"msg\": \"Already exists with the same name\"\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/customer.js",
    "groupTitle": "CUSTOMER"
  },
  {
    "type": "PUT",
    "url": "/customer",
    "title": "Update customer",
    "name": "UpdateCustomer",
    "group": "CUSTOMER",
    "description": "<p>Update customer's information.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": true,
            "field": "customer",
            "description": "<p>Id of the customer that you want modify.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Customer's name. <br>The API will check that don't exists another customer with the same name.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "addr",
            "description": "<p>Customer's address.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "phone",
            "description": "<p>Customer's telephone.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "email",
            "description": "<p>Customer's e-mail.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "web",
            "description": "<p>Customer's website.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 2,\n  \"name\": \"FWCloud.net\",\n  \"addr\": \"C/Carrasca, 7 - 03590 Altea (Alicante) - Spain\",\n  \"phone\": \"+34 966 446 046\",\n  \"email\": \"info@fwcloud.net\",\n  \"web\": \"https://www.fwcloud.net\"\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1002,\n  \"msg\": \"Not found\"\n}",
          "type": "json"
        },
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1005,\n  \"msg\": \"Already exists with the same name\"\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/customer.js",
    "groupTitle": "CUSTOMER"
  },
  {
    "type": "PUT",
    "url": "/user/del",
    "title": "Delete user",
    "name": "DelCustomer",
    "group": "USER",
    "description": "<p>Delete user from the database. <br>A middleware is used for verify that this is not the last user with the admin role in the database.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Id of the customer the user belongs to.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "user",
            "description": "<p>Id of the user.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 10\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n{\n    \"response\": {\n        \"respStatus\": true,\n        \"respCode\": \"ACR_OK\",\n        \"respCodeMsg\": \"Ok\",\n        \"respMsg\": \"User deleted\",\n        \"errorCode\": \"\",\n        \"errorMsg\": \"\"\n    },\n    \"data\": {}\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "PUT",
    "url": "/user/get",
    "title": "Get user data",
    "name": "GetUser",
    "group": "USER",
    "description": "<p>Get user data.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Id of the customer the user belongs to.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": true,
            "field": "user",
            "description": "<p>Id of the user. <br>If empty, the API will return the id and name for all the users of this customer.. <br>If it is not empty, it will return all the data for the indicated user.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 10,\n  \"user\": 5\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n{\n    \"response\": {\n        \"respStatus\": true,\n        \"respCode\": \"ACR_OK\",\n        \"respCodeMsg\": \"Ok\",\n        \"respMsg\": \"Customer data sent\",\n        \"errorCode\": \"\",\n        \"errorMsg\": \"\"\n    },\n    \"data\": [\n        {\n            \"id\": 1,\n            \"name\": \"SOLTECSIS, S.L.\",\n            \"addr\": null,\n            \"phone\": null,\n            \"email\": \"info@soltecsis.com\",\n            \"web\": \"https://soltecsis.com\",\n            \"created_at\": \"2019-05-02T09:13:35.000Z\",\n            \"updated_at\": \"2019-05-02T09:13:35.000Z\",\n            \"created_by\": 0,\n            \"updated_by\": 0\n        }\n    ]\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "POST",
    "url": "/login",
    "title": "Log into the API",
    "name": "LoginUser",
    "group": "USER",
    "description": "<p>Validate the user credentials and initialize data in the session file.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Customert's id to which this user belongs to.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<p>Username for login into the FWCloud.net web interface.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "password",
            "description": "<p>Username's password.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 1,\n  \"username\": \"fwcadmin\",\n  \"password\": \"fwcadmin\"\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 401 Unauthorized\n{\n  \"fwcErr\": 1001,\n  \"msg\": \"Bad username or password\"\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "POST",
    "url": "/logout",
    "title": "Log out the API",
    "name": "LogoutUser",
    "group": "USER",
    "description": "<p>Close a previous created user session.</p>",
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 OK",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "POST",
    "url": "/user",
    "title": "New user",
    "name": "NewUser",
    "group": "USER",
    "description": "<p>Create new user.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Customert id to which this user belongs to. <br>The API will check that exists a customer with this id.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Full name of the owner of this user.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "email",
            "description": "<p>User's e-mail.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<p>Username for login into the FWCloud.net web interface.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "password",
            "description": "<p>Username's password.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "enabled",
            "description": "<p>If the user access is enabled or not.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "role",
            "description": "<p>The role assigned to this user. <br>1 = Admin. Full access. <br>2 = Manager. Cand manage the assigned clouds. Clouds are assigned by an user with admin role.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "allowed_from",
            "description": "<p>Comma separated list of IPs from which the user will be allowed to access to the FWCloud.net web interface.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 10,\n  \"name\": \"My Personal Name\",\n  \"email\": \"info@fwcloud.net\",\n  \"username\": \"fwcloud\",\n  \"password\": \"mysecret\",\n  \"enabled\": 1,\n  \"role\": 1,\n  \"allowed_from\": \"10.99.4.10,192.168.1.1\"\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1003,\n\t \"msg\":\t\"Already exists\"\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "PUT",
    "url": "/user/restricted",
    "title": "Restrictions for user deletion",
    "name": "RestrictedUser",
    "group": "USER",
    "description": "<p>Check that there are no restrictions for user deletion.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Customer's id.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "user",
            "description": "<p>User's id.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 10,\n  \"user\": 5\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n{\n    \"response\": {\n        \"respStatus\": true,\n        \"respCode\": \"ACR_OK\",\n        \"respCodeMsg\": \"Ok\",\n        \"respMsg\": \"\",\n        \"errorCode\": \"\",\n        \"errorMsg\": \"\"\n    },\n    \"data\": {}\n}",
          "type": "json"
        },
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 403 Forbidden\n{\n  \"result\": true,\n  \"restrictions\": {\n    \"CustomerHasUsers\": true\n  }\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "PUT",
    "url": "/user",
    "title": "Update user",
    "name": "UpdateUser",
    "group": "USER",
    "description": "<p>Update user's data.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "user",
            "description": "<p>User id.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "customer",
            "description": "<p>Customert id to which this user belongs to. <br>The API will check that exists a customer with this id.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Full name of the owner of this user.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "email",
            "description": "<p>User's e-mail.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<p>Username for login into the FWCloud.net web interface.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "password",
            "description": "<p>Username's password.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "enabled",
            "description": "<p>If the user access is enabled or not.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "role",
            "description": "<p>The role assigned to this user. <br>1 = Admin. Full access. <br>2 = Manager. Cand manage the assigned clouds. Clouds are assigned by an user with admin role.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "allowed_from",
            "description": "<p>Comma separated list of IPs from which the user will be allowed to access to the FWCloud.net web interface.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"customer\": 10,\n  \"name\": \"My Personal Name\",\n  \"email\": \"info@fwcloud.net\",\n  \"username\": \"fwcloud\",\n  \"password\": \"mysecret\",\n  \"enabled\": 1,\n  \"role\": 1,\n  \"allowed_from\": \"10.99.4.10,192.168.1.1\"\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 400 Bad Request\n{\n  \"fwcErr\": 1002,\n\t \"msg\":\t\"Not found\"\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "POST",
    "url": "/user/fwcloud",
    "title": "Allow a user access to a fwcloud.",
    "name": "UserAccessFwcloud",
    "group": "USER",
    "description": "<p>Allow a user the access to a fwcloud.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "user",
            "description": "<p>User's id.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "fwcloud",
            "description": "<p>FWCloud's id.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"user\": 5,\n  \"fwcloud\": 2\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  },
  {
    "type": "PUT",
    "url": "/user/fwcloud/del",
    "title": "Disable user access to a fwcloud.",
    "name": "UserDisableFwcloud",
    "group": "USER",
    "description": "<p>Disable user access to a fwcloud.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "user",
            "description": "<p>User's id.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "fwcloud",
            "description": "<p>FWCloud's id.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example:",
          "content": "{\n  \"user\": 5,\n  \"fwcloud\": 2\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 204 No Content",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/user.js",
    "groupTitle": "USER"
  }
] });
