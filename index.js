var express = require('express');
var mysql = require('mysql');
var cookieParser = require('cookie-parser');
var path = require('path');
var fileUpload = require("express-fileupload");
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var fs = require('fs');
var https = require('https');
var Mysql = require('sync-mysql');
try{
	var config = require('./config');
} catch {
	console.log("config.js not found, run:\n\tpython3 generateConfig.py");
}

var app = express();
app.use(cookieParser());
app.use(bodyParser());
app.use(fileUpload({createParentPath: true,tempFileDir: "tmp",useTempFiles: true,}));

var fileStorage = __dirname+config.downloadDir;
var con = mysql.createConnection({
	host: config.host,
	user: config.user,
	password: config.password,
	port: config.port,
	database: config.db
});
var conSync = new Mysql({
	host: config.host,
	user: config.user,
	password: config.password,
	port: config.port,
	database: config.db
});

con.connect();

app.get('/favicon.ico', function(req,res){
    res.sendFile(path.join(__dirname+'/src/dRive.ico'));
});

app.get('/', function(req,res){
	if(!req.cookies.token){
		res.sendFile(path.join(__dirname+'/src/index.notloggedin.html'));
		return 0;
	}
	var uId = 0;
	con.query("SELECT * FROM `users` WHERE `token`=?", [req.cookies.token], function (err, result, fields) {
		if(result.length == 0){
			res.sendFile(path.join(__dirname+'/src/index.notloggedin.html'));
			return 0;
		}
		uId = result[0].uId;
		var newToken = crypto.randomBytes(32).toString('hex');
		con.query("UPDATE `users` SET `token`=? WHERE `uId`=?;",[newToken,uId], function(err,result,fields){});
		res.cookie('token', newToken);
		res.write("<script> var uId = " + uId.toString() + ";var uName = \"" + result[0].uName + "\";</script>")
		con.query("SELECT * FROM `files` WHERE `pUId`=? ORDER BY `fName` ASC;",[uId],function(err,result,fields){
			var fList = "<script> var files = {";
			for(let i = 0; i < result.length; i++){
				fList += "\""+result[i].fId + "\": [\"" + result[i].fName + "\", " + result[i].pFolder + "],";
			}
			if(result.length < 1)
				res.write(fList + "}; ");
			else
				res.write(fList.slice(0,-1) + "}; ");
			con.query("SELECT * FROM `folders` WHERE `pUId`=? ORDER BY `fName` ASC;",[uId],function(err,result,fields){
				var FList = "var folders = {";
				for(let i = 0; i < result.length; i++){
					FList += result[i].fId.toString() + ": [\"" + result[i].fName + "\",\"" + result[i].fShare + "\", " + result[i].pFolder + "],";
				}
				if(result.length < 1)
					res.write(FList + "}; ");
				else
					res.write(FList.slice(0,-1) + "}; ");
				res.write("</script>");
				res.write(fs.readFileSync(__dirname+'/src/index.loggedin.html', 'utf8'));
				res.end();
			});
			return 0;
		});
	});
});

function deleteFile(fileId, fileRealName){
	con.query("DELETE FROM `files` WHERE `fId`=? AND `fName`=?",[fileId,fileRealName],function(err,result,field){
		if(!err){
			console.log("Deleting " + fileId);
		} else {
			throw err;
		}
	});
	try{
		fs.unlinkSync(fileStorage+"/"+fileRealName);
	}catch(error){
	}
}

function deleteSelfAndChildren(rootFolder,user){
	console.log("Deleting " + rootFolder.toString() + " Called By User " + user.toString());
	con.query("DELETE FROM `folders` WHERE `fId`=? AND `pUId`=?",[rootFolder,user],function(err,result,field){});
	con.query("SELECT * FROM `files` WHERE `pFolder`=? AND `pUId`=?",[rootFolder,user], function(err,result,field){
		for(let i = 0; i<result.length; i++){
			deleteFile(result[i].fId, result[i].fName);
		}
	});
	con.query("SELECT * FROM `folders` WHERE `pFolder`=? AND `pUId`=?",[rootFolder,user], function(err,result,field){
		for(let i = 0; i<result.length; i++){
			deleteSelfAndChildren(result[i].fId,user);
		}
	});
}

