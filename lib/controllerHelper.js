/**
 * Copyright (c) 2014 TopCoder, Inc. All rights reserved.
 */
/**
 * Helper methods for controller logic.
 *
 * @version 1.0
 * @author peakpado
 */
'use strict';

var async = require('async');
var _ = require('lodash');
var queryConfig = require('config').get('app.query');
var routeHelper = require('./routeHelper');
var paramHelper = require('./paramHelper');

/**
 * Find an entity with the provided filters and its own id.
 * @param model the entity model
 * @param filters the current filters
 * @param req the request
 * @param callback the async callback
 */
function _findEntityByFilter(model, filters, req, callback) {
  // add the id parameter to the filters
  var idParam = routeHelper.getRefIdField(model);
  var idParamValue = req.swagger.params[idParam].value;
  var idValue = Number(idParamValue);
  // check id is valid numer and positive number
  if (_.isNaN(idValue) || idValue < 0) {
    routeHelper.addErrorMessage(req, 'Invalid id parameter '+idParamValue, 400);
    callback(req.error);
  } else {
    var refFilters = _.cloneDeep(filters);
    refFilters.where.id = idValue;
    model.find(refFilters).success(function(entity) {
      if (!entity) {
        routeHelper.addErrorMessage(req, 'Cannot find the '+ model.name + ' with id '+idParamValue, 404);
        callback(req.error);
      } else {
        callback(null, filters, entity);
      }
    })
    .error(function(err) {
      routeHelper.addError(req, err);
      callback(req.error);
    });
  }
}

/**
 * Build filters from request query parameters.
 * @param model the entity model
 * @param filtering the boolean flag of whether a filtering is enabled or not
 * @param filters the current filters
 * @param req the request
 * @param callback the async callback
 */
function _buildQueryFilter(model, filtering, filters, req, callback) {
  if (!filters) {
    filters = { where: {} };   // start with emtpty filter
  }
  if (filtering) {
    filters.offset = 0;
    filters.limit = queryConfig.pageSize;
    // req.swagger.params returns empty value for non-existing parameters, it can't determine it's non-existing
    // or empty value. So req.query should be used to validate empty value and not-supportd parameters.
    // parse request parameters.
    _.each(_.keys(req.query), function(key) {
      if (key === 'offset' || key === 'limit') {
        paramHelper.parseLimitOffset(req, filters, key, req.query[key]);
      } else if (key === 'orderBy') {
        paramHelper.parseOrderBy(model, req, filters, req.query[key]);
      } else if (key === 'filter') {
        paramHelper.parseFilter(model, req, filters, req.query[key]);
      } else {
        routeHelper.addValidationError(req, 'The request parameter ' + key + ' is not supported');
      }
    });
  }
  callback(req.error, filters);
}

/**
 * Build filters from reference models.
 * @param referenceModels the array of referencing models
 * @param req the request
 * @param callback the async callback
 */
function _buildReferenceFilter(referenceModels, req, callback) {
  var filters = { where: {} };   // start with emtpty filter
  if (!referenceModels) {
    callback(null, filters);
  } else {
    async.eachSeries(referenceModels, function(refModel, cb) {
      var idParam = routeHelper.getRefIdField(refModel);
      var idParamValue = req.swagger.params[idParam].value;
      var idValue = Number(idParamValue);
      // check id is valid numer and positive number
      if (_.isNaN(idValue) || idValue < 0) {
        routeHelper.addErrorMessage(req, 'Invalid id parameter '+idParamValue, 400);
        cb(req.error);
      } else {
        var refFilters = _.cloneDeep(filters);
        refFilters.where.id = idValue;
        // verify an element exists in the reference model
        refModel.find(refFilters).success(function(refEntity) {
          if(!refEntity) {
            routeHelper.addErrorMessage(req, 'Cannot find the '+ refModel.name + ' with id '+idParamValue, 404);
            cb(req.error);
          } else {
            // add the id of reference element to filters
            filters.where[idParam] = refEntity.id;
            cb(null);
          }
        }).error(function(err) {
            routeHelper.addError(req, err);
            cb(req.error);
        });
      }
    }, function(err) {
      if (err) {
        callback(req.error);
      } else {
        // pass the filters to the next function in async
        callback(null, filters);
      }
    });
  }
}

var ALLOWED_PARAMETERS = ['expand'];

