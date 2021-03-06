module.exports = Parser

var NodeList = require('./node_list')

var FilterChain = require('./filter_chain')
  , FilterLookup = require('./filter_lookup')
  , FilterApplication = require('./filter_application')

function Parser(tokens, tags, filters, plugins) {
  this.tokens = tokens
  this.tags = tags
  this.filters = filters
  this.plugins = plugins

  // for use with extends / block tags
  this.loadedBlocks = []
}

var cons = Parser
  , proto = cons.prototype

proto.cache = {}

proto.parse = function(until) {
  var output = []
    , token = null
    , node

  while(this.tokens.length > 0) {
    token = this.tokens.shift()

    if(until && token.is(until)) {
      this.tokens.unshift(token)
      break
    } else if(node = token.node(this)) {
      output.push(node)
    }
  }

  return new NodeList(output)
}

proto.compileNumber = function(content, idx, output) {
  var c
    , decimal = content.charAt(idx) === '.'
    , bits = decimal ? ['0.'] : []

  do {
    c = content.charAt(idx)
    if(c === '.') {
      if(decimal)
        break
      decimal = true
      bits.push('.')
    } else if(/\d/.test(c)) {
      bits.push(c)
    }
  } while(++idx < content.length)

  output.push((decimal ? parseFloat : parseInt)(bits.join(''), 10))

  return idx
}

proto.compileString = function(content, idx, output) {
  var type = content.charAt(idx)
    , escaped = false
    , bits = []
    , c

  ++idx

  do {
    c = content.charAt(idx)

    if(escaped) {
      if(!/['"\\]/.test(c))
        bits.push('\\')

      bits.push(c)
      escaped = false
    } else {
      if(c === '\\') {
        escaped = true
      } else if(c === type) {
        break
      } else {
        bits.push(c)
      }
    }

  } while(++idx < content.length)

  output.push(bits.join(''))

  return idx
}

proto.compileName = function(content, idx, output) {
  var out = []
    , c

  do {
    c = content.charAt(idx)
    if(/[^\w\d\_]/.test(c))
      break

    out.push(c)
  } while(++idx < content.length)

  output.push(out.join(''))

  return idx
}

proto.compileFilter = function(content, idx, output) {
  var filterName
    , oldLen
    , bits

  ++idx

  idx = this.compileName(content, idx, output)
  filterName = output.pop()

  if(content.charAt(idx) !== ':') {
    output.push(new FilterApplication(filterName, []))
    return idx - 1
  }

  ++idx

  oldLen = output.length
  idx = this.compileFull(content, idx, output, true)
  bits = output.splice(oldLen, output.length - oldLen)

  output.push(new FilterApplication(filterName, bits))

  return idx
}

proto.compileLookup = function(content, idx, output) {
  var bits = []

  do {
    idx = this.compileName(content, idx, output)
    bits.push(output.pop())

    if(content.charAt(idx) !== '.')
      break

  } while(++idx < content.length)

  output.push(new FilterLookup(bits))

  return idx - 1
}

proto.compileFull = function(content, idx, output, omitPipe) {
  var c
  output = output || [] 
  idx = idx || 0

  // something|filtername[:arg, arg]
  // "quotes"
  // 1
  // 1.2
  // true | false

  // swallow leading whitespace.
  while(/\s/.test(content.charAt(idx)))
    ++idx

  do {
    c = content.charAt(idx)

    if(/[,\s]/.test(c))
      break

    if(omitPipe && c === '|') {
      --idx
      break
    }

    switch(true) {
      case /[\d\.]/.test(c):
        idx = this.compileNumber(content, idx, output)
        break
      case /['"]/.test(c):
        idx = this.compileString(content, idx, output)
        break
      case c === '|':
        idx = this.compileFilter(content, idx, output)
        break
      default:
        idx = this.compileLookup(content, idx, output)
        break
    }
  } while(++idx < content.length)

  return idx
}

proto.compile = function(content) {
  var output = []

  if(this.cache[content])
    return this.cache[content]

  this.compileFull(content, 0, output)

  output = this.cache[content] = new FilterChain(output, this)
  output.attach(this)

  return output
}
