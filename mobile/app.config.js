const { execSync } = require('child_process');
const base = require('./app.json').expo;

function detectAppleTeamId() {
  const fromEnv = process.env.APPLE_TEAM_ID?.trim();
  if (fromEnv) return fromEnv;

  try {
    const subject = execSync(
      'security find-certificate -a -c "Apple Development" -p 2>/dev/null | openssl x509 -noout -subject 2>/dev/null',
      { encoding: 'utf8' },
    );
    const match = subject.match(/OU=([A-Z0-9]{10})/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

const appleTeamId = detectAppleTeamId();

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...base,
    ios: {
      ...base.ios,
      ...(appleTeamId ? { appleTeamId } : {}),
    },
  },
};
