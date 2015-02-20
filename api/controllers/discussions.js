'use strict';


var datasource = require('./../../datasource').getDataSource();
var Discussion = datasource.Discussion;
var controllerHelper = require('../../lib/controllerHelper');


// build controller for discussion resource
var discussionController = controllerHelper.buildController(Discussion, null, {filtering: true});

module.exports = {
  create: discussionController.create,
  getDiscussions: discussionController.all,
  findById: discussionController.get
};
