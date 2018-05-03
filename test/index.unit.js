'use strict';

var should = require('chai').should();

describe('Index Exports', function() {
  it('will export qtumcore-lib', function() {
    var qtumcore = require('../');
    should.exist(qtumcore.lib);
    should.exist(qtumcore.lib.Transaction);
    should.exist(qtumcore.lib.Block);
  });
});
