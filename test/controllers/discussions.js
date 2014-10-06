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

console.log('db: ', db);


describe('Discussions Controller', function() {
  var url = 'http://localhost:'+config.app.port;
  var discussionId;
  var reqData;

  beforeEach(function(done) {
    reqData = {
      remoteObjectName: 'challenge',
      remoteObjectId: 12345
    };
    done();
  });

  describe('Discussions API', function() {
    it('should be able to create a discussion with valid data', function(done) {
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

    it('should fail to create a discussion without remoteObjectName', function(done) {
      delete reqData.remoteObjectName;
      // send request
      request(url)
      .post('/discussions')
      .send(reqData)
      .end(function(err, res) {
        res.status.should.equal(400);
        res.body.code.should.equal(400);
        res.body.should.have.property('message');
        done();
      });
    });

    it('should be able to get the existing challenge', function(done) {
      // send request
      request(url)
      .get('/discussions/'+discussionId)
      .end(function(err, res) {
        res.status.should.equal(200);
        res.body.success.should.be.true;
        res.body.status.should.equal(200);
        res.body.content.remoteObjectName.should.equal(reqData.remoteObjectName);
        res.body.content.remoteObjectId.should.equal(reqData.remoteObjectId);
        // it should have messages
        res.body.content.should.have.property('messages');
        done();
      });
    });

    it('should fail to get non-existing challenge', function(done) {
      // send token request
      request(url)
      .get('/discussions/99999999')
      .end(function(err, res) {
        res.status.should.equal(404);
        res.body.code.should.equal(404);
        res.body.should.have.property('message');
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

