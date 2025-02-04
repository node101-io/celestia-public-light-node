import mongoose from 'mongoose';
import validator from 'validator';
import { v4 as createUuid } from 'uuid';

const ApiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  team_name: {
    type: String,
    required: true,
    unique: true
  }
});

ApiKeySchema.statics.createApiKey = function (data, callback) {
  if (!data || typeof data !== 'object')
    return callback('bad_request');

  if (!data.team_name || !validator.isAlphanumeric(data.team_name.toString()))
    return callback('bad_request');

  const api_key = createUuid();

  ApiKey.create({
    key: api_key,
    team_name: data.team_name.toString()
  })
    .then(apiKey => callback(null, apiKey))
    .catch(err => {
      console.error(err);
      return callback('database_error');
    });
};

ApiKeySchema.statics.findApiKeyById = function (id, callback) {
  if (!id || !validator.isMongoId(id.toString()))
    return callback('bad_request');

  ApiKey.findById(mongoose.Types.ObjectId(id.toString()))
    .then(apiKey => {
      if (!apiKey)
        return callback('document_not_found');

      return callback(null, apiKey);
    })
    .catch(err => {
      console.error(err);
      return callback('database_error')
    });
};

ApiKeySchema.statics.findApiKeysByFilters = function (data, callback) {
  if (!data || typeof data !== 'object')
    return callback('bad_request');

  const filter = {};

  if (data.key)
    filter.key = data.key.toString();

  ApiKey.findOne(filter)
    .then(apiKey => {
      if (!apiKey)
        return callback('document_not_found');

      return callback(null, apiKey);
    })
    .catch(err => {
      console.error(err);
      return callback('database_error')
    });
};

ApiKeySchema.statics.findApiKeyByIdAndDelete = function (id, callback) {
  ApiKey.findByIdAndDelete(mongoose.Types.ObjectId(id.toString()))
    .then(apiKey => {
      if (!apiKey)
        return callback('document_not_found');

      return callback(null, apiKey);
    })
    .catch(err => {
      console.error(err);
      return callback('database_error')
    });
};

export const ApiKey = mongoose.model('ApiKey', ApiKeySchema);
