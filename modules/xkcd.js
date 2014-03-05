var http = require("http");

// Retrieve today's XKCD
exports.today = function (text, callback){
  http.get("http://xkcd.com/info.0.json", function(res){
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {
      var results = JSON.parse(body);
      callback("<http://xkcd.com/"+results.num+"/>");
    });
  });
};

// Retrieve a random XKCD
exports.random = function(text, callback){
  http.get("http://dynamic.xkcd.com/random/comic/", function(res){
    callback("<"+res.headers.location+">");
  });
};
