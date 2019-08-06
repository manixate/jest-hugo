const beautify = require('js-beautify').html;
const unescape = require('lodash.unescape');

module.exports = {
  print(val) {
    return beautify(unescape(val.input), { 
      wrap_attributes: 'force', 
      indent_size: 2, 
      unescape_strings: true 
    });
  },

  test(val) {
    return val.custom === 'beautify';
  },
}