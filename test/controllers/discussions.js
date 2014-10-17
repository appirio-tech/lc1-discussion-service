'use strict';

var should = require('should'); 
var assert = require('assert');
// var app = require('../../app');
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


describe('Discussions Controller', function() {
  var url = 'http://localhost:'+config.app.port;
  var discussionId;
  var reqData;

  beforeEach(function(done) {
    reqData = {
      remoteObjectKey: 'challenge',
      remoteObjectId: 12345
    };
    done();
  });

  describe('Discussions API', function() {
    it('should able to create a discussion with valid data', function(done) {
      // send request
      request(url)
    	.post('/discussions')
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
        discussionId = res.body.id;
        done();
      });
    });

    it('should fail to create a discussion without remoteObjectKey', function(done) {
      delete reqData.remoteObjectKey;
      // send request
      request(url)
      .post('/discussions')
      .send(reqData)
      .end(function(err, res) {
        res.status.should.equal(400);
        res.body.should.have.property('result');
        res.body.result.success.should.be.false;
        res.body.result.status.should.equal(400);
        res.body.result.should.have.property('content');
        done();
      });
    });

    it('should able to get the discussions by filtering', function(done) {
      // send request
      request(url)
      .get('/discussions/?filter=remoteObjectKey=\'challenge\'')
      .end(function(err, res) {
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.should.have.property('metadata');
        res.body.metadata.totalCount.should.be.above(0);
        res.body.content.length.should.be.above(0);
        res.body.content[0].should.have.property('remoteObjectKey');
        res.body.content[0].should.have.property('remoteObjectId');
        res.body.content[0].should.have.property('messageCount');
        done();
      });
    });

    it('should able to filter out discussions by filtering', function(done) {
      // send request
      request(url)
      .get('/discussions/?filter=remoteObjectKey=\'xxxxx\'')
      .end(function(err, res) {
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.should.have.property('metadata');
        res.body.metadata.totalCount.should.exactly(0);
        res.body.content.length.should.exactly(0);
        done();
      });
    });

    it('should able to get the existing discussion', function(done) {
      // send request
      request(url)
      .get('/discussions/'+discussionId)
      .end(function(err, res) {
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.content.remoteObjectKey.should.equal(reqData.remoteObjectKey);
        res.body.content.remoteObjectId.should.equal(reqData.remoteObjectId);
        res.body.content.should.have.property('messageCount');
        done();
      });
    });

    it('should fail to get non-existing discussion', function(done) {
      // send token request
      request(url)
      .get('/discussions/99999999')
      .end(function(err, res) {
        res.status.should.equal(404);
        res.body.result.status.should.equal(404);
        res.body.result.should.have.property('content');
        done();
      });
    });

  });

  after(function(done) {
    // delete data created during test.
    async.waterfall([
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

