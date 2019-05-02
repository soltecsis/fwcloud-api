define({ "api": [
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
            "description": "<p>New customer id. <br>The API will check that don't exists another customer with this id.</p>"
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
          "content": "{\n  \"customer\": 10,\n  \"name\": \"SOLTECSIS, S.L.\",\n  \"addr\": \"C/Carrasca,7 - 03590 Altea (Alicante) - Spain\",\n  \"phone\": \"+34 966 446 046\",\n  \"email\": \"info@soltecsis.com\",\n  \"web\": \"https://soltecsis.com\"\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n{\n  \"response\": {\n    \"respStatus\": true,\n    \"respCode\": \"ACR_OK\",\n    \"respCodeMsg\": \"Ok\",\n    \"respMsg\": \"Customer created\",\n    \"errorCode\": \"\",\n    \"errorMsg\": \"\"\n  },\n  \"data\": {}\n}",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 200 OK\n{\n  \"response\": {\n    \"respStatus\": false,\n    \"respCode\": \"ACR_ALREADY_EXISTS\",\n    \"respCodeMsg\": \"unknown error\",\n    \"respMsg\": \"Customer already exists\",\n    \"errorCode\": \"\",\n    \"errorMsg\": \"\"\n  },\n  \"data\": {}\n}",
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
    "description": "<p>Update customer information.</p>",
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
          "content": "{\n  \"customer\": 10,\n  \"name\": \"SOLTECSIS, S.L.\",\n  \"addr\": \"C/Carrasca,7 - 03590 Altea (Alicante) - Spain\",\n  \"phone\": \"+34 966 446 046\",\n  \"email\": \"info@soltecsis.com\",\n  \"web\": \"https://soltecsis.com\"\n}",
          "type": "json"
        }
      ]
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n{\n  \"response\": {\n    \"respStatus\": true,\n    \"respCode\": \"ACR_OK\",\n    \"respCodeMsg\": \"Ok\",\n    \"respMsg\": \"Customer updated\",\n    \"errorCode\": \"\",\n    \"errorMsg\": \"\"\n  },\n  \"data\": {}\n}",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "Error-Response:",
          "content": "HTTP/1.1 200 OK\n{\n  \"response\": {\n    \"respStatus\": false,\n    \"respCode\": \"ACR_ALREADY_EXISTS\",\n    \"respCodeMsg\": \"unknown error\",\n    \"respMsg\": \"Already exists a customer with the same name\",\n    \"errorCode\": \"\",\n    \"errorMsg\": \"\"\n  },\n  \"data\": {}\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "routes/user/customer.js",
    "groupTitle": "CUSTOMER"
  }
] });