/**
 * Return error if there are extra parameters.
 * @param req the request
 * @param callback the async callback
 */
function _checkExtraParameters(req, callback) {
  if (_.keys(req.query).length > 0) {
    _.each(_.keys(req.query), function(param) {
      if (ALLOWED_PARAMETERS.indexOf(param) === -1) {
        routeHelper.addErrorMessage(req, 'Query parameter '+param+' is not allowed', 400);
        callback(req.error);
      }
    });
  }
  callback(null);
}

/**
 * This function retrieves all entities in the model by filters.
 * @param model the entity model
 * @param filters the filters to search
 * @param req the request
 * @param funcCallback the callback to return the result
 */
function findEntities(model, filters, req, funcCallback) {
  model.findAndCountAll(filters).success(function(result) {
    funcCallback(null, result.count, result.rows);
  })
  .error(function(err) {
    routeHelper.addError(req, err);
    funcCallback(req.error);
  });
}

/**
 * This function retrieves all entities in the model filtered by referencing model
    and search criterias if filtering is enabled.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param funcCallback the callback to return the result
 */
function allEntities(model, referenceModels, options, req, funcCallback) {
  async.waterfall([
    function(callback) {
      if (!options.filtering) {
        _checkExtraParameters(req, callback);
      } else {
        callback(null);
      }
    },
    function(callback) {
      _buildReferenceFilter(referenceModels, req, callback);
    },
    function(filters, callback) {
      _buildQueryFilter(model, options.filtering, filters, req, callback);
    },
    function(filters, callback) {
      // use entity filter IDs if configured
      if (options && options.entityFilterIDs) {
        filters.where = _.omit(filters.where, function(value, key) {
          return options.entityFilterIDs.indexOf(key) === -1;
        });
      }

      findEntities(model, filters, req, callback);
    }
  ], function(err, totalCount, entities) {
    funcCallback(err, totalCount, entities);
  });
}

/**
 * This function retrieves all entities in the model filtered by referencing model
    and search criterias if filtering is enabled.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param res the response
 * @param next the next function in the chain
 */
function all(model, referenceModels, options, req, res, next) {
  allEntities(model, referenceModels, options, req, function(err, totalCount, entities) {
    if (!err) {
      req.data = {
        success: true,
        status: 200,
        metadata: {
          totalCount: totalCount
        },
        content: entities
      };
    }
    next();
  });
}

var ASSOCIATION_TYPE_INVALID = 0;
var ASSOCIATION_TYPE_1 = 1; // parent-child association
var ASSOCIATION_TYPE_2 = 2; // child-parent association
var ASSOCIATION_TYPE_3 = 3; // self association
var ASSOCIATION_TYPE_4 = 4; // reverse self-association

/**
 * This function processes an expand parameter.
 * @param model the entity model
 * @param expands the array of expand parameters
 * @param entity the current entity object to expand
 * @param req the request
 * @param callback the callback method to return the result
 */
