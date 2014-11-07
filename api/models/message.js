'use strict';


/**
* Defining Message model
*/
module.exports = function(sequelize, DataTypes) {

  var Message = sequelize.define('Message', {
    id: {
      type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true,
      // bigserial(8bytes) is read as string in sequelize, need to convert to integer
      get: function() {
        return parseInt(this.getDataValue('id'));
      }
    },
    discussionId: {
      type: DataTypes.BIGINT, allowNull: false,
      // bigint(8bytes) is read as string in sequelize, need to convert to integer
      get: function() {
        return parseInt(this.getDataValue('discussionId'));
      }
    },
    content: {type: DataTypes.STRING, allowNull: false},
    parentMessageId: {
      type: DataTypes.BIGINT, 
      get: function() {
        return parseInt(this.getDataValue('parentMessageId'));
      }
    },
    createdBy: DataTypes.STRING(128),
    updatedBy: DataTypes.STRING(128)
  }, {
    tableName: 'messages',
    associate: function(models) {
      Message.belongsTo(models.Discussion);
      Message.hasMany(models.Message, {foreignKey: 'parentMessageId'});
    }
  });

  return Message;

};
