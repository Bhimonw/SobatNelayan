'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Livelocation extends Model {
        static associate(models) {
            // define association here
        }
    }
    Livelocation.init({
        alatId: DataTypes.STRING,
        latitude: DataTypes.FLOAT,
        longitude: DataTypes.FLOAT,
        status: DataTypes.STRING,
        timestamp: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'Livelocation',
    });
    return Livelocation;
};
