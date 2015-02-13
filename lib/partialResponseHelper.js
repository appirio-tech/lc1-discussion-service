'use strict';

var serenityPartialResponseHelper = require('serenity-partial-response-helper');
var datasource = require('../datasource');

module.exports = new serenityPartialResponseHelper(datasource);
