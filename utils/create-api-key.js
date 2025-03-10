import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { ApiKey } from '../models/api-key/ApiKey.js';

dotenv.config('../.env');

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celestia');

if (!process.argv[2]) {
  console.error('Provide a team name');
  process.exit(1);
};

ApiKey.createApiKey({
  team_name: process.argv[2]
}, (err, apiKey) => {
  if (err) {
    console.error(err);
    process.exit(1);
  };

  console.log('TEAM:    ', apiKey.team_name);
  console.log('API KEY: ', apiKey.key);
  process.exit(0);
});
