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
var expandHelper = require('./expandHelper');
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

/**
 * Return error if there are extra parameters.
 * @param req the request
 * @param callback the async callback
 */
function _checkExtraParameters(req, callback) {
  if (_.keys(req.query).length > 0) {
    routeHelper.addErrorMessage(req, 'Query parameter is not allowed', 400);
    callback(req.error);
  } else {
    callback(null);
  }
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
    //expand the queried entities.
    expandHelper.expandObject(model, req, next);
  });
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
    }
  ], function(err, filters, entity) {
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
    //expand the queried entity
    expandHelper.expandObject(model, req, next);
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
