import { promises as fs } from 'fs';
import { homedir } from 'os';

import axios from 'axios';

import { fetchServerlessDomains, getFetchedVars } from '../../../scripts/common/fetch-cli.mjs';

if (!process.argv[2]) {
  throw new Error('Please provide an output path');
}

let apiKey = process.env.TWILIO_API_KEY;
let apiSecret = process.env.TWILIO_API_SECRET;
if (!apiKey || !apiSecret) {
  // Fall back to Twilio CLI profile if present
  try {
    const profileConfig = JSON.parse(await fs.readFile(`${homedir}/.twilio-cli/config.json`, 'utf8'));
    if (profileConfig.activeProject && profileConfig.profiles) {
      const profile = profileConfig.profiles[profileConfig.activeProject];

      if (profile) {
        apiKey = profile.apiKey;
        apiSecret = profile.apiSecret;
      }
    }
  } catch (error) {
    console.log(error);
  }

  if (!apiKey || !apiSecret) {
    throw new Error('Please set the TWILIO_API_KEY and TWILIO_API_SECRET environment variables');
  }
}

let domain = '';
const outputPath = process.argv[2];

if (!domain) {
  // Fall back to fetching domain via API
  fetchServerlessDomains();
  const results = getFetchedVars();
  if (results?.SCHEDULE_MANAGER_DOMAIN) {
    domain = results.SCHEDULE_MANAGER_DOMAIN;
  }
}

console.log('Fetching latest deployed config...');

if (domain) {
  axios
    .get(`https://${domain}/admin/fetch-config?apiKey=${apiKey}&apiSecret=${apiSecret}`)
    .then(async (response) => {
      await fs.writeFile(outputPath, JSON.stringify(response.data, null, 2), 'utf8');
      console.log(`Saved latest deployed config to ${outputPath}`);
    })
    .catch((error) => {
      if (error?.response?.status === 404) {
        // A 404 indicates this serverless domain exists, but is an older version without the fetch-config function
        // Continue, otherwise we will never deploy the updated service!
        console.log(
          'Unable to fetch data, as the service exists but the fetch-config function is not present. Ensure your local config is up-to-date before deploying.',
        );
      } else {
        console.log('Unable to fetch data', error);
        throw new Error(`Received an error when attempting to fetch the latest config`);
      }
    });
} else {
  console.log('Existing serverless domain not found; assuming new deployment');
}