function _processExpandParameter(model, expands, entity, req, callback) {

  if (!_.isEmpty(expands)) {

    var associationType = ASSOCIATION_TYPE_INVALID;
    var sourceModel = model;
    var sourceEntity = entity;
    var expand = expands.shift(); // get the first expand
    if (expands.length === 1 && expands[0] === 'all') {
      expands.unshift(expand);    // the entire message tree: keeps go until there is no data
    }

    var identifierToAssociationMap = {};
    _.each(model.associations, function(associ) {
      identifierToAssociationMap[associ.identifier] = associ;
    });

    var filters = {where: {}};
    var targetModel;

    // has association?
    var association = sourceModel.getAssociationByAlias(expand);
    if (association) {
      var sourceIdentifier = association.identifier;
      // get the target model
      targetModel = association.target;
      var targetAssociation = targetModel.getAssociationByAlias(expand);
      var targetIdentifier;
      if (targetAssociation) {  // expand exists in source and target
        targetIdentifier = targetAssociation.identifier;
      }

      if (sourceModel.name === targetModel.name) {                // 3. self association: messages
        associationType = ASSOCIATION_TYPE_3;
        filters.where[targetIdentifier] = sourceEntity.id;
      } else if (association.associationType === 'BelongsTo') {   // 2. child-parent association: discussion
        associationType = ASSOCIATION_TYPE_2;
        filters.where.id = sourceEntity[sourceIdentifier];
      } else {                                                    // 1. parent-child association: Discussion.messages
        var refId = routeHelper.getRefIdField(sourceModel);
        associationType = ASSOCIATION_TYPE_1;
        filters.where[refId] = sourceEntity.id;
        if (targetIdentifier) {  // expand exists in source and target
          filters.where[targetIdentifier] = null;   // only the first level
        }
      }
    } else if (_.keys(identifierToAssociationMap).indexOf(expand+'Id') > -1) {  // 4. reverse self-association: parentMessageId
      var reverseIdentifier = expand+'Id';
      associationType = ASSOCIATION_TYPE_4;
      if (sourceEntity[reverseIdentifier]) {
        filters.where.id = sourceEntity[reverseIdentifier];
        targetModel = sourceModel;
      }
    }

    // found an association or identifier
    if (targetModel) {
      targetModel.findAndCountAll(filters).success(function(result) {
        if (associationType === ASSOCIATION_TYPE_2 || associationType === ASSOCIATION_TYPE_4) {
          sourceEntity.setDataValue(expand, result.rows[0]);
        } else {
          sourceEntity.setDataValue(expand, result.rows);
        }

        if (expands.length > 0 && result.count > 0) {   // more expands and got data
          // process expand in each entity in result resursively
          async.eachSeries(result.rows, function(row, cb) {
            var clonedExpand = _.cloneDeep(expands);
            _processExpandParameter(targetModel, clonedExpand, row, req, cb);
          }, function(err) {
            // when all rows are done, return
            callback(err, entity);
          });
        } else {  // no expand or no data, done!
          callback(null, entity);
        }

      })
      .error(function(err) {
        callback(err);    // error, done!
      });

    } else {  // no association, done!
      console.log('No association for ', expand);
      callback(null, entity);
    }

  } else {  // expands is empty, done!
    callback(null, entity);
  }
}

/**
 * This function gets an entity by id.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param funcCallback the callback to return the result
 */
function getEntity(model, referenceModels, options, req, funcCallback) {
  async.waterfall([
    function(callback) {
      _checkExtraParameters(req, callback);
    },
    function(callback) {
      _buildReferenceFilter(referenceModels, req, callback);
    },
    function(filters, callback) {
      // use entity filter IDs if configured
      if (options && options.entityFilterIDs) {
        filters.where = _.omit(filters.where, function(value, key) {
          return options.entityFilterIDs.indexOf(key) === -1;
        });
      }
      _findEntityByFilter(model, filters, req, callback);
    },
    function(filters, entity, callback) {
      // process expand parameter
      if (req.query.expand) {
        var expands = _.map(req.query.expand.split('.'), function(expand) {
          return expand.trim();
        });
        _processExpandParameter(model, expands, entity, req, callback);
      } else {
        callback(null, entity);
      }
    }
  ], function(err, entity) {
    funcCallback(err, entity);
  });

}

/**
 * This function gets an entity by id.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param res the response
 * @param next the next function in the chain
 */
function get(model, referenceModels, options, req, res, next) {
  getEntity(model, referenceModels, options, req, function(err, entity) {
    if (!err) {
      req.data = {
        success: true,
        status: 200,
        content: entity
      };
    }
    next();
  });
}

/**
 * This function creates an entity.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param funcCallback the callback to return the result
 */
function createEntity(model, referenceModels, options, req, funcCallback) {
  async.waterfall([
    function(callback) {
      _checkExtraParameters(req, callback);
    },
    function(callback) {
      _buildReferenceFilter(referenceModels, req, callback);
    },
    function(filters, callback) {
      // exclude prohibited fields
      var data = _.omit(req.swagger.params.body.value, 'id', 'createdAt', 'updatedAt', 'createdBy');
      // set createdBy and updatedBy user
      data.createdBy = routeHelper.getSigninUser();
      data.updatedBy = routeHelper.getSigninUser();
      // add foreign keys
      _.extend(data, filters.where);
      model.create(data).success(function(entity) {
        callback(null, entity);
      })
      .error(function(err) {
        routeHelper.addError(req, err);
        callback(req.error);
      });
    }
  ], function(err, entity) {
    funcCallback(err, entity);
  });
}

/**
 * This function creates an entity.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param res the response
 * @param next the next function in the chain
 */
