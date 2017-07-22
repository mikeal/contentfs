const inmem = require('lucass/inmemory')
const test = require('tap').test
const lib = require('./lib')
const contentfs = require('../')

lib.forEach(fn => {
  fn('inmemory', inmem, inmem)
})
