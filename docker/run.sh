#!/bin/bash

# In order to mount .env file so can be modified from the host,
# it is moved to its own directory (which it will act as a mount point)
# This must be done the first time.
if [ ! -e /config/.env ]; then
    cp .env.default /config/.env
fi

# And create a symlink to the right place where .env should be present
if [ ! -e .env ]; then
    ln -s /config/.env .env
fi

node fwcli keys:generate 
node fwcli migration:run 
node fwcli migration:data

npm start