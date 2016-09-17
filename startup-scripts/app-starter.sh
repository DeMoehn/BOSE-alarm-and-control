#!/bin/sh

if [ $(ps aux | grep $USER | grep node | grep -v grep | wc -l | tr -s "\n") -eq 0 ]
then
        export NODE_ENV=production
        export PATH=/usr/local/bin:$PATH
        forever start ~/RaPi-Smarthome/app.js -o ~/RaPi-Smarthome/out.log -e ~/RaPi-Smarthome/err.log -v  > /dev/null
fi
