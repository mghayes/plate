var escape_html = require('./escape')
  , safe = require('./safe')

module.exports = function(input) {
  return safe(escape_html(input).replace(/\n/g, '<br />'))
}
