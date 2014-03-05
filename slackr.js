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
app.use(express.urlencoded());
app.use(express.json());
app.use(express.bodyParser({strict: false}));

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
      console.log("no content");
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

		sendSlackRequest(slack, function(results){console.log(results);});
	});
};

var sendSlackRequest = function(options, callback){
	var reqOptions = {
		hostname: config.slack_config.domain,
		port: 443,
		path: config.slack_config.path+config.slack_config.token,
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

// step through all incoming webhooks and build out routes
_.each(config.webhooks, function(integration, key){
	_.each(integration.routes, function(route){
		app.post('/'+key+route.path, function(req,res){
			processRequest(route, req, res);
			res.status(200);
			res.send({status:"OK"});
		});
	});
});

// build out regex and functions to call
var outgoingHookCommands = [];
var required = {};
_.each(config.slack, function(o){
  var module = o.module.split('.');
  if (!_.isObject(required[module[0]])){
    required[module[0]] = require("./modules/"+module[0]);
  }

  outgoingHookCommands.push({
    regex: new RegExp(o.regex,"i"),
    func: required[module[0]][module[1]]
  });
});

// listen for commands to be executed
app.post('/slackr', function(req,res){
  if (req.body.token !== config.slack_config.outgoing_webhook_token){
    res.status(404);
    res.send();
    return;
  }

  var content = "",
      found = false;
  _.each(outgoingHookCommands, function(o){
    if (_.isString(req.body.text) && req.body.text.match(o.regex) && _.isFunction(o.func)){
      found = true;
      o.func(req.body.text, function(response){
          res.status(200);
          res.send({text:response, parse:"full"});
      });
      return false; // break loop
    }
  });

  // no listener found
  if (!found){
    res.status(200);
    res.send();
  }
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
