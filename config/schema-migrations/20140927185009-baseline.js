var dbm = require('db-migrate');
var async = require('async');
var type = dbm.dataType;

exports.up = function (db, callback) {
  async.series([
    // create discussions table
    db.runSql.bind(db,
       'CREATE TABLE discussions ( ' +
           'id bigserial NOT NULL, ' +
           '"remoteObjectKey" character varying(255) NOT NULL, ' +
           '"remoteObjectId" bigint NOT NULL, ' +
           '"createdBy" bigint, ' +
           '"updatedBy" bigint, ' +
           '"createdAt" timestamp with time zone NOT NULL, ' +
           '"updatedAt" timestamp with time zone NOT NULL ' +
       ');'),
    db.runSql.bind(db, 'ALTER TABLE ONLY discussions ADD CONSTRAINT discussions_pkey PRIMARY KEY (id);'),

    // create messages table
    db.runSql.bind(db,
       'CREATE TABLE messages ( ' +
           'id bigserial NOT NULL, ' +
           'content text NOT NULL, ' +
           '"parentMessageId" bigint, ' +
           '"discussionId" bigint NOT NULL, ' +
           '"createdBy" bigint, ' +
           '"updatedBy" bigint, ' +
           '"createdAt" timestamp with time zone NOT NULL, ' +
           '"updatedAt" timestamp with time zone NOT NULL, ' +
           '"authorId" bigint ' +
       ');'),
    db.runSql.bind(db, 'ALTER TABLE ONLY messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);')
  ], callback);
};

exports.down = function (db, callback) {
  async.series([
    db.dropTable.bind(db, 'messages'),
    db.dropTable.bind(db, 'discussions')
  ], callback);
};
