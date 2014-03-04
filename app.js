
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var https = require('https');
var path = require('path');
var _ = require("underscore");
var handlebars = require("handlebars");
var fs = require("fs");

var config = require("./config.json");

var app = express();

// all environments
app.set('port', config.port || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.bodyParser());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// TODO: Add route info here eventually
app.get('/', routes.index);

var processRequest = function(route, req, res){
	// translate request via handlebars template
	fs.readFile("./templates/"+route.template, function(err,data){
		if (err){
			console.log("INVALID TEMPLATE",route.template);
		}

		var content = "";

		try{
			var tmpl = handlebars.compile(data.toString()); // TODO: precompile these eventually
			content = tmpl(req.body).trim();
		}
		catch(ex){
			console.log("template error",ex);
		}

		// bail out if no content was generated
		if (!_.isString(content) || content === ""){
			return;
		}

		// build out slack request data
		var slack = {
			"text": content,
			"channel": route.channel
		};

		if (_.isString(route.emoji)){
			slack.icon_emoji = route.emoji;
		}
		if (_.isString(route.icon)){
			slack.icon_url = route.icon;
		}
		if (_.isString(route.username)){
			slack.username = route.username;
		}

		sendSlackRequest(slack, function(results){
		});
	});
};

var sendSlackRequest = function(options, callback){
	var reqOptions = {
		hostname: config.slack.domain,
		port: 443,
		path: config.slack.path+config.slack.token,
		method: "POST"
	};

	var req = https.request(reqOptions, function(res){
		res.on('data', function (chunk) {
			console.log('Slack response: ', res.statusCode, chunk.toString());
		});
		callback(res);
	});

	var payload = JSON.stringify(options);
	console.log(payload);
	req.write(payload);
	req.end();
};

// step through all configured integrations and build out routes
_.each(config.integrations, function(integration, key){
	_.each(integration.routes, function(route){
		app.post('/'+key+route.path, function(req,res){
			processRequest(route, req, res);
			res.status(200);
			res.send({status:"OK"});
		});
	});
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
