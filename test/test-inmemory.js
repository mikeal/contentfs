const inmem = require('lucass/inmemory')
const lib = require('./lib')

lib.forEach(fn => {
  fn('inmemory', inmem, inmem)
})
