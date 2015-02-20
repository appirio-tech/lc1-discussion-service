'use strict';

var should = require('should');
var config = require('config');
var supertest = require("supertest");
var async = require("async");

var serenityDatasource = require('serenity-datasource');
var db = new serenityDatasource(config);
var sequelize = db.sequelize;
// turn of sequelize logging.
sequelize.options.logging = false;
var Discussion = db.Discussion;
var Message = db.Message;

/**
 * Test Suites
 */
describe('API', function() {
  this.timeout(15000);

  var url = 'http://localhost:' + config.app.port;
  var replacementMap;

  before(function (done) {
    var discussionData = {
      remoteObjectKey: 'challenge',
      remoteObjectId: 12345
    };

    var messageData = {
      content: 'message content'
    };

    var replyData = {
      content: 'reply content'
    };

    // create discussion
    supertest(url)
      .post('/discussions')
      .send(discussionData)
      .expect('Content-Type', /json/)
      .end(function(err, res) {
        should.not.exist(err);
        var discussionId = res.body.id;

        // create message
        supertest(url)
          .post('/discussions/' + discussionId + '/messages')
          .send(messageData)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            should.not.exist(err);

            var messageId = res.body.id;

            replacementMap = {
              discussionId: discussionId,
              messageId: messageId
            };

            // create reply
            supertest(url)
              .post('/discussions/' + discussionId + '/messages/' + messageId + '/messages')
              .send(replyData)
              .expect('Content-Type', /json/)
              .end(done);
          });
      });
  });

  it('should return fields respecting the Swagger documentation file', function (done) {
    require('./swaggerTestHelper').validateGetRequests(url, __dirname + '/../api/swagger/swagger.yaml', replacementMap, done);
  });

  after(function(done) {
    // delete data created during test.
    async.waterfall([
      function(callback) {
        Message.findAll().success(function(messages) {
          async.each(messages, function(m, cb) {
            m.destroy().success(cb);
          }, callback);
        });
      },
      function(callback) {
        Discussion.findAll().success(function(discussions) {
          async.each(discussions, function(d, cb) {
            d.destroy().success(function() {
              cb();
            });
          }, callback);
        });
      }
    ], done);
  });

});
