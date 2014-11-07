'use strict';

var should = require('should');
var assert = require('assert');
// var app = require('../../app');
var request = require('supertest');
var async = require('async');
var _ = require('lodash');
var config = require('config');

var datasource = require('./../../datasource');
datasource.init(config);
var db = datasource.getDataSource();
var sequelize = db.sequelize;
// turn of sequelize logging.
sequelize.options.logging = false;
var Discussion = db.Discussion;
var Message = db.Message;

/**
 * Globals
 */
var url = 'http://localhost:' + config.app.port;
var discussion;
var message1, message2, message13, message14, message35;
// var data;
/**
 * Test Suites
 */
describe('Fields Parameter Test', function () {
  this.timeout(15000);

  var discussionData = {
    remoteObjectKey: 'challenge',
    remoteObjectId: 12345
  };
  var messageData = {
    content: 'message content',
    parentMessageId: null
  };

  before(function (done) {
    async.waterfall([
      function (callback) {
        Discussion.create(discussionData).success(function (created) {
          discussion = created;
          callback(null, discussion);
        });
      },
      // create two first-level message
      function (discussion, callback) {
        messageData.discussionId = discussion.id;
        Message.create(messageData).success(function (created) {
          message1 = created;
          Message.create(messageData).success(function (created) {
            message2 = created;
            callback(null, discussion, message1);
          });
        })
          .error(function (err) {
            console.log('err: ', err);
          });
      },
      // create  two child messages in message1
      function (discussion, message1, callback) {
        messageData.discussionId = discussion.id;
        messageData.parentMessageId = message1.id;
        Message.create(messageData).success(function (created) {
          message13 = created;
          Message.create(messageData).success(function (created) {
            message14 = created;
            callback(null, discussion, message1, message13);
          });
        });
      },
      // create one child message in message13
      function (discussion, message1, message13, callback) {
        messageData.discussionId = discussion.id;
        messageData.parentMessageId = message13.id;
        Message.create(messageData).success(function (created) {
          message35 = created;
          callback(null);
        });
      }
    ], function (err) {
      done();
    });

  });

  describe('Expand Discussion model:', function () {

    it('should able to expand messages', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '?fields=remoteObjectKey,messages')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.remoteObjectKey.should.equal(discussionData.remoteObjectKey);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(5);
          done();
        });
    });

    it('should able to expand messages in Discussion\'s messages', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '?fields=remoteObjectKey,messages(id,messages)')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.remoteObjectKey.should.equal(discussionData.remoteObjectKey);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(5);
          _.each(res.body.content.messages, function (message) {
            if (message.id === message1.id) {
              message.should.have.property('messages');
              message.messages.length.should.equal(2);
            }
          });
          done();
        });
    });

    it('should able to expand discussion in discussion\'s messages', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '?fields=remoteObjectKey,messages(discussion)')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.remoteObjectKey.should.equal(discussionData.remoteObjectKey);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(5);
          _.each(res.body.content.messages, function (message) {
            message.should.have.property('discussion');
            message.discussion.remoteObjectKey.should.equal(discussionData.remoteObjectKey);
          });
          done();
        });
    });

    it('should able to expand parentMessage in discussion\'s messages', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '?fields=remoteObjectKey,messages(parentMessage)')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.remoteObjectKey.should.equal(discussionData.remoteObjectKey);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(5);
          _.each(res.body.content.messages, function (message) {
            if (message.id === message13.id) {
              console.log(message);
              message.should.have.property('parentMessage');
              message.parentMessage.id.should.equal(message1.id);
            }
          });
          done();
        });
    });

    it('should able to expand messages\'s parentMessage in discussion\'s messages', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '?fields=remoteObjectKey,messages(id,messages(id,parentMessage))')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.remoteObjectKey.should.equal(discussionData.remoteObjectKey);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(5);
          _.each(res.body.content.messages, function (message) {
            if (message.id === message1.id) {
              message.should.have.property('messages');
              message.messages.length.should.equal(2);
              _.each(message.messages, function (msg) {
                msg.should.have.property('parentMessage');
                if (msg.parentMessage) {
                  msg.parentMessage.id.should.equal(message.id);
                  msg.should.not.have.property('content');
                }
              });
            }
          });
          done();
        });

    });

  });

  describe('Expand Message model:', function () {

    it('should able to expand messages', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '/messages/' + message1.id + '?fields=messages')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(2);
          done();
        });
    });

    it('should able to expand messages.messages', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '/messages/' + message1.id + '?fields=id,messages(id,messages)')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);  // body is message1
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(2);
          _.each(res.body.content.messages, function (message) {
            if (message.id === message13.id) {
              message.should.have.property('messages');
              message.messages.length.should.equal(1);
            }
          });
          done();
        });
    });

    it('should able to expand messages.discussion', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '/messages/' + message1.id + '?fields=messages(discussionId,id,discussion)')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(2);
          _.each(res.body.content.messages, function (message) {
            message.should.have.property('discussion');
            message.discussion.id.should.equal(message.discussionId);
          });
          done();
        });
    });

    it('should able to expand messages.parentMessage', function (done) {
      // send request
      request(url)
        .get('/discussions/' + discussion.id + '/messages/' + message1.id + '?fields=messages(parentMessage)')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.success.should.be.true;
          res.body.status.should.equal(200);
          res.body.content.should.have.property('messages');
          res.body.content.messages.length.should.equal(2);
          // top-level message doesn't have parentMessage
          res.body.content.messages[0].parentMessage.id.should.equal(message1.id);
          done();
        });
    });

  });


  after(function (done) {
    // delete data created during test.
    async.waterfall([
      function (callback) {
        Message.findAll().success(function (messages) {
          async.each(messages, function (m, cb) {
            m.destroy().success(function () {
              cb();
            });
          }, function (err) {
            callback();
          });
        });
      },
      function (callback) {
        Discussion.findAll().success(function (discussions) {
          async.each(discussions, function (d, cb) {
            d.destroy().success(function () {
              cb();
            });
          }, function (err) {
            callback();
          });
        });
      },
    ], function (err) {
      done();
    });
  });

});