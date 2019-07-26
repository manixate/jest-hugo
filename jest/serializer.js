const beautify = require('js-beautify').html;

module.exports = {
  print(val) {
    return beautify(val.input, { wrap_attributes: 'force', indent_size: 2 });
  },

  test(val) {
    return val.custom === 'beautify';
  },
}