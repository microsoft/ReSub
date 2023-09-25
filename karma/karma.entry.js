require('./enzyme.config');

// Force development:true for unit tests
var opts = require('../src/Options.ts');
opts.default.development = true;

const context = require
    .context('../test/', true, /\.spec\.tsx?$/);

context
    .keys()
    .forEach(context);