app.post('/deletefile',function(req,res){
	if(!req.body.fileId){
		res.status(400).send("{\"type\":\"error\",\"response\":\"Empty Field(s)\"}");
		return 0;
	} else if(!req.cookies.token){
		res.status(403).send("{\"type\":\"error\",\"response\":\"Not Logged In, Please Try Logging In Again\"}");
		return 0;
	}
	con.query("SELECT * FROM `users` WHERE `token`=?", [req.cookies.token], function (err, result, fields) {
		if(result.length == 0){
			res.status(403).send("{\"type\":\"error\",\"response\":\"Invalid Token, Try Logging In Again\"}");
			return 0;
		}
		con.query("SELECT * FROM `files` WHERE `pUId`=? AND `fId`=?",[result[0].uId,req.body.fileId],function(err,result,fields){
			if(result.length == 0){
				res.status(403).send("{\"type\":\"error\",\"response\":\"You Do Not Own This File Or It Does Not Exist\"}");
				return 0;
			}
			deleteFile(result[0].fId,result[0].fName);
			res.send("{\"type\":\"success\",\"response\":\"Deleted File ID (" + req.body.fileId + ")\"}");
		});
	});
});

app.post('/deletefolder', function(req,res){
	if(!req.body.folderId){
		res.status(400).send("{\"type\":\"error\",\"response\":\"Empty Field(s)\"}");
		return 0;
	} else if(!req.cookies.token){
		res.status(403).send("{\"type\":\"error\",\"response\":\"Not Logged In, Please Try Logging In Again\"}");
		return 0;
	}
	con.query("SELECT * FROM `users` WHERE `token`=?", [req.cookies.token], function (err, result, fields) {
		if(result.length == 0){
			res.status(403).send("{\"type\":\"error\",\"response\":\"Invalid Token, Try Logging In Again\"}");
			return 0;
		}
		con.query("SELECT * FROM `folders` WHERE `pUId`=? AND `fId`=?",[result[0].uId,req.body.folderId],function(err,result,fields){
			if(result.length == 0){
				res.status(403).send("{\"type\":\"error\",\"response\":\"You Do Not Own This Folder Or It Does Not Exist\"}");
				return 0;
			}
			deleteSelfAndChildren(result[0].fId,result[0].pUId);
			res.send("{\"type\":\"success\",\"response\":\"Deleted Folder ID (" + req.body.folderId + ")\"}");
		});
	});
});

