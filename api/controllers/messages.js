'use strict';


var datasource = require('./../../datasource').getDataSource();
var Discussion = datasource.Discussion;
var Message = datasource.Message;
var controllerHelper = require('./../../lib/controllerHelper');
var async = require('async');
var partialResponseHelper = require('./../../lib/partialResponseHelper');


// build controller for message resource
var messageController = controllerHelper.buildController(Message, [Discussion], {filtering: true});


/**
 * Reply to the existing message.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function reply(req, res, next) {
  controllerHelper.getEntity(Message, [Discussion], {}, req, function(err, parentMessage) {
    if (err) {
      next();
    } else {
      // the data for creating entity should be in req.swagger.params.body.value
      // set parentMessageId
      req.swagger.params.body.value.parentMessageId = parentMessage.id;
      controllerHelper.createEntity(Message, [Discussion], {}, req, function(err, message) {
        if (!err) {
          req.data = { 
            id: message.id,
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

  async.waterfall([
    function(callback) {
      var filters = {
        where: {
          discussionId: req.swagger.params.discussionId.value,
          parentMessageId: req.swagger.params.messageId.value
        }
      };
      controllerHelper.findEntities(Message, filters, req, callback);
    }
  ], function(err, totalCount, messages) {
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
    partialResponseHelper.reduceFieldsAndExpandObject(Message, req, next);
  });

}


module.exports = {
  create: messageController.create,
  getAllbyDiscussion: messageController.all,
  findById: messageController.get,
  update: messageController.update,
  delete: messageController.delete,

  // custom operations
  reply: reply,
  getMessages: getMessages
};
