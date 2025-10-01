const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.js');

const EmailBlast = sequelize.define('EmailBlast', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  eventId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    references: {
      model: 'Event',
      key: 'id',
    },
  },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'failed'),
    defaultValue: 'draft',
  },
  recipientCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'email_blasts',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = EmailBlast;
