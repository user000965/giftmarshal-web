// Predeploy guard for firebase.emulators.json.
//
// That config exists for the emulators: it carries this repo's copy of the security rules
// and the core-port triggers, both of which mirror the Gift Marshal production backend.
// Production runs its own rules and triggers (same names), deployed from the production
// backend repo. Deploying these over them would replace live rules and triggers, so any
// deploy that uses this config is refused, whatever the project.
//
// Deploy the web codebase with the default config instead:
//   firebase deploy --project prod --only functions:web
const project = process.env.GCLOUD_PROJECT ?? 'an unknown project';
console.error(
  `Refusing to deploy rules or core-port to ${project}: firebase.emulators.json is for the emulators only.\n` +
    'Use the default firebase.json (functions:web only).',
);
process.exit(1);
