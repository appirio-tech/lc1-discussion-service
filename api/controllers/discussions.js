'use strict';


var datasource = require('./../../datasource').getDataSource();
var Discussion = datasource.Discussion;
var Message = datasource.Message;
var paramHelper = require('./../../lib/paramHelper');
var routeHelper = require('./../../lib/routeHelper');
var async = require('async');
var _ = require('lodash');
var queryConfig = require('config').get('app.query');


/**
 * Create a discussion.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function create(req, res, next) {
  var data = _.omit(req.swagger.params.body.value, 'discussionId', 'createdAt', 'updatedAt');
  data.createdBy = routeHelper.getSigninUser();
  data.updatedBy = routeHelper.getSigninUser();

  Discussion.create(data).success(function(discussion) {
    req.data = { 
      id: discussion.discussionId,
      result: {
        success: true,
        status: 200
      }
    };
    next();
  })
  .error(function(err) {
    routeHelper.addError(req, err);
    next();
  });
}


/**
 * Find discussions by filters.
 * @param req the request
 * @param filters the filters used in the query
 * @param funcCallback the callback to return the result
 */
function _findDiscussions(req, filters, funcCallback) {

  async.waterfall([
    function(callback) {
      // get discussions and total count
      Discussion.findAndCountAll(filters).success(function (result) {
        callback(null, result.count, result.rows);
      })
      .error(function (err) {
        routeHelper.addError(req, err);
        callback(req.error);
      });
    },
    function(count, discussions, callback) {
      // get the number of first level messages
      async.each(discussions, function(discussion, cb) {
        var messageFilters = {
          where: {
            discussionId: discussion.discussionId,
            parentMessageId: null
          }
        };
        Message.count(messageFilters).success(function(count) {
          discussion.dataValues.messageCount = count;
          cb();
        })
        .error(function(err) {
          cb(err);
        });
      }, function(err) {
        callback(err, count, discussions);
      });
    }
  ], function(err, totalCount, discussions) {
    if (err) {
      routeHelper.addError(req, err);
      funcCallback(req.error);
    } else {
      funcCallback(null, totalCount, discussions);
    } 
  });

}

/**
 * Get discussions by filtering.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function getDiscussions(req, res, next) {
  async.waterfall([
    function(callback) {    
      // create a default filters
      var filters = {
        offset: 0,
        limit: queryConfig.pageSize,
        where: {}
      };
      // req.swagger.params returns empty value for non-existing parameters, it can't determine it's non-existing
      // or empty value. So req.query should be used to validate empty value and not-supported parameters.
      // parse request parameters
      _.each(_.keys(req.query), function(key) {
        if (key === 'offset' || key === 'limit') {
          paramHelper.parseLimitOffset(req, filters, key, req.query[key]);
        } else if (key === 'orderBy') {
          paramHelper.parseOrderBy(Discussion, req, filters, req.query[key]);
        } else if (key === 'filter') {
          paramHelper.parseFilter(Discussion, req, filters, req.query[key]);
        } else {
          routeHelper.addValidationError(req, 'Request parameter ' + key + ' is not supported');
        }
      });
      callback(req.error, filters);
    },
    function(filters, callback) {
      // get discussions and total count
      _findDiscussions(req, filters, function(err, totalCount, discussions) {
        callback(err, totalCount, discussions);
      });
    }
  ], function(err, totalCount, discussions) {
    if (!err) {
      req.data = {
        success: true,
        status: 200,
        metadata: {
          totalCount: totalCount
        },
        content: discussions
      };
    } 
    next();
  });

}

/**
 * Find a discussion by discussionId.
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
function findById(req, res, next) {
  var discussionId = req.swagger.params.discussionId.value;
  var filters = {
    where: {
      discussionId: discussionId
    }
  };

  _findDiscussions(req, filters, function(err, totalCount, discussions) {
    if (!err) {
      if (totalCount === 0) {
        routeHelper.addErrorMessage(req, 'Cannot find the discussion with discussionId '+discussionId, 404);
      } else {
        req.data = {
          success: true,
          status: 200,
          content: discussions[0] // there should be only one discussion
        };
      }
    } 
    next();
  });
}

module.exports = {
  create: create,
  getDiscussions: getDiscussions,
  findById: findById

};
