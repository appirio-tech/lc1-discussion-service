'use strict';


var datasource = require('./../../datasource').getDataSource();
var Discussion = datasource.Discussion;
var Message = datasource.Message;
var routeHelper = require('./../../lib/routeHelper');
var async = require('async');
var _ = require('lodash');


/**
 * Create a message.
 * @param req the request
 * @param parentId the parent message id
 * @param callback the callback
 */
function _createMessage(req, parentId, callback) {
  var discussionId = req.swagger.params.discussionId.value;
  // find discussion and verify it exists
  Discussion.find(discussionId).success( function(discussion) {
    if (!discussion) {
      routeHelper.addErrorMessage(req, 'Cannot find the message with discussionId '+discussionId, 404);
      callback(req.error);
    } else {
      var data = _.omit(req.swagger.params.body.value, 'messageId', 'createdAt', 'updatedAt');
      data.discussionId = discussionId;
      if (parentId) {
        data.parentMessageId = parentId;
      }
      data.createdBy = routeHelper.getSigninUser();
      data.updatedBy = routeHelper.getSigninUser();

      Message.create(data).success(function (message) {
        callback(null, message);
      })
      .error(function(err) {
        routeHelper.addError(req, err);
        callback(req.error);
      });
    }
  })
  .error(function(err) {
    routeHelper.addError(req, err);
    callback(req.error);
  });

}

/**
 * Create a message.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function create(req, res, next) {
  _createMessage(req, null, function(err, message) {
    if (!err) {
      req.data = { 
        id: message.messageId,
        result: {
          success: true,
          status: 200
        }
      };
    }
    next();
  });
}

/**
 * Get all messages in a discussion.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function getAllByDiscussion(req, res, next) {
  var filters = {
    where: {
      discussionId: req.swagger.params.discussionId.value
    }
  };

  Message.findAll(filters).success(function(messages) {
    async.each(messages, function(message, callback) {
      // fetch all child messages
      Message.findAll({where: {parentMessageId: message.messageId}}).success(function(children) {
        message.dataValues.messages = children;
        callback();
      })
      .error(function(err) {
        routeHelper.addError(req, err);
        callback(err);
      });
    }, function(err) {
      if (err) {
        routeHelper.addError(req, err);
      } else {
        req.data = {messages: messages};
      }
      next();
    });
  })
  .error(function(err) {
    routeHelper.addError(req, err);
    next();
  });
}

/**
 * Find a message by discussionId and messageId.
 * @param req the request
 * @param includeChildren boolean flag to include child messages or not
 * @param callback the callback
 */
function _findMessageById(req, includeChildren, callback) {
  var discussionId = req.swagger.params.discussionId.value;
  var messageId = req.swagger.params.messageId.value;
  var filters = {
    where: {
      discussionId: discussionId,
      messageId: messageId
    }
  };

  Message.find(filters).success(function(message) {
    if (!message) {
        routeHelper.addErrorMessage(req, 'Cannot find the message with messageId '+messageId+' in the discussion '+discussionId, 404);
        callback(req.error);
    } else {
      if (includeChildren) {
        // fetch all child messages
        Message.findAll({where: {parentMessageId: message.messageId}}).success(function(children) {
          message.dataValues.messages = children;
          req.data = message;
          callback(null, message);
        })
        .error(function(err) {
          routeHelper.addError(req, err);
          callback(req.error);
        });
      } else {
        req.data = message;
        callback(null, message);
      }
    }
  })
  .error(function(err) {
    routeHelper.addError(req, err);
    callback(req.error);
  });

}

/**
 * Find a message by discussionId and messageId.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function findById(req, res, next) {
  _findMessageById(req, true, function(err, message) {
    if (!err) {
      req.data = { 
        success: true,
        status: 200,
        content: message
      };
    }
    next();
  });
}

/**
 * Update the message.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function update(req, res, next) {
  _findMessageById(req, false, function(err, message) {
    if (err) {
      next();
    } else {
      var data = _.omit(req.swagger.params.body.value, 'messageId', 'discussionId', 'createdAt', 'updatedAt');
      message = _.extend(message, data);
      message.updatedBy = routeHelper.getSigninUser();
      message.save().success(function() {
        req.data = {
          success: true,
          status: 200,
          content: message
        };
        next();
      })
      .error(function(err) {
        routeHelper.addError(req, err);
        next();
      });
    }
  });
}

/**
 * Delete the message.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function deleteMessage(req, res, next) {
  _findMessageById(req, false, function(err, message) {
    if (err) {
      next();
    } else {
      message.destroy().success(function() {
        req.data = {
          success: true,
          status: 200
        };
        next();
      })
      .error(function(err) {
        routeHelper.addError(req, err);
        next();
      });
    }
  });
}

/**
 * Reply to the existing message.
 * @param req the request
 * @param res the response
 * @param next the next
 */
function reply(req, res, next) {
  _findMessageById(req, false, function(err, message) {
    if (err) {
      next();
    } else {
      var parentId = req.swagger.params.messageId.value;
      _createMessage(req, parentId, function(err, message) {
        if (!err) {
          req.data = { 
            id: message.messageId,
            result: {
              success: true,
              status: 200
            }
          };
        }
        next();
      });
    }
  });
}

module.exports = {
  create: create,
  getAllbyDiscussion: getAllByDiscussion,
  findById: findById,
  update: update,
  delete: deleteMessage,
  reply: reply
};
