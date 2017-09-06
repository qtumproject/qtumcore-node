'use strict';

var should = require('chai').should();

describe('Index Exports', function() {
  it('will export qtumcore-lib', function() {
    var bitcore = require('../');
    should.exist(bitcore.lib);
    should.exist(bitcore.lib.Transaction);
    should.exist(bitcore.lib.Block);
  });
});
