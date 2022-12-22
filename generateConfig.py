try:
    import mysql.connector
except:
    print("This script requires the mysql-connector-python, install it using \npython3 -m pip install mysql-connector-python")
    exit(0)
import os
host = input("Enter the mysql hostname: ")
user = input("Enter the mysql username: ")
password = input("Enter the mysql password for user " + user + ": ")
port = input("Enter mysql socket (leave blank for /var/run/mysqld/mysqld.sock): ")
if(not(port)):
    port = "/var/lib/mysqld/mysqld.sock"
database = input("Enter the name for the new dRive database: ")
downloaddir = input("Enter the location that user files are saved: ")
cert = input("Enter SSL certificate location (leave blank for no https): ") 
key = ""
if cert:
    key = input("Enter SSL private key location: ") 
if(downloaddir[0]!='/'):
    downloaddir = '/'+downloaddir
os.makedirs(downloaddir[1:])
try:
    os.mkdir("tmp")
except:
    pass
try:
    int(port)
except:
    fileContent = "module.exports = {host:\""+host+"\",user:\""+user+"\",password:\""+password+"\",port:\""+port+"\",db:\""+database+"\",downloadDir:\"" + downloaddir+ "\",cert:\"" + cert + "\",key:\"" + key + "\"}"
    with open("config.js","w+") as File:
        File.write(fileContent)
    os.system("npm install bcrypt body-parser cookie-parser express express-fileupload mysql sync-mysql")
    dRiveDB = mysql.connector.connect(host=host,user=user,password=password,unix_socket=port)
    dbCursor = dRiveDB.cursor()
    dbCursor.execute("CREATE DATABASE `" + database + "`")
    dRiveDB = mysql.connector.connect(host=host,user=user,password=password,unix_socket=port,database=database)
    dbCursor = dRiveDB.cursor()
    dbCursor.execute("CREATE TABLE `users` (`uId` INT(20) NOT NULL AUTO_INCREMENT,`uName` VARCHAR(30) NOT NULL,`password` VARCHAR(256),`token` VARCHAR(256),PRIMARY KEY (`uId`));CREATE TABLE `files` (`fId` VARCHAR(256) NOT NULL,`fName` VARCHAR(256),`pUId` INT(20),`pFolder` INT(20),`mimetype` VARCHAR(128), PRIMARY KEY (`fId`));CREATE TABLE `folders` (`fId` INT(20) NOT NULL AUTO_INCREMENT,`fName` VARCHAR(256),`pUId` INT(20),`fShare` VARCHAR(64),`pFolder` INT(20),PRIMARY KEY (`fId`));")
    exit(0)
fileContent = "module.exports = {host:\""+host+"\",user:\""+user+"\",password:\""+password+"\",port:\""+port+"\",db:\""+database+"\",downloadDir:\"" + downloaddir+ "\",cert:\"" + cert + "\",key:\"" + key + "\"}"
with open("config.js","w+") as File:
    File.write(fileContent)
os.system("npm install bcrypt body-parser cookie-parser express express-fileupload mysql sync-mysql")
dRiveDB = mysql.connector.connect(host=host,user=user,password=password,port=int(port))
dbCursor = dRiveDB.cursor()
dbCursor.execute("CREATE DATABASE `" + database + "`")
dRiveDB = mysql.connector.connect(host=host,user=user,password=password,port=int(port),database=database)
dbCursor = dRiveDB.cursor()
dbCursor.execute("CREATE TABLE `users` (`uId` INT(20) NOT NULL AUTO_INCREMENT,`uName` VARCHAR(30) NOT NULL,`password` VARCHAR(256),`token` VARCHAR(256),PRIMARY KEY (`uId`));CREATE TABLE `files` (`fId` VARCHAR(256) NOT NULL,`fName` VARCHAR(256) SET utf8 COLLATE utf8_unicode_ci,`pUId` INT(20),`pFolder` INT(20),`mimetype` VARCHAR(128), PRIMARY KEY (`fId`));CREATE TABLE `folders` (`fId` INT(20) NOT NULL AUTO_INCREMENT,`fName` VARCHAR(256) SET utf8 COLLATE utf8_unicode_ci,`pUId` INT(20),`fShare` VARCHAR(64),`pFolder` INT(20),PRIMARY KEY (`fId`));")
print("Setup Completed! You can now run:\n\tsudo node index.js")
