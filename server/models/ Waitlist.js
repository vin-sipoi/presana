const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.js');

const Waitlist = sequelize.define('Waitlist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed'),
    defaultValue: 'pending',
    allowNull: false,
    field: 'status',
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'joined_at',
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'waitlist',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['email'],
      name: 'waitlist_email_unique',
    },
    {
      fields: ['status'],
      name: 'waitlist_status_index',
    },
    {
      fields: ['joined_at'],
      name: 'waitlist_joined_at_index',
    },
  ],
});

module.exports = Waitlist;