app.post('/uploadfiles', async function(req,res){
	if(!req.files){
		res.status(400).send("<h1>No Files Selected</h1>");
		return 0;	
	}
	if(!req.files.files || (req.body.pFId !== 0 && !req.body.pFId)){
		res.status(400).send("<h1>No Files Selected</h1>");
		return 0;
	} else if(!req.cookies.token){
		res.status(403).send("<h1>You Are Not Logged In</h1><p>Try Logging In Again</p>");
		return 0;	
	}
	con.query("SELECT * FROM `users` WHERE `token`=?", [req.cookies.token], async function (err, result, fields) {
		if(result.length == 0){
			res.status(403).send("<h1>Invalid Token</h1><p>Try Logging In Again</p>");
			return 0;
		}
		if(req.body.pFId !== '0'){
			con.query("SELECT * FROM `folders` WHERE `pUId`=? AND `fId`=?",[result[0].uId,req.body.pFId],async function(err,result,fields){
				if(result.length == 0){
					res.status(403).send("{\"type\":\"error\",\"response\":\"You Do Not Own This Folder Or It Does Not Exist\"}");
					return 0;
				}
				res.write("<p id=\"resp\">{\"type\":\"success\",\"response\":\"Successfully uploaded file(s)\",\"data\":{");
				if(!req.files.files.length){
					var fId = crypto.randomBytes(16).toString('hex');
					var path = fileStorage+"/"+fId;
					if(req.files.files.tempFilePath){
						try{
							fs.renameSync(req.files.files.tempFilePath, path)
							con.query("INSERT INTO `files` VALUES(?,?,?,?,?);",[fId,encodeURIComponent(req.files.files.name),result[0].pUId,req.body.pFId,req.files.files.mimetype],function(err,result,fields){});
						}catch{}
					}
					res.write("\""+fId+"\":[\""+encodeURIComponent(req.files.files.name)+"\","+req.body.pFId+"]}}<p>");
					res.end();
					return 0;
				}
				for(var i = 0; i < req.files.files.length; i++){
					var fId = crypto.randomBytes(16).toString('hex');
					var path = fileStorage+"/"+fId;
					if(req.files.files[i].tempFilePath){
						try{
							fs.renameSync(req.files.files[i].tempFilePath, path)
							con.query("INSERT INTO `files` VALUES(?,?,?,?,?);",[fId,encodeURIComponent(req.files.files[i].name),result[0].pUId,req.body.pFId,req.files.files[i].mimetype],function(err,result,fields){});					
						}catch{}
						if(i == req.files.files.length-1){
							res.write("\""+fId+"\":[\""+encodeURIComponent(req.files.files[i].name)+"\","+req.body.pFId+"]");
						} else {
							res.write("\""+fId+"\":[\""+encodeURIComponent(req.files.files[i].name)+"\","+req.body.pFId+"],");
						}
					}
				}
				res.write("}}</p>")
				res.end();
			});
		} else {
			res.write("<p id=\"resp\">{\"type\":\"success\",\"response\":\"Successfully uploaded file(s)\",\"data\":{");
			if(!req.files.files.length){
				var fId = crypto.randomBytes(16).toString('hex');
				var path = fileStorage+"/"+fId;
				if(req.files.files.tempFilePath){
					try{
						fs.renameSync(req.files.files.tempFilePath, path)
						con.query("INSERT INTO `files` VALUES(?,?,?,?,?);",[fId,encodeURIComponent(req.files.files.name),result[0].uId,req.body.pFId,req.files.files.mimetype],function(err,result,fields){if(err)console.log(err);});
					}catch{}
				}
				res.write("\""+fId+"\":[\""+encodeURIComponent(req.files.files.name)+"\","+req.body.pFId+"]}}<p>");
				res.end();
				return 0;
			}
			for(let i = 0; i < req.files.files.length; i++){
				var fId = crypto.randomBytes(16).toString('hex');
				var path = fileStorage+"/"+fId;
				if(req.files.files[i].tempFilePath){
					try{
						fs.renameSync(req.files.files[i].tempFilePath, path)
						con.query("INSERT INTO `files` VALUES(?,?,?,?,?);",[fId,encodeURIComponent(req.files.files[i].name),result[0].uId,req.body.pFId,req.files.files[i].mimetype],function(err,result,fields){});
					}catch{}
					if(i == req.files.files.length-1){
						res.write("\""+fId+"\":[\""+encodeURIComponent(req.files.files[i].name)+"\","+req.body.pFId+"]");
					} else {
						res.write("\""+fId+"\":[\""+encodeURIComponent(req.files.files[i].name)+"\","+req.body.pFId+"],");
					}
				}
			}
			res.write("}}</p>")
			res.end();
		}
	});
});

app.get('/uploadFileUI', function(req,res){
	if(!req.query.pFId){
		res.status(400).send("{\"type\":\"error\",\"response\":\"Empty Field(s)\"}");
		return 0;
	} else if(!req.cookies.token){
		res.status(403).send("<h1>You Are Not Logged In</h1><p>Try Logging In Again</p>");
		return 0;
	}
	con.query("SELECT * FROM `users` WHERE `token`=?", [req.cookies.token], function (err, result, fields) {
		if(result.length == 0){
			res.status(403).send("<h1>Invalid Token</h1><p>Try Logging In Again</p>");
			return 0;
		}
		res.send("<script>var parentFolder="+req.query.pFId+";</script>"+fs.readFileSync(__dirname+'/src/uploadFilesUI.html', 'utf8'));
		return 0;
	});
});

