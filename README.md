# BonVoyage: Peace Corps Leave Request Application

[![Build Status](https://travis-ci.org/peacecorps/BonVoyage.svg?branch=master)](https://travis-ci.org/peacecorps/BonVoyage)
[![Coverage Status](https://coveralls.io/repos/github/peacecorps/BonVoyage/badge.svg?branch=master)](https://coveralls.io/github/peacecorps/BonVoyage?branch=master)

BonVoyage is a web application built to provide a simplified and automated web-based method for Peace Corps volunteers to request leave.

![Demo Image](https://raw.githubusercontent.com/peacecorps/BonVoyage/master/.github/submission_form.png)


This project is currently in development under Patrick Choquette and Project Delta.

Peace Corps: [peacecorps.gov](https://www.peacecorps.gov/)

Project Delta: [projectdelta.io](https://projectdelta.io/)

### Peace Corps Team:
- Patrick Choquette

### Development Team:
- Albert Zhang
- Ben Chang
- Edwin Tan

### Project Delta Team:
- Colin King
- Hiroshi Furuya
- Sean Bae

# Tech Stack Overview
This project is built on top of [Node.JS](https://nodejs.org/) and uses the [Express.JS](http://expressjs.com/) web application framework. The leave request data is stored in a NoSQL database, [MongoDB](https://www.mongodb.org), and we use [Mongoose](http://mongoosejs.com/) to manage our database schemas. We use [Jade](http://jade-lang.com/) as an HTML pre-processor and [SASS](http://jade-lang.com/) as a CSS pre-processor. [Gulp](http://gulpjs.com/) automates the process of linting and pre-processing. Our service sends emails via [Mailgun](http://www.mailgun.com/) and SMS messages via [Twilio](https://www.twilio.com/). The website is hosted on [Heroku](https://www.heroku.com).

# Set up
Below is a tutorial on how to set up this web site to run locally.

### Dependencies
Vagrant will be used to create a development environment where this web site can be run separated from your computer. In order to use Vagrant, you will also need to have installed VirtualBox.

1) Install Virtualbox 5 [here](https://www.virtualbox.org/).

2) Install Vagrant using an installer [here](http://www.vagrantup.com/downloads).

### Setting up our development environment
The rest of this tutorial will be completed on the command line. Open a new terminal window.

1) Clone the project from GitHub.
```bash
git clone https://github.com/peacecorps/BonVoyage.git
cd BonVoyage
```
2) Using Vagrant, create a new virtual machine (VM) with Ubuntu 14.04 and start it. The VM is already configured in the Vagrantfile, so all you have to do is tell Vagrant to start.
```bash
vagrant up
```
3) SSH in to the new VM you just created.
```bash
vagrant ssh
```
4) You are now in a new shell within the VM. Any commands that you run will be executed on the VM. First, we need to update the packages installed on the VM.
```bash
sudo apt-get update
```
5) This web application is built using Node.js, so we need to install a version of Node and NPM (Node package manager). We will use NVM (Node version manager). So first install NVM and then reload the shell's profile to load NVM into your current shell.
```bash
touch ~/.profile
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.28.0/install.sh | bash
echo 'source ~/.profile;' >> ~/.bash_profile
source ~/.bash_profile
```
6) NVM is now installed (check by running 'nvm --version'). Now install the most stable version of Node using NVM and set it to be the default version of Node.
```bash
nvm install stable
nvm alias default stable
```
### Setting up the BonVoyage site
7) Next we will install GIT.
```bash
sudo apt-get -y install git
```
8) Now move into the BonVoyage directory, which has already been set up to be shared with the Vagrant instance.
```bash
cd BonVoyage
```
9) Install all the necessary Node modules.
```bash
npm install
```
<!-- 10) Before we can run the server, you need to forward port 3000 (the port where the node server runs from) to your host. Exit the shell and edit the Vagrantfile in a text editor (which is created when you ran 'vagrant init').
```bash
exit
# Edit the Vagrantfile with vim, or a normal text editor
vim Vagrantfile
```
Find the line that says:
```bash
  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  # config.vm.network "forwarded_port", guest: 80, host: 8080
```
and change the last line to forward port 3000 on the guest machine (the VM) to port 8080 on your host. Comment out the configuration line.
```bash
  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  config.vm.network "forwarded_port", guest: 3000, host: 8080
```
Save this file and reload your VM. SSH back into the VM after it reloads.
```bash
vagrant reload
vagrant ssh
``` -->
10) Install MongoDB. You will need to get the download link for Ubuntu 14.04 from [here](https://www.mongodb.org/downloads#production). Replace the link below with the most recent stable version of MongoDB.
```bash
wget https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu1404-3.2.0.tgz
tar -zxvf mongodb-linux-x86_64-ubuntu1404*.tgz
mkdir ~/mongodb
cp -R -n mongodb-linux-x86_64*/* ~/mongodb
rm -rf mongodb-linux-x86_64-ubuntu1404*
echo 'export PATH="$HOME/mongodb/bin:$PATH";' >> ~/.bash_profile
source ~/.bash_profile
sudo mkdir -p /data/db
sudo chown -R $USER /data/db
// Start mongo's daemon in another terminal window
mongod
```
11) You are all set. Navigate back to the node folder and start the application.
```bash
cd BonVoyage
npm start
```
12) Open a web browser and navigate to [localhost:8080](http://localhost:8080).

# Other

I would recommend that you install `nodemon` to reload the app whenever code is saved.
```
npm install -g nodemon
cd BonVoyage
nodemon
```

Set up GIT to work properly on Vagrant.

```
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
// Cache your GitHub logins
git config --global credential.helper cache
git config --global push.default simple
```
