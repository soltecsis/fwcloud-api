const fs = require('node:fs');

// Only aggregate statistics are needed for the GitHub summary.
module.exports = class StatsReporter {
  constructor(runner) {
    runner.once('end', () => {
      fs.mkdirSync('reports/tests', { recursive: true });
      fs.writeFileSync('reports/tests/results.json', `${JSON.stringify({ stats: runner.stats }, null, 2)}\n`);
    });
  }
};
