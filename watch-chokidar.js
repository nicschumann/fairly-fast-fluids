const chokidar  = require('chokidar');
const esbuild   = require('esbuild');

// refactoring watch process into esbuild entirely to avoid
// the extra chokidar dependency.


const buildjs = async path => {
  console.log('changed', path);
  let s = Date.now();
  esbuild.build({
    entryPoints: ['src/main.js'],
    bundle: true,

    minify: false,
    sourcemap: true,

    // Load shaders as text for WebGL.
    loader: {'.vs': 'text', '.fs': 'text'},

    platform: 'node',
    target: ['node10.4'],
    outfile: 'dst/bundle.js'

  })
  .then(() => {
    let e = Date.now();
    console.log(`No Errors. Build completed (${(e - s) / 1000}s).\n`);
  })
  .catch(() => {
    let e = Date.now();
    console.log(`Errors. Build failed (${(e - s) / 1000}s).\n`);
  });
};


const jswatcher = chokidar.watch('src/**/*.*', {
  ignored: "src/**/bundle*",
  persistent: true
});


jswatcher
  .on('ready', async () => {
    buildjs('all');

    jswatcher
      .on('add', buildjs)
      .on('change', buildjs);
  });