app.post('/createfolder', function(req,res){
	if(!req.body.folderName || (!req.body.folderParent && req.body.folderParent !== 0)){
		res.status(400).send("{\"type\":\"error\",\"response\":\"Empty Field(s)\"}");
		return 0;
	} else if(!req.cookies.token){
		res.status(403).send("{\"type\":\"error\",\"response\":\"Not Logged In, Please Try Logging In Again\"}");
		return 0;
	}
	con.query("SELECT * FROM `users` WHERE `token`=?", [req.cookies.token], function (err, result, fields) {
		if(result.length == 0){
			res.status(403).send("{\"type\":\"error\",\"response\":\"Invalid Token, Try Logging In Again\"}");
			return 0;
		}
		if(req.body.folderParent == 0){
			var share = crypto.randomBytes(10).toString('hex');
			con.query("INSERT INTO `folders`(`fName`,`pUId`,`fShare`,`pFolder`) VALUES (?,?,?,?);",[encodeURIComponent(req.body.folderName),result[0].uId,share,req.body.folderParent], function(err,result,fields){
				con.query("SELECT * FROM `folders` WHERE `fId`=?",[result.insertId],function(err,result,fields){
					res.send("{\"type\":\"success\",\"response\":\"Created Folder Named (" + req.body.folderName + ") Under Folder ID (" + req.body.folderParent + ")\", \"data\": {\"fId\":" + result[0].fId + ", \"fShare\":\"" + result[0].fShare + "\"}}");
				});
			});
		} else {
			con.query("SELECT * FROM `folders` WHERE `pUId`=? AND `fId`=?",[result[0].uId,req.body.folderParent],function(err,result,fields){
				if(result.length == 0){
					res.send("{\"type\":\"error\",\"response\":\"You Do Not Own This Folder Or It Does Not Exist\"}");
					return 0;
				}
				var share = crypto.randomBytes(10).toString('hex');
				con.query("INSERT INTO `folders`(`fName`,`pUId`,`fShare`,`pFolder`) VALUES (?,?,?,?);",[encodeURIComponent(req.body.folderName),result[0].pUId,share,req.body.folderParent], function(err,result,fields){
					con.query("SELECT * FROM `folders` WHERE `fId`=?",[result.insertId],function(err,result,fields){
						res.send("{\"type\":\"success\",\"response\":\"Created Folder Named (" + req.body.folderName + ") Under Folder ID (" + req.body.folderParent + ")\", \"data\": {\"fId\":" + result[0].fId + ", \"fShare\":\"" + result[0].fShare + "\"}}");
					});
				});
			});
			return 0;
		}
	});
});

app.post('/login', function(req,res){
	if(!req.body.uName || !req.body.password){
		res.status(400).send("{\"type\":\"error\",\"response\":\"Empty Field(s)\"}");
		return 0;
	}
	con.query("SELECT * FROM `users` WHERE `uName`=?;",[req.body.uName], function(err,result,fields){
		if(result.length == 0){
			res.status(418).send("{\"type\":\"error\",\"response\":\"Username Or Password Is Incorrect\"}");
			return 0;
		}
		if(!bcrypt.compareSync(req.body.password,result[0].password)){
			res.status(418).send("{\"type\":\"error\",\"response\":\"Username Or Password Is Incorrect\"}");
			return 0;
		}
		var newToken = crypto.randomBytes(32).toString('hex');
		con.query("UPDATE `users` SET `token`=? WHERE `uId`=?;",[newToken,result[0].uId], function(err,result,fields){});
		res.cookie('token', newToken);
		res.send("{\"type\":\"success\",\"response\":\"Logged In\"}");
	});
	return 0;
});

app.post('/register', function(req,res){
	if(!req.body.uName || !req.body.password){
		res.status(400).send("{\"type\":\"error\",\"response\":\"Empty Field(s)\"}");
		return 0;
	} if(req.body.password.length < 8 && req.body.passlenbypass == "false"){
		res.send("{\"type\":\"error\",\"response\":\"Password Too Short, Press Register Again To Ignore\"}");
		return 0;
	}
	con.query("SELECT * FROM `users` WHERE `uName`=?;",[req.body.uName], function(err,result,fields){
		if(result.length > 0){
			res.send("{\"type\":\"error\",\"response\":\"User Already Exists\"}");
			return 0;
		}
		var newToken = crypto.randomBytes(32).toString('hex');
		var password = bcrypt.hashSync(req.body.password,10);
		con.query("INSERT INTO `users`(`uName`,`password`,`token`) VALUES (?, ?, ?);",[req.body.uName,password,newToken], function(err,result,fields){
			if(err){
				res.send("{\"type\":\"error\",\"response\":\"Unknown error occured, please try different values or try again later\"}");
				return 0;
			}
			res.cookie('token', newToken);
			res.send("{\"type\":\"success\",\"response\":\"Logged In\"}");
		});
	});
});

