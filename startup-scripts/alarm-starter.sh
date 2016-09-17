#!/bin/sh

if [ $(ps aux | grep $USER | grep node | grep -v grep | wc -l | tr -s "\n") -eq 0 ]
then
        export NODE_ENV=production
        export PATH=/usr/local/bin:$PATH
        forever start ~/RaPi-Smarthome/wecker.js -o ~/RaPi-Smarthome/alarmOut.log -e ~/RaPi-Smarthome/alarmErr.log -v  > /dev/null
fi
