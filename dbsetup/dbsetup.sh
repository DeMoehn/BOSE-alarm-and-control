#!/bin/bash
# This script will setup your CouchDB with the needed databses and vies
BLUE='\033[1;36m'
NC='\033[0m\n' # No Color

printf "${BLUE}Enter the CouchDB IP (without http:// & port!), followed by [ENTER]:${NC}"
read couchdb
DBIP="http://$couchdb:5984"
printf "${BLUE}Your CouchDB is located at $DBIP${NC}"
printf "${BLUE}- Starting preparation -${NC}"

# DB Setup
printf "${BLUE}-- Checking CouchDB Instance --${NC}"
curl -X GET $DBIP
printf "${BLUE}-- Creating database /homeautomation --${NC}"
curl -X PUT "$DBIP/homeautomation"
printf "${BLUE}-- Checking database /homeautomation --${NC}"
curl -X GET "$DBIP/homeautomation"
printf "${BLUE}-- Creating database /bosealarms --${NC}"
curl -X PUT "$DBIP/bosealarms"
printf "${BLUE}-- Checking database /bosealarms --${NC}"
curl -X GET "$DBIP/bosealarms"

# View Creation
printf "${BLUE}-- Creating view 'show' in /homeautomation --${NC}"
curl -X PUT "$DBIP/homeautomation/_design/show" -d @dbsetup/views/show.json -H 'Content-Type: application/json'
printf "${BLUE}-- Checking view 'show' in /homeautomation --${NC}"
curl -X GET "$DBIP/homeautomation/_design/show"
printf "${BLUE}-- Creating view 'alarms' in /bosealarms --${NC}"
curl -X PUT "$DBIP/bosealarms/_design/alarms" -d @dbsetup/views/alarms.json -H 'Content-Type: application/json'
printf "${BLUE}-- Checking view 'alarms' in /bosealarms --${NC}"
curl -X GET "$DBIP/bosealarms/_design/alarms"

# END
printf "${BLUE}- CouchDB setup finished! -${NC}"
