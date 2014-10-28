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
    createdBy: DataTypes.STRING(128),
    updatedBy: DataTypes.STRING(128)
  }, {
    tableName: 'discussions',
    associate: function(models) {
      Discussion.hasMany(models.Message, {as: 'Message', foreignKey: 'discussionId', through: null});
    },
    classMethods: {
      findChildren: function(Model, value, callback){
        Model.findAll({where: {discussionId: value}}).success(function(children){
          callback(null, children);
        }).error(function(err){
          callback(err);
        });
      }
    }
  });

  return Discussion;

};