function create(model, referenceModels, options, req, res, next) {
  createEntity(model, referenceModels, options, req, function(err, entity) {
    if (!err) {
      req.data = {
        id: entity.id,
        result: {
          success: true,
          status: 200
        }
      };
    }
    next();
  });
}

/**
 * This function updates an entity.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param funcCallback the callback to return the result
 */
function updateEntity(model, referenceModels, options, req, funcCallback) {
  async.waterfall([
    function(callback) {
      _checkExtraParameters(req, callback);
    },
    function(callback) {
      _buildReferenceFilter(referenceModels, req, callback);
    },
    function(filters, callback) {
      // use entity filter IDs if configured
      if (options && options.entityFilterIDs) {
        filters.where = _.omit(filters.where, function(value, key) {
          return options.entityFilterIDs.indexOf(key) === -1;
        });
      }
      _findEntityByFilter(model, filters, req, callback);
    },
    function(filters, entity, callback) {
      var excludeFields = Object.keys(filters.where);
      _.map(['id', 'createdAt', 'updatedAt', 'createdBy'], function(field) {
        excludeFields.push(field);
      });
      // exclude prohibited fields
      var data = _.omit(req.swagger.params.body.value, excludeFields);
      _.extend(entity, data);
      entity.updatedBy = routeHelper.getSigninUser();
      entity.save().success(function() {
        callback(null, entity);
      })
      .error(function(err) {
        routeHelper.addError(req, err);
        callback(req.error);
      });
    }
  ], function(err, entity) {
    funcCallback(err, entity);
  });
}

/**
 * This function updates an entity.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param res the response
 * @param next the next function in the chain
 */
function update(model, referenceModels, options, req, res, next) {
  updateEntity(model, referenceModels, options, req, function(err, entity) {
    if (!err) {
      req.data = {
        id: entity.id,
        result: {
          success: true,
          status: 200
        }
      };
    }
    next();
  });
}

/**
 * This function deletes an entity.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param funcCallback the callback to return the result
 */
function deleteEntity(model, referenceModels, options, req, funcCallback) {
  async.waterfall([
    function(callback) {
      _checkExtraParameters(req, callback);
    },
    function(callback) {
      _buildReferenceFilter(referenceModels, req, callback);
    },
    function(filters, callback) {
      // use entity filter IDs if configured
      if (options && options.entityFilterIDs) {
        filters.where = _.omit(filters.where, function(value, key) {
          return options.entityFilterIDs.indexOf(key) === -1;
        });
      }
      _findEntityByFilter(model, filters, req, callback);
    },
    function(filters, entity, callback) {
      entity.destroy().success(function() {
        callback(null, entity);
      })
      .error(function(err) {
        routeHelper.addError(req, err);
        callback(req.error);
      });
    }
  ], function(err, entity) {
    funcCallback(err, entity);
  });
}

/**
 * This function deletes an entity.
 * @param model the entity model
 * @param referenceModels the array of referencing models
 * @param options the controller options
 * @param req the request
 * @param res the response
 * @param next the next function in the chain
 */
function deleteMethod(model, referenceModels, options, req, res, next) {
  deleteEntity(model, referenceModels, options, req, function(err, entity) {
    if (!err) {
      req.data = {
        id: entity.id,
        result: {
          success: true,
          status: 200
        }
      };
    }
    next();
  });
}

exports.allEntities = allEntities;
exports.findEntities = findEntities;
exports.getEntity = getEntity;
exports.createEntity = createEntity;
exports.updateEntity = updateEntity;
exports.deleteEntity = deleteEntity;

/**
 * Build the CRUD controller for a model.
 */
exports.buildController = function(model, referenceModels, options) {
  var controller = {};

  // Get an entity.
  controller.get = function(req, res, next) {
    get(model, referenceModels, options, req, res, next);
  };

  // Create an entity.
  controller.create = function(req, res, next) {
    create(model, referenceModels, options, req, res, next);
  };

  // Update an entity.
  controller.update = function(req, res, next) {
    update(model, referenceModels, options, req, res, next);
  };

  // Retrieve all entities.
  controller.all = function(req, res, next) {
    all(model, referenceModels, options, req, res, next);
  };

  // Delete an entity.
  controller.delete = function(req, res, next) {
    deleteMethod(model, referenceModels, options, req, res, next);
  };

  return controller;
};


