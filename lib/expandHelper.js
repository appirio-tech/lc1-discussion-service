/**
 * Copyright (c) 2014 TopCoder, Inc. All rights reserved.
 */
/**
 * Helper methods for expand parameter logic.
 *
 * @version 1.0
 * @author lovefreya
 */
'use strict';

var _ = require('lodash');
var async = require('async');
var pluralize = require('pluralize');
var routeHelper = require('./routeHelper');
var dataSource = require('../datasource');

/**
 * This method use each expand parameter as input.
 * Then generate an array based on each parameter.
 * This array collect the cut entity of the expand parameter in sequence like:
 *
 * input param: "messages.messages.messages"
 * output array: ["messages", "messages", "messages"]
 *
 * And:
 *
 * input param: "messages.discussion"
 * output array: ["messages", "discussion"]
 *
 * @param req request object
 * @param param expand parameter waiting for a series of trim
 * @return Array: cut entities array
 */
function _trimParam(req, param) {
  var resultArray = [];
  var result = param.trim();
  if (result[result.length - 1] === '.') {
    // if the expand parameter like 'expand[]=messages.', the validation will generate this error'.
    routeHelper.addValidationError(req, 'Expand parameter cannot end up with \'.\'');
  }
  do {
    // find the nearest entity in the param string
    var firstIndex = result.indexOf('.');
    var endOfSubString = firstIndex === -1 ? result.length : firstIndex;
    var startOfSubString = 0;
    var subString = result.substring(startOfSubString, endOfSubString);
    result = result.substring(endOfSubString + 1, result.length);
    resultArray.push(subString);
  } while (result.indexOf('.') !== -1 || result.length !== 0);
  return resultArray;
}

/**
 * validate whether the subParam is a model or not.
 * if yes, return the model name.
 * @param subParam a substring in expand parameter.
 *        example:
 *          if expand parameter is "messages.discussion"
 *          the subParam could be "messages" or "discussion"
 * @returns String: null or model's name.
 *        example:
 *          subParam "messages" represent the model: Message (subParam must be plural for a model's name)
 *          then return "Message"
 */
function _isModel(subParam) {
  var isModel = null;
  _.forEach(_.keys(dataSource.getDataSource()), function (key) {
    if (pluralize(key.toLowerCase()) === subParam) {
      isModel = key;
    }
  });
  return isModel;
}

/**
 * validate whether the subParam is a term.
 * Currently, the only allowed term is "all".
 * The allowed terms can be updated in future.
 * @param subParam the same as _isModel's parameter
 * @returns String: null or a term
 */
function _isTerm(subParam) {
  var terms = ['all'];
  var foundTerm = null;
  _.forEach(terms, function (term) {
    if (subParam === term) {
      foundTerm = term;
    }
  });
  return foundTerm;
}

/**
 * Judge whether a model has a specified key
 * @param Model Sequelize model
 * @param column table column name
 * @returns {boolean} if the model has the key, return true. Otherwise false.
 */
function _hasKey(Model, column) {
  var found = false;
  _.forEach(_.keys(Model.rawAttributes), function (key) {
    if (key === column) {
      found = true;
    }
  });
  return found;
}

/**
 * Judge whether modelA has many modelB
 * @param modelA
 * @param modelB
 * @returns if has, return true. Otherwise false.
 */
function _hasMany(modelA, modelB) {
  var has = false;
  var Model = typeof modelA === 'string' ? dataSource.getDataSource()[modelA] : modelA;
  if (Model) {
    _.forEach(_.keys(Model.associations), function (associatedModel) {
      if (modelB === associatedModel &&
        Model.associations[associatedModel].associationType === 'HasMany') {
        has = true;
      }
    });
  }
  return has;
}

/**
 * validate whether the subParam is a foreignKey and it belongs to
 * the Model which represented by the previous subParam.
 * @param subParam the same as _isModel's parameter
 * @param modelName the name of the Model which represented by the previous subParam
 * @return String: if foreignKey exist, return the key. Otherwise, return null
 */
function _isForeignKey(subParam, modelName) {
  var key = null;
  var model = dataSource.getDataSource()[modelName];
  if (model && _hasKey(model, subParam + 'Id')) {
    key = subParam + 'Id';
  }
  return key;
}

/**
 * Validate and transform the expand parameter.
 * example:
 *    Input: ["messages", "messages"]
 *    Output: ["Message", "Message"]
 *
 *    Input: ["messages", "discussion"]
 *    Output: ["Message", "discussionId"]
 * @param req request object
 * @param trimParam the trim expand parameter, collected in this array
 * @returns Array: validated and transformed expand parameter array
 */
