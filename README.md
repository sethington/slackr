## Slack Webhook Middleware  
---
Middleware to translate incoming POST Webhooks from any service and send the request on to Slack in its accepted format.

### Configuration
The config.json file in the root folder will need to be updated to point to your Incoming Webhooks integration on Slack. Fill in the slack.domain and slack.token fields in config.json to match the integration variables found here: https://my.slack.com/services/new/incoming-webhook

Listeners can be defined in config.json under the "integrations" array. Define each of your integrations and all of the routes and templates associated with them.

route schema:
* **path** The path to listen for webhooks on. If the integration is called 'github' and the route path is set to '/commits', the service will listen on http://yourserver:port/github/commits
* **channel** The Slack channel to post to
* **template** Path to the handlebars template to translate on
* **emoji _(optional)_** The slack emoji to show in the channel
* **icon _(optional)_** URL to an image to show next to message in channel  
* **username _(optional)_** Name to post this message as in the Slack channel  

The translations are created using the Handlebars templating engine. The template will have access to the incoming JSON object from the service and the results of the translation will be sent to the specified Slack channel. Read more on what Handlebars is capable of here: http://handlebarsjs.com/
 
### Running

npm install  
npm install forever -g  
forever app.js  