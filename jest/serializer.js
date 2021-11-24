const beautify = require("js-beautify").html

module.exports = {
  print(val, serialize, indent) {
    if (val.custom == "beautify") {
      return beautify(val.input, { wrap_attributes: "force", indent_size: 2 })
    } else {
      return serialize(val.input)
    }
  },

  test(val) {
    return !!val.custom
  }
}
