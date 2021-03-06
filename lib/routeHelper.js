'use strict';

var _ = require('lodash');
var tcUser = require('../lib/tc-auth/tcUser');

/**
 * Add Error object to request.
 * @param req the request
 * @param err the origianl Error
 * @param errCode the error code
 */
exports.addError = function(req, err, errCode) {
  req.error = {};

  if (err instanceof Array) {   // Sequelize returns array
    req.error.message = err[0].message;
  } else if (err.message) {
    req.error.message = err.message;
  } else if (err.errors && err.errors instanceof Array) {
    req.error.errors = err.errors;
  } else if (typeof err === 'string') {  // error from a127 middleware validation error
      req.error.message = err;
  } else {
    req.error.message = 'request failed';
  }
  req.error.code = errCode || req.error.code || 500;
};

/**
 * Add error name and message to request.
 * @param req the request
 * @param errMsg the error message
 * @param errCode the error code
 */
exports.addErrorMessage = function(req, errMsg, errCode) {
  req.error = {};
  req.error.message = errMsg;
  req.error.code = errCode || req.error.code || 500;
};

/**
 * Add validation error to request.
 * @param req the request
 * @param errMsg the error message
 */
exports.addValidationError = function(req, errMsg) {
  if (!req.error) {
    req.error = {};
  }
  if (!req.error.errors) {
    req.error.errors = [];
  }
  req.error.code = 400;
  req.error.errors.push(new Error(errMsg));
};

/**
 * Return the user currently singed in.
 * @param req the request
 */
exports.getSigninUser = function(req) {
  return tcUser.getSigninUser(req);
};

/**
 * return the req parameter key or foreign key from model name
 * @param refModel the model object
 */
exports.getRefIdField = function(refModel) {
  var name = refModel.name;
  return name.charAt(0).toLowerCase() + name.slice(1) + 'Id';
};

/**
 * This method renders result (req.error or req.data) as JSON.
 * @param req the request
 * @param res the response
 */
exports.renderJson = function(req, res) {
  if (req.error) {
    if (req.error.errors) {   // validation errors
      res.status(req.error.code).json({
        result: {
          success: false,
          status: req.error.code,
          content: _.pluck(_.values(req.error.errors), 'message').join('. ')
        }
      });
    } else {
      res.status(req.error.code).json({
        result: {
          success: false,
          status: req.error.code,
          content: req.error.message
        }
      });
    }
  } else if (req.data) {
    res.status(200).json(req.data);
  } else {
    res.status(404).json({
      result: {
        success: false,
        status: 404,
        content: 'Resource is not found'
      }
    });
  }
};

/**
 * Add error message to request.
 * @param req the request
 * @param errMsg the error message
 * @param errCode the error code
 */
var addErrorMessage = exports.addErrorMessage = function(req, errMsg, errCode) {
  req.error = {};
  req.error.message = errMsg;
  req.error.code = errCode || req.error.code || 500;
};

/**
 * Generic error handling middleware.
 * @param err the error
 * @param req the request
 * @param res the response
 * @param next the next middleware in the route
 */
exports.errorHandler = function(err, req, res, next) {
  if (err) {
    exports.addError(req, err, 400);
  }
  next();
};

/**
 * Authentication handler for authenticated paths defined in configuration settings
 */
exports.requireAuth = function(req, res, next) {
  if(!req.user || !req.tcUser) {
    addErrorMessage(req, 'User is not authenticated', 401);
    return exports.renderJson(req, res);
  }
  next();
};
