# RaPi-Smarthome
Some private work to create a web-app that can communicate with 433 MHz devices and the Bose SoundTouch speakers.
- `app.js` is the main backend and is handling communication to 433 MHz devices and frontend and DB related actions
- `wecker.js` is the backend for most SoundTouch related actions such as setting an alarm and sleeptimers

# Interesting
- Added a BOSE SoundTouch Alarm system, as these devices are not able to do that themselves.
- Added Device discovery via MDNS

# Install instructions

## Prepare the Raspberry PI
- Install some OS to the SD Card like Raspian
- Setup network access and create a fixed IP
- Connect to the Pi via SSH with `ssh pi@<IP>` (pw: raspberry)
- Now use `sudo apt-get update && sudo apt-get upgrade` to update the PI

## Install NodeJS & NPM
- Download the latest NodeJS file with `wget http://nodejs.org/dist/latest-v4.x/node-v4.4.0-linux-armv7l.tar.gz`
- Unpack the file with `tar -xvf node-v4.4.0-linux-armv7l.tar.gz`
- Change to the directory with `cd node-v4.4.0-linux-armv7l`
- Copy the files to "/usr/local" with `sudo cp -R * /usr/local/`
- Check the version & installation of NodeJS with `node -v`, for me it`s "v4.4.5"
- Check the version & installation of NPM with `npm -v`, for me it`s "2.15.5"

## Install CouchDB
- Use the command `sudo apt-get install couchdb` to install CouchDB 1.4 on the Raspberry Pi (this version is quite old, but enough for our purpose)
- Check the version & installation of CouchDB with `couchdb -V`
- Try to start CouchDB with `sudo couchdb`, it should say something like "Apache CouchDB is running as process <XY>, time to relax."
- If not present anyway, install "curl" on on the Raspberry PI with `sudo apt-get install curl`
- Try to access CouchDB with curl on the PI via: `curl -X GET http://127.0.0.1:5984`, you should get a response like: `{"couchdb":"Welcome","uuid":"10b710bc5d2fa2ed078edc29c30ca4c6","version":"1.4.0","vendor":{"version":"1.4.0","name":"The Apache Software Foundation"}}`
- CouchDB should now be working on your local machine
- ADDITIONAL: If you like to be able to access your database from outside the PI (e.g. dev/test on local machine), use the following steps:
  - Use `sudo nano /etc/couchdb/default.ini` and change `[httpd] port = 5984 bind_address = 127.0.0.1` to `bind_address = 0.0.0.0`
  - Restart CouchDB via `/etc/init.d/couchdb restart`, it should say something like `[ ok ] Restarting couchdb (via systemctl): couchdb.service.`
  - Try `netstat -an | grep 5984`, it should say `tcp        0      0 0.0.0.0:5984            0.0.0.0:*               LISTEN`, instead of `tcp        0      0 127.0.0.1:5984          0.0.0.0:*               LISTEN`
  - Now try to access the database on your Rascurl -xpberry PI from a local machine with `curl -X GET http://<PI-IP>:5984`

## Prepare CouchDB
- Go to the file `app.js` and look for "// - CONFIG starts here! -" on line 6
- Change `var couchdbIP = '<IP>';` to the couchDB IP address
- In the "RaPi-Smarthome" Folder, use `chmod +x ./dbsetup/dbsetup.sh` to make the file executable
- Run `./dbsetup/dbsetup.sh` and follow the installation process
