'use strict';


var datasource = require('./../../datasource').getDataSource();
var Discussion = datasource.Discussion;
var Message = datasource.Message;
var routeHelper = require('./../../lib/routeHelper');
var async = require('async');
var _ = require('lodash');
var queryConfig = require('config').get('app.query');

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
 * @param next the next middleware in the route
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
 * Find messages by filters.
 * @param req the request
 * @param filters the filters used in the query
 * @param funcCallback the callback to return the result
 */
function _findMessages(req, filters, funcCallback) {

  async.waterfall([
    function(callback) {
      // verify the discussion exists
      var discussionId = filters.where.discussionId;
      Discussion.find(discussionId).success( function(discussion) {
        if (!discussion) {
          routeHelper.addErrorMessage(req, 'Cannot find the discussion with discussionId '+discussionId, 404);
          callback(req.error);
        } else {
          callback(null, discussion);
        }
      })
      .error(function (err) {
        routeHelper.addError(req, err);
        callback(req.error);
      });
    },
    function(discussion, callback) {
      // get messages and total count by filters
      Message.findAndCountAll(filters).success(function(result) {
        callback(null, result.count, result.rows);
      })
      .error(function (err) {
        routeHelper.addError(req, err);
        callback(req.error);
      });
    },
    function(count, messages, callback) {
      // get the number of child messages
      async.each(messages, function(message, cb) {
        // filter to get the number of child messages in a message
        var messageFilters = {
          where: {
            discussionId: message.discussionId,
            parentMessageId: message.messageId
          }
        };
        Message.count(messageFilters).success(function(count) {
          message.dataValues.messageCount = count;
          cb();
        })
        .error(function(err) {
          cb(err);
        });
      }, function(err) {
        callback(err, count, messages);
      });
    }
  ], function(err, totalCount, messages) {
    if (err) {
      routeHelper.addError(req, err);
      funcCallback(req.error);
    } else {
      funcCallback(null, totalCount, messages);
    } 
  });

}

/**
 * Get all messages(or root-level only) in a discussion.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function getAllByDiscussion(req, res, next) {
  // It's not clear this operation should return all messages or only root-level messages from the Swagger file.
  // So I made it configurable. When app.query.onlyRootMessages is true, this operation returns only root-level messages.
  // Be default, app.query.onlyRootMessages is set to false and this operation returns all messages.
  var filters = {
    where: {
      discussionId: req.swagger.params.discussionId.value
    }
  };
  if (queryConfig.onlyRootMessages) {
    filters.where.parentMessageId = null;
  }

  // get all messages(or root-level only) in a discussion
  _findMessages(req, filters, function(err, totalCount, messages) {
    if (!err) {
      req.data = {
        success: true,
        status: 200,
        metadata: {
          totalCount: totalCount
        },
        content: messages
      };
    } 
    next();
  });

}

/**
 * Find a message by discussionId and messageId.
 * @param req the request
 * @param includeChildren boolean flag to include child messages or not
 * @param callback the callback
 */
function _findMessageById(req, callback) {
  var discussionId = req.swagger.params.discussionId.value;
  var messageId = req.swagger.params.messageId.value;
  var filters = {
    where: {
      discussionId: discussionId,
      messageId: messageId
    }
  };

  _findMessages(req, filters, function(err, totalCount, messages) {
    if (err) {
      callback(req.error);
    } else {
      if (totalCount === 0) {
        routeHelper.addErrorMessage(req, 'Cannot find the message with messageId '+messageId, 404);
        callback(req.error);
      } else {
        callback(null, messages[0]);  // should be only one message
      }
    } 
  });

}

/**
 * Find a message by discussionId and messageId.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function findById(req, res, next) {
  _findMessageById(req, function(err, message) {
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
 * @param next the next middleware in the route
 */
function update(req, res, next) {
  _findMessageById(req, function(err, message) {
    if (err) {
      next();
    } else {
      var data = _.omit(req.swagger.params.body.value, 'messageId', 'discussionId', 'createdAt', 'updatedAt', 'createdBy');
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
 * @param next the next middleware in the route
 */
function deleteMessage(req, res, next) {
  _findMessageById(req, function(err, message) {
    if (err) {
      next();
    } else {
      message.destroy().success(function() {
        req.data = {
          id: message.messageId,
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
  });
}

/**
 * Reply to the existing message.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function reply(req, res, next) {
  _findMessageById(req, function(err, parentMessage) {
    if (err) {
      next();
    } else {
      var parentId = parentMessage.messageId;
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

/**
 * Get the child messages in a message.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function getMessages(req, res, next) {
  var filters = {
    where: {
      discussionId: req.swagger.params.discussionId.value,
      parentMessageId: req.swagger.params.messageId.value
    }
  };

  // get all messages in a message
  _findMessages(req, filters, function(err, totalCount, messages) {
    if (!err) {
      req.data = {
        success: true,
        status: 200,
        metadata: {
          totalCount: totalCount
        },
        content: messages
      };
    } 
    next();
  });

}

module.exports = {
  create: create,
  getAllbyDiscussion: getAllByDiscussion,
  findById: findById,
  update: update,
  delete: deleteMessage,
  reply: reply,
  getMessages: getMessages
};
