'use strict';


var should = require('should');
var config = require('config');
var datasource = require('./../../datasource');
datasource.init(config);
var db = datasource.getDataSource();
var sequelize = db.sequelize;
// turn of sequelize logging.
sequelize.options.logging = false;
var Discussion = db.Discussion;

var SAMPLE_TEXT_10 = '1234567890';

/**
 * Globals
 */
var data;
var discussion;

/**
 * Test Suites
 */
describe('Model Unit Test', function() {
  describe('Model Discussion:', function() {
    beforeEach(function(done) {
      data = {
        remoteObjectName: 'challenge',
        remoteObjectId: 12345,
        createdBy: '_indy',
        updatedBy: '_indy'
      };
      done();
    });

    describe('Method Save', function() {
      it('should be able to save without problems', function(done) {
        Discussion.create(data).success(function(created) {
          created.discussionId.should.be.a.Number;
          created.discussionId.should.not.have.length(0);
          created.createdAt.should.not.have.length(0);
          created.updatedAt.should.not.have.length(0);
          created.remoteObjectName.should.equal(data.remoteObjectName);
          created.remoteObjectId.should.equal(data.remoteObjectId);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should fail when try to save without remoteObjectName', function(done) {
        delete data.remoteObjectName;
        Discussion.create(data).success(function(created) {
          should.not.exist(created);
          done();
        })
        .error(function(err) {
          should.exist(err);
          done();
        });
      });

      it('should fail when try to save without remoteObjectId', function(done) {
        delete data.remoteObjectId;
        Discussion.create(data).success(function(created) {
          should.not.exist(created);
          done();
        })
        .error(function(err) {
          should.exist(err);
          done();
        });
      });

      it('should fail when try to save a createdBy of more than 128 chars', function(done) {
        for (var i=0; i<13; i+=1) {
          data.createdBy += SAMPLE_TEXT_10;
        }

        Discussion.create(data).success(function(created) {
          should.not.exist(created);
          done();
        })
        .error(function(err) {
          should.exist(err);
          done();
        });
      });

    });

    describe('Method Find/Update/Delete', function() {
      beforeEach(function(done) {
        // create a discussion
        Discussion.create(data).success(function(created) {
          discussion = created;
          done();
        });
      });

      it('should able to find all discussions', function(done) {
        Discussion.findAll().success(function(all) {
          all.length.should.be.greaterThan(0);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should able to find a discussion with valid id', function(done) {
        Discussion.find(discussion.discussionId).success(function(retrieved) {
          retrieved.discussionId.should.equal(discussion.discussionId);
          retrieved.remoteObjectName.should.equal(discussion.remoteObjectName);
          retrieved.remoteObjectId.should.equal(discussion.remoteObjectId);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });


      it('should not able to find a discussion with invalid id', function(done) {
        Discussion.find(999999).success(function(retrieved) {
          should.not.exist(retrieved);
          done();
        })
        .error(function(err) {
          should.exist(err);
          done();
        });
      });

      it('should able to update a discussion with valid id', function(done) {
        discussion.remoteObjectName = 'object updated';
        discussion.save().success(function(updated) {
          updated.discussionId.should.equal(discussion.discussionId);
          updated.remoteObjectName.should.equal('object updated');
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should able to delete a discussion', function(done) {
        discussion.destroy().success(function() {
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

    });

    afterEach(function(done) {
      if (discussion) {
        discussion.destroy().success(function() {
          discussion = undefined;
          done();
        })
        .error(function(err){
          done();
        });
      } else {
        done();
      }
      
    });
  });
});
