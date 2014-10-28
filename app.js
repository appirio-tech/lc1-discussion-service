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
var routeHelper = require('./lib/routeHelper');
var expandHelper = require('./lib/expandHelper');
var swaggerTools = require('swagger-tools');
var yaml = require('js-yaml');
var fs = require('fs');
var cors = require('cors');

var app = express();
var swaggerUi = swaggerTools.middleware.v2.swaggerUi;

// Add cors support
app.use(cors());
app.options('*', cors());

// uncomment the following if you need to parse incoming form data
app.use(bodyParser.json());

// Serve the Swagger documents and Swagger UI
var swaggerDoc = yaml.safeLoad(fs.readFileSync('./api/swagger/swagger.yaml', 'utf8'));
app.use(swaggerUi(swaggerDoc));

// @TODO add try/catch logic
datasource.init(config);

var port;
if (config.has('app.port')) {
  port = config.get('app.port');
} else {
  port = 10010;
}

// expand parameter parser handler
app.use(expandHelper.parseExpandParam);

// a127 middlewares
app.use(a127.middleware());
// generic error handler
app.use(routeHelper.errorHandler);
// render response data as JSON
app.use(routeHelper.renderJson);

app.listen(port);
console.log('app started at '+port);

module.exports = app;