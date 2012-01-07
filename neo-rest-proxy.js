var http = require('http')
var http = require('http')
var express = require('express')
var proxy = require('request')
var sys = require('sys')

var app = express.createServer()
app.use(express.bodyParser())

const neo = {
    url: 'http://localhost:7474'
}
const PREAMBLE = "data:application/json;charset=UTF-8;base64,"

function decodeValue(property) {
    if (typeof(property) === "string" && property.indexOf(PREAMBLE) === 0) {
        property = new Buffer(property.substring(PREAMBLE.length), 'base64').toString('utf8')
        property = JSON.parse(property)
    }
    return property
}

function encodeValue(value) {
    return PREAMBLE + new Buffer(JSON.stringify(value)).toString('base64')
}

function forward(request, response) {
    var proxy = http.createClient(7474, "localhost")
    var url = request.url
    var proxyRequest = proxy.request(request.method, url, request.headers)

    proxyRequest.addListener('response', function (proxy_response) {
        proxy_response.addListener('data', function(chunk) {
            response.write(chunk, 'binary')
        })
        proxy_response.addListener('end', function() {
            response.end()
        })
        response.writeHead(proxy_response.statusCode, proxy_response.headers)
    })

    request.addListener('data', function(chunk) {
        proxyRequest.write(chunk, 'binary')
    })

    request.addListener('end', function() {
        proxyRequest.end()
    })
}

function isObject(value) {
    return (typeof(value) === "object" && Object.prototype.toString.apply(value) !== '[object Array]')
}

/** POST /node - Create Node or Relationship */
app.post(/^\/db\/([^/]+)\/(node|relationship)/, function(req, resp) {
    var object = req.body
    for (prop in object) {
        if (isObject(object[prop])) {
            object[prop] = encodeValue(object[prop])
        }
    }

    proxy.post({
        uri: neo.url + req.url,
        json: req.body
    }, function (error, response, body) {
        if (!error && response.statusCode == 201) {
            for (prop in body.data) {
                body.data[prop] = decodeValue(body.data[prop])
            }
            resp.json(body, 201)
        } else {
            resp.send(response.statusCode)
        }
    })
})

/** GET /node/:id - Get Node or Relationship */
app.get(/^\/db\/([^/]+)\/(node|relationship)/, function(req, resp) {
    proxy.get(neo.url + req.url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var node = JSON.parse(body)
            for (property in node.data) {
                node.data[property] = decodeValue(node.data[property])
            }
            resp.send(node, 200)
        } else {
            resp.send(response.statusCode)
        }
    })
})

/** GET /node/:id/properties - Get Node or Relationship Properties */
app.get(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties$/, function(req, resp) {
    proxy.get(neo.url + req.url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var properties = JSON.parse(body)
            for (key in properties) {
                properties[key] = decodeValue(properties[key])
            }
            resp.json(properties, 200)
        } else {
            resp.send(response.statusCode)
        }
    })
})

/** PUT /node/:id/properties - Update Node or Relationship Properties */
app.put(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties$/, function(req, resp) {
    var properties = req.body
    for (key in properties) {
        if (isObject(properties[key])) {
            properties[key] = encodeValue(properties[key])
        }
    }

    proxy.put({
        uri: neo.url + req.url,
        json: properties
    }, function (error, response, body) {
        resp.send(response.statusCode)
    })
})

/** GET /node/:id/property/:prop - Get Node or Relationship Property */
app.get(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties\/([^/]+)$/, function(req, resp) {
    proxy.get(neo.url + req.url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var property = JSON.parse(body)
            property = decodeValue(property)
            resp.json(property, 200)
        } else {
            resp.send(response.statusCode)
        }
    })
})

/** PUT /node/:id/property/:prop - Update Node or Relationship Property */
app.put(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties\/([^/]+)$/, function(req, resp) {
    var value = req.body
    if (isObject(value)) {
        value = encodeValue(value)
    }

    proxy.put({
        uri: neo.url + req.url,
        json: value
    }, function (error, response, body) {
        resp.send(response.statusCode)
    })
})

// Remaining calls, pass-through
app.get(/.*/, function(request, response) {
    forward(request, response)
})
app.put(/.*/, function(request, response) {
    forward(request, response)
})
app.post(/.*/, function(request, response) {
    forward(request, response)
})
app.delete(/.*/, function(request, response) {
    forward(request, response)
})

app.listen(4747)