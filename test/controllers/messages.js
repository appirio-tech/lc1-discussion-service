'use strict';

var should = require('should'); 
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var config = require('config');

var datasource = require('./../../datasource');
datasource.init(config);
var db = datasource.getDataSource();
var sequelize = db.sequelize;
// turn of sequelize logging.
sequelize.options.logging = false;
var Discussion = db.Discussion;
var Message = db.Message;



describe('Messages Controller', function() {
  var url = 'http://localhost:'+config.app.port;
  var discussion;
  var messageId;
  var reqData;

  // create a discussion
  before(function(done) {
    var discussionData = {
      remoteObjectKey: 'challenge',
      remoteObjectId: 5678
    };
    Discussion.create(discussionData).success(function (createdDiscussion) {
      discussion = createdDiscussion;
      done();
    }).error(function(err) {
      should.not.exist(err);
    });
  });

  beforeEach(function(done) {
    reqData = {
      content: 'message content'
    };
    done();
  });

  describe('Messages API', function() {
    it('should able to create a message with valid data', function(done) {
      // send request
      request(url)
    	.post('/discussions/'+discussion.discussionId+'/messages')
    	.send(reqData)
      .expect('Content-Type', /json/)
      // end handles the response
    	.end(function(err, res) {
        should.not.exist(err);
        // verify response
        res.status.should.equal(200);
        res.body.id.should.be.a.Number;
        res.body.result.success.should.be.true;
        res.body.result.status.should.equal(200);
        messageId = res.body.id;
        done();
      });
    });

    it('should fail to create a message with invalid discussionId', function(done) {
      // send request
      request(url)
      .post('/discussions/'+9999999+'/messages')
      .send(reqData)
      .end(function(err, res) {
        res.status.should.equal(404);
        res.body.result.success.should.be.false;
        res.body.result.status.should.equal(404);
        res.body.should.have.property('content');
        done();
      });
    });

    it('should fail to create a message without content', function(done) {
      delete reqData.content;
      // send request
      request(url)
      .post('/discussions/'+discussion.discussionId+'/messages')
      .send(reqData)
      .end(function(err, res) {
        res.status.should.equal(400);
        res.body.result.success.should.be.false;
        res.body.result.status.should.equal(400);
        res.body.should.have.property('content');
        done();
      });
    });

    it('should able to get the all messages in a discussion', function(done) {
      var replyData = {content: 'reply content'};
      // send request
      request(url)
      .get('/discussions/'+discussion.discussionId+'/messages/')
      .end(function(err, res) {
        should.not.exist(err);
        // verify response
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.should.have.property('metadata');
        res.body.metadata.totalCount.should.be.above(0);
        res.body.should.have.property('content');
        res.body.content.length.should.be.above(0);
        done();
      });
    });

    it('should able to get the existing message', function(done) {
      // send request
      request(url)
      .get('/discussions/'+discussion.discussionId+'/messages/'+messageId)
      .end(function(err, res) {
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.content.messageId.should.equal(messageId);
        res.body.content.discussionId.should.equal(discussion.discussionId);
        res.body.content.content.should.equal(reqData.content);
        res.body.content.should.have.property('messageCount');
        done();
      });
    });

    it('should able to update the existing message', function(done) {
      // send request
      reqData.content = 'updated content';
      request(url)
      .put('/discussions/'+discussion.discussionId+'/messages/'+messageId)
      .send(reqData)
      .end(function(err, res) {
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.content.messageId.should.equal(messageId);
        res.body.content.discussionId.should.equal(discussion.discussionId);
        res.body.content.content.should.equal(reqData.content);
        done();
      });
    });

    it('should able to create a reply message to the existing message', function(done) {
      var replyData = {content: 'reply content'};
      // send request
      request(url)
      .post('/discussions/'+discussion.discussionId+'/messages/'+messageId+'/messages')
      .send(replyData)
      .end(function(err, res) {
        should.not.exist(err);
        // verify response
        res.status.should.equal(200);
        res.body.id.should.be.a.Number;
        res.body.result.success.should.be.true;
        res.body.result.status.should.equal(200);
        done();
      });
    });

    it('should able to get the child messages in a message', function(done) {
      var replyData = {content: 'reply content'};
      // send request
      request(url)
      .get('/discussions/'+discussion.discussionId+'/messages/'+messageId+'/messages')
      .end(function(err, res) {
        should.not.exist(err);
        // verify response
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.should.have.property('metadata');
        res.body.metadata.totalCount.should.be.above(0);
        res.body.should.have.property('content');
        res.body.content.length.should.be.above(0);
        done();
      });
    });

    it('should able to delete the existing message', function(done) {
      // send request
      request(url)
      .delete('/discussions/'+discussion.discussionId+'/messages/'+messageId)
      .end(function(err, res) {
        res.status.should.equal(200);
        res.body.id.should.be.a.Number;
        res.body.result.success.should.equal(true);
        res.body.result.status.should.equal(200);
        done();
      });
    });

  });

  after(function(done) {
    // delete data created during test.
    async.waterfall([
      function(callback) {
        Message.findAll().success(function(messages) {
          async.each(messages, function(m, cb) {
            m.destroy().success(function() {
              cb();
            });
          }, function(err) {
            callback();
          });
        });
      },
      function(callback) {
        Discussion.findAll().success(function(discussions) {
          async.each(discussions, function(d, cb) {
            d.destroy().success(function() {
              cb();
            });
          }, function(err) {
            callback();
          });
        });
      },
    ], function(err) {
      done();
    });
  });

});

