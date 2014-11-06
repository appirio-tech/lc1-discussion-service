'use strict';

var should = require('should');
var config = require('config');
var parser = require("swagger-parser");
var assert = require("assert");
var async = require("async");
var supertest = require("supertest");
var _ = require('underscore');

var datasource = require('./../datasource');
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
var data;
var discussion;

/**
 * Util methods
 */
var replaceParams = function (path, replaceMap) {
  var result = path;
  Object.keys(replaceMap).forEach(function (key) {
    result = result.replace('{' + key + '}', replaceMap[key]);
  });
  return result;
};

var validate = function (route, obj, expectedResponseDefinition, definitions, currentPath, currentObj) {
  if (!currentPath) {
    currentPath = '';
  }
  if (!currentObj) {
    currentObj = obj;
  }
  // check if all required keypaths are present in the object to validate
  var absentRequiredPaths = _.difference(expectedResponseDefinition.required, Object.keys(currentObj));
  assert.equal(absentRequiredPaths.length, 0, route + ': required paths ' + absentRequiredPaths.join() + ' not present in path (' + currentPath + ') of response object ' + JSON.stringify(obj));

  var processRef = function (value, fieldPath, propertyDefinition, isArray) {
    var definitionName = isArray ? propertyDefinition.items.$ref : propertyDefinition.$ref;
    var definition = definitions[definitionName];
    assert.ok(definition, route + ': Unexpected reference name in Swagger file: ' + definitionName);
    if (isArray) {
      assert.ok(Array.isArray(value), route + ': Expected array but found: ' + JSON.stringify(value));
      // validate all items
      value.forEach(function (item) {
        validate(route, obj, definition, definitions, fieldPath, item);
      })
    } else {
      validate(route, obj, definition, definitions, fieldPath, value);
    }
  };

  // traverse all the keypaths in the response object
  for (var key in currentObj) {
    if (!currentObj.hasOwnProperty(key)) {
      continue;
    }
    var value = currentObj[key];
    var fieldPath = (currentPath.length ? currentPath + '.' : '') + key;

    // get the corresponding keypath definition and assert there is one present
    var propertyDefinition = expectedResponseDefinition.properties[key];
    assert.ok(propertyDefinition, route + ': Found undocumented key (' + fieldPath + ')' + ' in server response ' + JSON.stringify(obj));

    // if null
    if (!value) {
      // assert field not required
      assert.ok(expectedResponseDefinition.required.indexOf(key) === -1, route + ': found null on required field ' + fieldPath);
      continue;
    }

    switch (propertyDefinition.type) {
      case 'boolean':
        assert.ok(value.constructor.name === 'Boolean', route + ': boolean value expected, but found (' + value + ') for path (' + fieldPath + ')');
        break;
      case 'integer':
        assert.ok(value.constructor.name === 'Number', route + ': integer value expected, but found (' + value + ') for path (' + fieldPath + ')');
        break;
      case 'string':
        assert.ok(value.constructor.name === 'String', route + ': string value expected, but found (' + value + ') for path (' + fieldPath + ')');
        if (propertyDefinition.format === 'date-time') {
          assert.ok(new Date(value).toISOString() === value, route + ': date-time formatted string value expected, but found (' + value + ') for path (' + fieldPath + ')');
        }
        break;
      case 'array':
        if (propertyDefinition.items.$ref) {
          if ('minItems' in propertyDefinition.items) {
            assert.ok(value.length >= propertyDefinition.items.minItems, route + ': expected array length of at least ' + propertyDefinition.items.minItems + ' but found ' + value.length + ' for path (' + fieldPath + ')');
          }
          processRef(value, fieldPath, propertyDefinition, true);
        } else {
          console.info(route + ': Found array definition without a referenced definition for path (' + fieldPath + ')');
        }
        break;
      default:
        if (propertyDefinition.$ref) {
          processRef(value, fieldPath, propertyDefinition);
        } else {
          console.info(route + ': Unmatched Swagger type: ' + propertyDefinition.type + '. for path (' + fieldPath + ')');
        }
    }
  }
};

/**
 * Test Suites
 */
describe('API', function() {

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
    var options = { dereferencePointers: false };
    parser.parse(__dirname + '/../api/swagger/swagger.yaml', options, function (err, swaggerObject) {
      assert.ifError(err);
      // swagger definitions that can be referenced by different endpoint definitions
      var definitions = swaggerObject.definitions;

      // these are the different endpoint paths
      var pathsKeys = Object.keys(swaggerObject.paths);
      async.forEach(pathsKeys, function (pathKey, callback) {
        var path = swaggerObject.paths[pathKey];
        if ('get' in path) {
          var method = path.get;
          var finalPath = replaceParams(pathKey, replacementMap);
          supertest(url)
            .get(finalPath)
            .expect(200)
            .end(function (err, res) {
              assert.ifError(err, 'Error found when getting ' + finalPath + ': ' + err);

              var expectedResponseObject = method.responses[res.status];
              var expectedResponseDefinitionObject;
              if ('$ref' in expectedResponseObject.schema) {
                expectedResponseDefinitionObject = definitions[expectedResponseObject.schema.$ref];
              }
              console.info('Testing Swagger definition \'' + method.description + '\' for request path: ' + finalPath);
              validate(finalPath, res.body, expectedResponseDefinitionObject, definitions);
              callback();
            });
        } else {
          callback();
        }
      }, done);
    });
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
