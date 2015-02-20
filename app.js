'use strict';

// New relic
if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}


var a127 = require('a127-magic');
var express = require('express');
var bodyParser = require('body-parser');
var config = require('config');
var datasource = require('./datasource');
var routeHelper = require('serenity-route-helper');
var swaggerTools = require('swagger-tools');
var yaml = require('js-yaml');
var fs = require('fs');
var cors = require('cors');
var partialResponseHelper = require('./lib/partialResponseHelper');
var auth = require('serenity-auth');

var app = express();

a127.init(function (swaggerConfig) {
// Add cors support
  app.use(cors());
  app.options('*', cors());

// uncomment the following if you need to parse incoming form data
  app.use(bodyParser.json());

// central point for all authentication
  auth.auth(app, config, routeHelper.errorHandler);

  var swaggerUi = swaggerTools.middleware.v2.swaggerUi;

// Serve the Swagger documents and Swagger UI
  var swaggerDoc = yaml.safeLoad(fs.readFileSync('./api/swagger/swagger.yaml', 'utf8'));
  app.use(swaggerUi(swaggerDoc));

// @TODO add try/catch logic
  datasource.init(config);
  require('./events/message');

  var port;
  if (config.has('app.port')) {
    port = config.get('app.port');
  } else {
    port = 10010;
  }

  app.use(partialResponseHelper.parseFields);

// a127 middlewares
  app.use(a127.middleware(swaggerConfig));
// generic error handler
  app.use(routeHelper.middleware.errorHandler);
// render response data as JSON
  app.use(routeHelper.middleware.renderJson);

  app.listen(port);
  console.log('app started at '+port);
});

module.exports = app;