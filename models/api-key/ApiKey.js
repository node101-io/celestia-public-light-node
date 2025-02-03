import mongoose from 'mongoose';
import validator from 'validator';

const DUPLICATED_UNIQUE_FIELD_ERROR_CODE = 11000;
const MAX_DATABASE_TEXT_FIELD_LENGTH = 1e4;

const Schema = mongoose.Schema;

const ApiKeySchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
});

ApiKeySchema.statics.createApiKey = function (data, callback) {
  const ApiKey = this;

  if (!data || typeof data !== 'object')
    return callback('bad_request');

  if (!data.key || typeof data.key !== 'string' || !data.key.trim().length || data.key.trim().length > MAX_DATABASE_TEXT_FIELD_LENGTH)
    return callback('bad_request');

  const newApiKey = new ApiKey({ key: data.key.trim() });

  newApiKey.save((err, apiKey) => {
    if (err && err.code === DUPLICATED_UNIQUE_FIELD_ERROR_CODE)
      return callback('duplicated_unique_field');

    if (err)
      return callback('database_error');

    return callback(null, apiKey._id.toString());
  });
};

ApiKeySchema.statics.findApiKeyById = function (id, callback) {
  const ApiKey = this;

  if (!id || !validator.isMongoId(id.toString()))
    return callback('bad_request');

  ApiKey.findById(mongoose.Types.ObjectId(id.toString()), (err, apiKey) => {
    if (err)
      return callback('database_error');

    if (!apiKey)
      return callback('document_not_found');

    return callback(null, apiKey);
  });
};

ApiKeySchema.statics.findApiKeyByIdAndDelete = function (id, callback) {
  const ApiKey = this;

  ApiKey.findApiKeyById(id, (err, apiKey) => {
    if (err)
      return callback(err);

    if (apiKey.is_deleted)
      return callback(null);

    ApiKey.findByIdAndUpdate(apiKey._id, { $set: {
      is_deleted: true
    }}, (err) => {
      if (err)
        return callback('database_error');

      return callback(null);
    });
  });
};

export default mongoose.model('ApiKey', ApiKeySchema);
