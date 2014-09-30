'use strict';


var datasource = require('./../../datasource').getDataSource();
var Discussion = datasource.Discussion;
var routeHelper = require('./../../lib/routeHelper');
var _ = require('lodash');

/**
 * Create a discussion.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function create(req, res, next) {
  var data = _.omit(req.swagger.params.body.value, 'discussionId', 'createdAt', 'updatedAt');
  data.createdBy = routeHelper.getSigninUser();
  data.updatedBy = routeHelper.getSigninUser();

  Discussion.create(data).success(function(discussion) {
    req.data = { 
      id: discussion.discussionId,
      result: {
        success: true,
        status: 200
      }
    };
    next();
  })
  .error(function(err) {
    routeHelper.addError(req, err);
    next();
  });
}

/**
 * Find a discussion by discussionId.
 * @param req the request
 * @param includeMessages boolean flag to include messages or not
 * @param callback the callback
 */
function _findDiscussionById(req, includeMessages, callback) {
  var discussionId = req.swagger.params.discussionId.value;
  var filters = {
    where: {
      discussionId: discussionId
    }
  };

  Discussion.find(filters).success(function(discussion) {
    if (!discussion) {
        routeHelper.addErrorMessage(req, 'Cannot find the discussion with discussionId '+discussionId, 404);
        callback(req.error);
    } else {
      if (includeMessages) {
        // fetch messages
        discussion.getMessages().success(function(messages) {
          discussion.dataValues.messages = messages;
          callback(null, discussion);
        })
        .error(function(err) {
          routeHelper.addError(req, err);
          callback(req.error);
        });
      } else {
        req.data = discussion;
        callback(null, discussion);
      }
    }
  })
  .error(function(err) {
    routeHelper.addError(req, err);
    callback(req.error);
  });

}

/**
 * Find a discussion by discussionId.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function findById(req, res, next) {
  _findDiscussionById(req, true, function(err, discussion) {
    if (!err) {
      req.data = {
        success: true,
        status: 200,
        content: discussion
      };
    } 
    next();
  });
}

module.exports = {
  create: create,
  findById: findById

};
