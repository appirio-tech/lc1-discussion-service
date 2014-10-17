'use strict';


var _ = require('lodash');
var routeHelper = require('./routeHelper');


/**
 * Set a filter to filters object.
 * @param req the request
 * @param filters the filters
 * @param operator the operator
 * @param field the field name
 * @param value the field value
 */
function _setFilter(req, filters, operator, field, value) {
  switch (operator) {
    case '=': 
      var matched = value.match(/^in\s*\((.*)\)/);;
      if (matched && matched.length === 2) { // in operator
        var inFields = matched[1].split(',');
        var inValues = [];
        _.each(inFields, function(v) {
          // remove all ' and  trim it
          inValues.push(v.replace(/'/g, '').trim());
        });
        filters.where[field] = inValues;
      } else {
        filters.where[field] = value.replace(/'/g, '');  // = operator
      }
      break;
    case '<':    // < operator
      var intValue = Number(value);
      if (!_.isNumber(intValue) || _.isNaN(intValue)) {
        routeHelper.addValidationError(req, value + ' is not a valid number');
        return;
      }
      filters.where[field] = {lt: intValue};
      break;
    case '>':    // > operator
      var intValue = Number(value);
      if (!_.isNumber(intValue) || _.isNaN(intValue)) {
        routeHelper.addValidationError(req, value + ' is not a valid number');
        return;
      }
      filters.where[field] = {gt: intValue};
      break;
  }
}

/**
 * Parse limit and offset parameters.
 * @param req the request
 * @param filters the filters used in the query
 * @param key the parameter key
 * @param value the limit or offset parameter value
 */
exports.parseLimitOffset = function(req, filters, key, value) {
  if (!value) {
    routeHelper.addValidationError(req, 'Value of ' + key + ' parameter is empty');
    return;
  }
  if (value && value instanceof Array) {
    routeHelper.addValidationError(req, 'Multiple '+ key +' parameters are provided, only one ' + key + ' is supported');
    return;
  }
  var intValue = Number(value);
  // Number is validated by Swagger, but NaN values still arrive here.
  // If value has non-digit at the end, the value becomes NaN, for example '123Abc' becomes NaN.
  if (_.isNaN(intValue)) {
    routeHelper.addValidationError(req, value + ' is not a valid number');
    return;
  }
  filters[key] = intValue;
}

/**
 * Parse orderBy parameter.
 * @param model the model to apply the orderBy
 * @param req the request
 * @param filters the filters used in the query
 * @param orderParam the orderBy parameter value
 */
exports.parseOrderBy = function(model, req, filters, orderParam) {
  if (!orderParam) {
    routeHelper.addValidationError(req, 'Value of orderBy parameter is empty');
    return;
  }
  if (orderParam instanceof Array) {
    routeHelper.addValidationError(req, 'Multiple orderBy parameters are provided, only one orderBy is supported');
    return;
  }
  var orderParts = orderParam.split(/\s+/);
  if (_.keys(model.rawAttributes).indexOf(orderParts[0]) === -1) {
    routeHelper.addValidationError(req, orderParts[0] + ' is not a valid field in the ' + model.name);
    return;
  }
  var orderFilter = '"'+orderParts[0]+'"';
  if (orderParts.length === 3) {
    routeHelper.addValidationError(req, 'Invalid orderBy parameter: ' + orderParam);
    return;
  }
  // only asc or desc is supported
  if (orderParts[1]) {
    if (orderParts[1].toLowerCase() !== 'desc' && orderParts[1].toLowerCase() !== 'asc') {
      routeHelper.addValidationError(req, orderParts[1] + ' is not supported in orderBy parameter');
      return;
    }
    orderFilter += ' ' + orderParts[1];
  }
  // validate [nulls {first|last}]
  if (orderParts.length === 4) {
    if (orderParts[2].toLowerCase() !== 'nulls') {
      routeHelper.addValidationError(req, orderParts[2] + ' is not supported in orderBy parameter');
      return;
    }
    if (orderParts[3].toLowerCase() !== 'first' && orderParts[3].toLowerCase() !== 'last') {
      routeHelper.addValidationError(req, orderParts[3] + ' is not supported in orderBy parameter');
      return;
    }
    orderFilter += ' ' + orderParts[2] + ' ' + orderParts[3];
  }
  // orderBy is valid!
  filters.order = orderFilter;
}

/**
 * Parse filter parameter.
 * @param model the model to apply the filter
 * @param req the request
 * @param filters the filters used in the query
 * @param filterParam the filter parameter value
 */
exports.parseFilter = function(model, req, filters, filterParam) {
  if (!filterParam) {
    routeHelper.addValidationError(req, 'Value of filter parameter is empty');
    return;
  }
  if (filterParam instanceof Array) {
    routeHelper.addValidationError(req, 'Multiple filters parameters are provided, only one filter is supported');
    return;
  }
  if (filterParam) {
    // split filter into each field[=<>]value pair
    var filterValues = filterParam.split('&');
    _.each(filterValues, function(filter) {
      var matched = filter.match(/\w+([=<>])[\w\(\,)\']+/);
      // the matched has the matched values in array
      if (matched && matched.length === 2) {
        var operator = matched[1];
        var fieldValue = filter.split(/[=<>]/);
        var field = fieldValue[0].trim();
        var value = fieldValue[1].trim();
        if (value) {
          value = value.trim();
          // verify that field is a valid field
          if (_.keys(model.rawAttributes).indexOf(field) > -1) {
            _setFilter(req, filters, operator, field, value);
          } else {
            routeHelper.addValidationError(req, field + ' is not a valid field in the ' + model.name);
          }
        }
      } else {
        routeHelper.addValidationError(req, filter + ' is not a valid filter');
      }
    });
  } else {
    routeHelper.addValidationError(req, 'Filter is empty');
  }
}

