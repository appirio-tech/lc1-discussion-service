'use strict';


/**
* Defining Discussion model
*/
module.exports = function(sequelize, DataTypes) {

  var Discussion = sequelize.define('Discussion', {
    id: {
      type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true,
      // bigserial(8bytes) is read as string in sequelize, need to convert to integer
      get: function() {
        return parseInt(this.getDataValue('id'));
      }
    },

    remoteObjectKey: {type: DataTypes.STRING, allowNull: false},
    remoteObjectId: {
      type: DataTypes.BIGINT, allowNull: false,
      // bigint(8bytes) is read as string in sequelize, need to convert to integer
      get: function() {
        return parseInt(this.getDataValue('remoteObjectId'));
      }
    },
    createdBy: {
      type: DataTypes.BIGINT,
      get: function() {
        return parseInt(this.getDataValue('createdBy'));
      }
    },
    updatedBy: {
      type: DataTypes.BIGINT,
      get: function() {
        return parseInt(this.getDataValue('updatedBy'));
      }
    },
  }, {
    tableName: 'discussions',
    associate : function(models) {
      Discussion.hasMany(models.Message);
    }
  });

  return Discussion;

};
