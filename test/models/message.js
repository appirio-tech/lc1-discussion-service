'use strict';


var should = require('should');
var config = require('config');
var datasource = require('./../../datasource');
datasource.init(config);
var db = datasource.getDataSource();
var sequelize = db.sequelize;
// turn of sequelize logging.
sequelize.options.logging = false;
var Message = db.Message;

var SAMPLE_TEXT_10 = '1234567890';

/**
 * Globals
 */
var data;
var message;

/**
 * Test Suites
 */
describe('Model Unit Test', function() {
  describe('Model Message:', function() {
    beforeEach(function(done) {
      data = {
        content: 'message content',
        discussionId: 12345,
        parentMessageId: 67890,
        createdBy: '_indy',
        updatedBy: '_indy'
      };
      done();
    });

    describe('Method Save', function() {
      it('should able to save without problems', function(done) {
        Message.create(data).success(function(created) {
          created.messageId.should.be.a.Number;
          created.messageId.should.not.have.length(0);
          created.createdAt.should.not.have.length(0);
          created.updatedAt.should.not.have.length(0);
          created.discussionId.should.equal(data.discussionId);
          created.content.should.equal(data.content);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should fail when try to save without discussionId', function(done) {
        delete data.discussionId;
        Message.create(data).success(function(created) {
          should.not.exist(created);
          done();
        })
        .error(function(err) {
          should.exist(err);
          done();
        });
      });

      it('should fail when try to save without content', function(done) {
        delete data.content;
        Message.create(data).success(function(created) {
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

        Message.create(data).success(function(created) {
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
        // create a message
        Message.create(data).success(function(created) {
          message = created;
          done();
        });
      });

      it('should able to find all messages', function(done) {
        Message.findAll().success(function(all) {
          all.length.should.be.greaterThan(0);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should able to find a message with valid id', function(done) {
        Message.find(message.messageId).success(function(retrieved) {
          retrieved.messageId.should.equal(message.messageId);
          retrieved.content.should.equal(message.content);
          retrieved.discussionId.should.equal(message.discussionId);
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });


      it('should fail to find a message with invalid id', function(done) {
        Message.find(999999).success(function(retrieved) {
          should.not.exist(retrieved);
          done();
        })
        .error(function(err) {
          should.exist(err);
          done();
        });
      });

      it('should able to update a message with valid id', function(done) {
        message.content = 'content updated';
        message.save().success(function(updated) {
          updated.messageId.should.equal(message.messageId);
          updated.content.should.equal('content updated');
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should able to delete a message', function(done) {
        message.destroy().success(function() {
          done();
        })
        .error(function(err) {
          should.not.exist(err);
          done();
        });
      });

    });

    afterEach(function(done) {
      if (message) {
        message.destroy().success(function() {
          message = undefined;
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