function _validateTermsInParam(req, trimParam) {
  var tmpString;
  for (var i = 0; i < trimParam.length; i += 1) {
    var subParam = trimParam[i];
    //The first subParam must be a Model.
    if (i === 0) {
      tmpString = _isModel(subParam);
      if (!tmpString) {
        routeHelper.addValidationError(req, 'Expand parameter must start with a known Model.');
        break;
      } else {
        //update this subParam to its model name.
        trimParam[i] = tmpString;
      }
    } else {
      tmpString = _isModel(subParam);
      if (!tmpString) {
        //this subParam is not a model
        tmpString = _isTerm(subParam);
        if (!tmpString) {
          //this subParam is not a term. It must be a foreign key now.
          tmpString = _isForeignKey(subParam, trimParam[i - 1]);
          if (!tmpString) {
            //this subParam is not a foreign key of the previous model
            //Or the previous subParam represent a term not a model.
            routeHelper.addValidationError(req, 'Cannot find foreignKey ' + subParam +
            ' in ' + trimParam[i - 1] + ' in the expand parameter.');
            break;
          } else {
            if (i === 1) {
              //update this subParam to a full foreignKey
              trimParam[i] = tmpString;
            } else {
              //Such as messages.messages.discussion is not allowed.
              //The foreignKey can only be in second position.
              routeHelper.addValidationError(req, 'The foreignKey ' + trimParam[i] +
              ' must in the second position in the expand parameter.');
              break;
            }
          }
        } else {
          if (i === 1) {
            //keep this validated term string
            trimParam[i] = tmpString;
          } else {
            //Such as messages.messages.all is not allowed.
            //If a term all exist, it can only be in position 2. Like messages.all.
            routeHelper.addValidationError(req, 'Cannot have more than one Model before a ' +
            'term in the expand parameter');
            break;
          }
        }
      } else {
        //if this subParam represent a Model, this model must be the child of
        //the model which represented by the previous subParam
        if (_hasMany(trimParam[i - 1], tmpString)) {
          //update this subParam to its model name.
          trimParam[i] = tmpString;
        } else {
          routeHelper.addValidationError(req, trimParam[i - 1] + ' in the expand parameter' +
          ' is not a Model or it does not has many ' + tmpString);
          break;
        }
      }
    }
  }

  return trimParam;
}

/**
 *  append the depth of the expand and make the expand parameter to a full object
 *  example:
 *    input: [ ModalA, ModalA, ModalA]
 *    output:
 *    {
 *      expandRules: [ModalA, ModalA, ModalA],
 *      expandDepth: 3
 *    }
 *    input: [ ModalA, ModalA, ModalB]
 *    output:
 *    {
 *      expandRules: [ModalA, ModalA, ModalB],
 *      expandDepth: -1
 *    }
 *    input: [ ModalA, all]
 *    output:
 *    {
 *      expandRules: [ModalA, all],
 *      expandDepth: 999999999
 *    }
 *    input: [ ModalA, foreignKey]
 *    output:
 *    {
 *      expandRules: [ModalA, ModalA, foreignKey],
 *      expandDepth: -1
 *    }
 * @param param validated and transformed expand subParam array
 * @returns Object: expand parameter pair
 */
function assembleExpandParam(param) {
  var paramObject = {};
  paramObject.expandRules = param;
  paramObject.expandDepth = 1;

  var model = param[0];
  for (var i = 1; i < param.length; i += 1) {
    if (param[i] === model) {
      paramObject.expandDepth += 1;
    } else {
      if (_isTerm(param[i]) === 'all') {
        // if there is a 'all' in expand parameter, the expand depth will be a infinity.
        paramObject.expandDepth = 999999999;
      }
      break;
    }
  }

  // ignore the depth if this expand parameter is in the following pattern:
  // [ Model, Model, ..., foreignKey ] because this pattern cannot decide the depth.
  // Only [ Model, Model, ..., Model ] or [ Model, all ] or [Model] can
  if (paramObject.expandDepth < param.length) {
    paramObject.expandRules.splice(0, 1);
    paramObject.expandDepth = -1;
  }
  return paramObject;
}

/**  if there are multi depth on the same model, generate a validation error.
 * @param req
 * @param expandParams
 * @return Object: each model's depth
 */
function _confirmDepth(req, expandParams) {
  var depth = {};
  _.forEach(expandParams, function (paramObj) {
    if (paramObj.expandDepth > 0) {
      var model = depth[paramObj.expandRules[0]];
      if (!model) {
        depth[paramObj.expandRules[0]] = {
          depth: null
        };
        model = depth[paramObj.expandRules[0]];
      }
      if (!model.depth) {
        model.depth = paramObj.expandDepth;
      } else {
        if (model.depth !== paramObj.expandDepth) {
          routeHelper.addValidationError(req, 'Multi expand depth in the same Model (' +
          paramObj.expandRules[0] + ') is not accepted in expand parameters.');
        }
      }
    }
  });
  //reduce the obj to array, remove each parameter's depth
  for (var i = 0; i < expandParams.length; i += 1) {
    expandParams[i] = expandParams[i].expandRules;
  }
  return depth;
}