app.get('/file/*', function(req,res){
	var params = req.params['0'].split('/');
	if(params.length < 3){
		res.status(400).send("<h1>Too Few Arguments</h1><p>Ask For Another Share Link</p>");
		return 0;
	}
	con.query("SELECT * FROM `files` WHERE `pUId`=? AND `fId`=? AND `fName`=?",[params[0],params[1],encodeURIComponent(params[2])],function(err,result,fields){
		if(result.length == 0){
			res.status(404).send("<h1>File Not Found</h1><p>Ask For Another Share Link</p>");
			return 0;
		}
		res.sendFile(path.join(fileStorage+'/'+result[0].fId), {headers: {'Content-Type': result[0].mimetype}});
	});
});

function getChildrenFolders(folder,user,folders){
	var result = conSync.query("SELECT * FROM `folders` WHERE `pFolder`=? AND `pUId`=?",[folder,user]);
	for(let i = 0; i<result.length; i++){
		var x = getChildrenFolders(result[i].fId,result[i].pUId,folders);
		folders = folders.concat(x);
	}
	return folders.concat([folder]);
}

app.get('/folder/*', function(req,res){
	var params = req.params['0'].split('/');
	if(params.length < 2){
		res.status(400).send("<h1>Too Few Arguments</h1><p>Ask For Another Share Link</p>");
		return 0;
	}
	var doesFolderExist = conSync.query("SELECT * FROM `folders` WHERE `fShare`=? AND `pUId`=?",[params[1],params[0]]);
	if(doesFolderExist.length==0){
		res.status(404).send("<h1>Folder Not Found</h1><p>Ask For Another Share Link</p>");
		return 0;
	}
	var folderS = doesFolderExist[0].fId;
	var folderList = getChildrenFolders(folderS,params[0],[]);
	folderList = [...new Set(folderList)];
	var files = {};
	var folders = {};
	for(let z = 0; z < folderList.length; z++){
		var folder = folderList[z];
		console.log(folder);
		var result = conSync.query("SELECT * FROM `files` WHERE `pUId`=? AND `pFolder`=? ORDER BY `fName` ASC",[params[0],folder]);
		for (let i = 0; i<result.length; i++){
			files[result[i].fId] = [result[i].fName,result[i].pFolder];
		}
		result = conSync.query("SELECT * FROM `folders` WHERE `pUId`=? AND `fId`=? ORDER BY `fName` ASC",[params[0],folder]);
		for (let i = 0; i<result.length; i++){
			folders[result[i].fId] = [result[i].fName,result[i].fShare,result[i].pFolder];
		}
	}
	res.write("<script>var host = " + params[0] + ";var root = " + folderS.toString() + ";var folders = " + JSON.stringify(folders) + "; var files = " + JSON.stringify(files)+";</script>");
	res.write(fs.readFileSync(__dirname+'/src/folderViewer.html', 'utf8'));
	res.end();
});

app.get('/deleteaccount',function(req,res){
	if(!req.cookies.token){
		res.status(403).send("{\"type\":\"error\",\"response\":\"Not Logged In, Please Try Logging In Again\"}");
		return 0;
	}
	con.query("SELECT * FROM `users` WHERE `token`=?", [req.cookies.token], function (err, result, fields) {
		if(result.length == 0){
			res.status(403).send("{\"type\":\"error\",\"response\":\"Invalid Token, Try Logging In Again\"}");
			return 0;
		}
		con.query("SELECT * FROM `files` WHERE `pUId`=?",[result[0].uId],function (err, result, fields) {
			for(let i = 0; i < result.length; i++){
				deleteFile(result[i].fId,result[i].fName);
			}
		});
		con.query("DELETE FROM `folders` WHERE `pUId`=?",[result[0].uId],function (err, result, fields) {});
		con.query("DELETE FROM `users` WHERE `uId`=?",[result[0].uId],function (err, result, fields) {});
		res.send("<h1>Sorry To See You Go!</h1><a href='/'>Take Me Home</a>");
	}
});

if(config.cert)
	https.createServer({key: fs.readFileSync(config.key),cert: fs.readFileSync(config.cert)}, app).listen(443);
else
	var server = app.listen(80);
setInterval(()=>{con.query("SELECT 1"); conSync.query("SELECT 1")}, 5000); // keep sql alive
