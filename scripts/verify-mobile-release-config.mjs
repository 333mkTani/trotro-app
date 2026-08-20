#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apps = [
  { name: 'passenger', dir: 'rork-trotro-ride-clone-main/expo', scheme: 'trotro-passenger', packageName: 'app.rork.xhzxzlgi78rh6x1hlotnk' },
  { name: 'driver', dir: 'rork-trotro-driver-app-main/expo', scheme: 'trotro-driver', packageName: 'app.rork.ail0erz48fpe3wt4vgrgo' },
];
const failures = [];
const check = (condition, message) => {
  if (condition) console.log(`PASS ${message}`);
  else { console.error(`FAIL ${message}`); failures.push(message); }
};

for (const app of apps) {
  const dir = path.join(root, app.dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8')).expo;
  const eas = JSON.parse(fs.readFileSync(path.join(dir, 'eas.json'), 'utf8'));
  check(manifest.scheme === app.scheme, `${app.name}: unique deep-link scheme`);
  check(manifest.android?.package === app.packageName, `${app.name}: Android package identifier`);
  check(manifest.ios?.bundleIdentifier === app.packageName, `${app.name}: iOS bundle identifier`);
  check(eas.build?.development?.env?.EXPO_PUBLIC_API_ENV === 'development', `${app.name}: development API profile`);
  check(eas.build?.preview?.env?.EXPO_PUBLIC_API_ENV === 'staging', `${app.name}: staging API profile`);
  check(eas.build?.production?.env?.EXPO_PUBLIC_API_ENV === 'production', `${app.name}: production API profile`);
  for (const asset of ['assets/images/icon.png', 'assets/images/adaptive-icon.png', 'assets/images/splash-icon.png', 'google-services.json', 'GoogleService-Info.plist']) {
    check(fs.existsSync(path.join(dir, asset)), `${app.name}: ${asset} present`);
  }
  check(Array.isArray(manifest.plugins) && manifest.plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-notifications'), `${app.name}: notifications plugin`);
  check(Array.isArray(manifest.plugins) && manifest.plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-location'), `${app.name}: location plugin`);
}

if (failures.length) {
  console.error(`\n${failures.length} release prerequisite(s) need operator action.`);
  process.exitCode = 1;
} else {
  console.log('\nAll mobile release prerequisites are present.');
}
