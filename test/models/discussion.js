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
  this.timeout(15000);
  describe('Model Discussion:', function() {
    beforeEach(function(done) {
      data = {
        remoteObjectKey: 'challenge',
        remoteObjectId: 12345,
        createdBy: '1',
        updatedBy: '1'
      };
      done();
    });

    describe('Method Save', function() {
      it('should able to save without problems', function(done) {
        Discussion.create(data).success(function(created) {
          created.id.should.be.a.Number;
          created.id.should.not.have.length(0);
          created.createdAt.should.not.have.length(0);
          created.updatedAt.should.not.have.length(0);
          created.remoteObjectKey.should.equal(data.remoteObjectKey);
          created.remoteObjectId.should.equal(data.remoteObjectId);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should fail when try to save without remoteObjectKey', function(done) {
        delete data.remoteObjectKey;
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
        Discussion.find(discussion.id).success(function(retrieved) {
          retrieved.id.should.equal(discussion.id);
          retrieved.remoteObjectKey.should.equal(discussion.remoteObjectKey);
          retrieved.remoteObjectId.should.equal(discussion.remoteObjectId);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });


      it('should fail to find a discussion with invalid id', function(done) {
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
        discussion.remoteObjectKey = 'object updated';
        discussion.save().success(function(updated) {
          updated.id.should.equal(discussion.id);
          updated.remoteObjectKey.should.equal('object updated');
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
