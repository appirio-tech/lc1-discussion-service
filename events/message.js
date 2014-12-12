'use strict';

var datasource = require('../datasource').getDataSource();
var Message = datasource.Message;
var Discussion = datasource.Discussion;
var kue = require('kue');
var job = kue.createQueue(require('../config/kue'));
var config = require('config');
var tcUser = require('../lib/tc-auth/tcUser');

Message.afterCreate(function(message, fn) {
  Discussion.find(message.discussionId)
    .then(function(discussion) {
      if (discussion) {

        var options = {
          messageId: message.id,
          challengeId: discussion.remoteObjectId,
          authorId: tcUser.getSigninUser().id
        };

        /*
         {messageId, challengeId, authorId}
         */
        job.create('60_new_discussion_message', options).save();
      }

      fn(null, message);
    });
});