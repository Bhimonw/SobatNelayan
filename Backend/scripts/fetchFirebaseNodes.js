const firebaseService = require('../services/firebaseService');

(async function main() {
  try {
    const path = process.argv[2] || '/';
    console.log(`Reading Firebase nodes from path: ${path}`);
    const nodes = await firebaseService.getAllLocations(path);
    console.log('Result:');
    console.log(JSON.stringify(nodes, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error fetching Firebase nodes:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
