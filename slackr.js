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

// TODO: Eventually the index route will show something helpful :)
app.get('/', routes.index);

// Compile handlebars translation template
var Templates = {};
var compileTemplate = function(tmpl){
  fs.readFile("./templates/"+tmpl, function(err,data){
    if (err){
      console.log("INVALID TEMPLATE",tmpl);
      return;
    }

    Templates[tmpl] = handlebars.compile(data.toString());
  });
}

// Process the Incoming Webhook
var processRequest = function(route, req, res){
  var content = "";

  // make sure we have a valid compiled template
  if (!_.isFunction(Templates[route.template])){
    console.log("invalid template", route.template);
    return;
  }

  try{
    content = Templates[route.template](req.body).trim();
  }
  catch(ex){
    console.log("template exec err", ex);
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

  // send to slack
  sendSlackRequest(slack, function(results){
    console.log("slack results",results);
  });
};

// Send this request on to slack
var sendSlackRequest = function(options, callback){
  var reqOptions = {
    hostname: config.slack_config.domain,
    port: 443,
    path: config.slack_config.path+config.slack_config.token,
    method: "POST"
  };

  var req = https.request(reqOptions, function(res){
    var body = ""
    res.on('data', function (chunk) {
      body += chunk.toString();
    });
    res.on('end', function (chunk) {
      console.log('Slack response: ', res.statusCode, body);
      callback(body);
    });
    
  });

  var payload = JSON.stringify(options);
  console.log("slack payload", payload);
  req.write(payload);
  req.end();
};

// step through all incoming webhooks and build out routes
_.each(config.webhooks, function(integration, key){
  _.each(integration.routes, function(route){

    // compile template
    compileTemplate(route.template);

    // setup route listener
    app.post('/'+key+route.path, function(req,res){
      processRequest(route, req, res);
      res.status(200);
      res.send({status:"OK"});
    });
  });
});

// build out regex objects and functions to call when regex match occurs
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
  
  // make sure token from slack's outgoing webhook is a match with config
  var validToken = false;
  if (_.isArray(config.slack_config.outgoing_webhook_token)){
    _.each(config.slack_config.outgoing_webhook_token, function(t){
      if (req.body.token === t){
        validToken = true;
        return false;
      }
    });
  }
  else if (_.isString(config.slack_config.outgoing_webhook_token)){
    if (req.body.token === config.slack_config.outgoing_webhook_token){
      validToken = true;
    }    
  }
  else{
    validToken = true; // if outgoing_webhook_token not configured, allow all requests
  }

  // bail out if a valid token wasnt passed in
  if (!validToken){
    res.status(404);
    res.send("invalid token");
    return;
  }
  
  // step through each configured command and run regex to find matches
  var found = false;
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