/**
 * Parse the expand parameter in request object
 * then generate the expandQuery object and append to request object
 * @param req request object
 * @param res response object
 * @param next
 */
exports.parseExpandParam = function (req, res, next) {
  var params = _.cloneDeep(req.query.expand);
  //delete query
  delete req.query.expand;
  if (params) {

    var expandParams = [];

    if (req.method !== 'GET') {
      routeHelper.addValidationError(req, 'Expand parameter is not allowed for ' + req.method + ' call.');
    } else {
      _.forEach(params, function (param) {
        expandParams.push(assembleExpandParam(_validateTermsInParam(req, _trimParam(req, param))));
      });

      var depth = _confirmDepth(req, expandParams);
      req.expandQuery = {
        params: expandParams,
        depth: !depth ? 1 : depth
      };
    }
  }
  next();
};

/**
 * Expand the retrieved objects based on the req.expandQuery
 * @param req request body
 * @param Model
 * @param Offset
 * @param Entity
 * @param property
 * @param Params
 * @param callback
 */
function recursionExpand(req, Model, Offset, Entity, property, Params, callback) {
  if (!Model) {
    return;
  }
  var tasks = [];
  _.forEach(Params, function (paramArray) {
    tasks.push(function (callback) {
      var subParam = paramArray[Offset];
      if (!subParam) {
        return callback(null);
      } else if (_hasKey(Model, subParam)) {
        Model.findAssociatedObject(dataSource.getDataSource(), subParam, Entity[property][subParam], function (error, associatedObject) {
          if (error) {
            Entity[property][subParam.substring(0, subParam.length - 2)] = {};
            routeHelper.addError(req, error, 500);
          } else {
            Entity[property][subParam.substring(0, subParam.length - 2)] = associatedObject;
          }
          callback(null);
        });
      } else if (_hasMany(Model, subParam) || subParam==='all') {
        if(subParam==='all'){
          subParam = paramArray[0];
          paramArray.push('all');
        }
        if (_.isArray(Entity[property])) {
          for (var i = 0; i < Entity[property].length; i += 1) {
            Entity[property][i] = Entity[property][i].values;
          }
          var tasksB = [];
          var index = -1;
          _.forEach(Entity[property], function (entity) {
            tasksB.push(function (callback) {
              Model.findChildren(dataSource.getDataSource()[subParam], entity.id, function (error, children) {
                if (error) {
                  entity[pluralize(subParam.toLowerCase())] = [];
                  routeHelper.addError(req, error, 500);
                } else {
                  entity[pluralize(subParam.toLowerCase())] = children;
                }
                index += 1;
                recursionExpand(req, Model.name===subParam? dataSource.getDataSource()[subParam]: Model, Offset, Entity[property], index, Params, callback);
              });
            });
          });
          async.series(tasksB, function (err, results) {
            callback(null);
          });
        } else {
          Entity[property] = Entity[property].values ? Entity[property].values: Entity[property];
          Model.findChildren(dataSource.getDataSource()[subParam], Entity[property].id, function (error, children) {
            if (error) {
              Entity[property][pluralize(subParam.toLowerCase())] = [];
              routeHelper.addError(req, error, 500);
            } else {
              Entity[property][pluralize(subParam.toLowerCase())] = children;
            }
            recursionExpand(req, dataSource.getDataSource()[subParam], Offset + 1, Entity[property], pluralize(subParam.toLowerCase()), Params, callback);
          });
        }
      } else{
        return callback(null);
      }
    });
  });

  async.series(tasks, function (err, results) {
    callback();
  });
}

/**
 * expand objects to queried objects
 * @param model the resource model
 * @param req request object
 * @param next
 */
exports.expandObject = function (model, req, next) {
  if (!req.data || !req.data.content || !req.expandQuery || req.error) {
    next();
  } else {
    var modelHasAllTheFirstModel = true;
    var notHasMany = '';
    _.forEach(req.expandQuery.params, function (expandParam) {
      if (!_hasMany(model, expandParam[0]) && !_hasKey(model, expandParam[0])) {
        modelHasAllTheFirstModel = false;
        notHasMany = expandParam[0];
      }
    });
    if (modelHasAllTheFirstModel) {
      recursionExpand(req, model, 0, req.data, 'content', req.expandQuery.params, next);
    } else {
      routeHelper.addValidationError(req, notHasMany + ' is not allowed in the first position of expand parameter.');
      next();
    }
  }
};