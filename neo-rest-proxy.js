var argv = require('optimist').argv
var http = require('http')
var express = require('express')
var proxy = require('request')
var sys = require('sys')

var app = express.createServer()
app.use(express.bodyParser())


const PREAMBLE = "data:application/json;charset=UTF-8;base64,"

var neo = {
    url: 'http://localhost:7474'
}
if (argv.h) neo.url = argv.h

var port = 4747
if (argv.p) port = parseInt(argv.p)


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

/**
 * POST /node
 *      Create Node */
app.post(/^\/db\/([^/]+)\/node$/, function(req, resp) {
    console.log(" -> " + req.url)
    var object = req.body
    for (prop in object) {
        if (isObject(object[prop])) {
            object[prop] = encodeValue(object[prop])
        }
    }

    proxy.post({
        uri: neo.url + req.url,
        json: req.body,
        headers: req.headers
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

/**
 * GET /node/:id
 * GET /relationship/:id
 *      Get Node or Relationship */
app.get(/^\/db\/([^/]+)\/(node|relationship)$/, function(req, resp) {
    console.log("/^\/db\/([^/]+)\/(node|relationship)/ -> " + req.url)
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

/**
 * GET /node/:id/properties
 * GET /relationship/:id/properties
 *      Get Node or Relationship Properties */
app.get(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties$/, function(req, resp) {
    console.log("/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties$/ -> " + req.url)
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

/**
 * PUT /node/:id/properties
 * PUT /relationship/:id/properties
 *      Update Node or Relationship Properties */
app.put(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties$/, function(req, resp) {
    console.log("/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties$/ -> " + req.url)
    var properties = req.body
    for (key in properties) {
        if (isObject(properties[key])) {
            properties[key] = encodeValue(properties[key])
        }
    }

    proxy.put({
        uri: neo.url + req.url,
        json: properties,
        headers: req.headers
    }, function (error, response, body) {
        resp.send(response.statusCode)
    })
})

/**
 * GET /node/:id/properties/:prop
 * GET /relationship/:id/properties/:prop
 *      Get Node or Relationship Property */
app.get(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties\/([^/]+)$/, function(req, resp) {
    console.log("/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties\/([^/]+)$ -> " + req.url)
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

/**
 * PUT /node/:id/properties/:prop
 * PUT /relationship/:id/properties/:prop
 *      Update Node or Relationship Property */
app.put(/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties\/([^/]+)$/, function(req, resp) {
    console.log("/^\/db\/([^/]+)\/(node|relationship)\/([^/]+)\/properties\/([^/]+)$/ -> " + req.url)
    var value = req.body
    if (isObject(value)) {
        value = encodeValue(value)
    }

    proxy.put({
        uri: neo.url + req.url,
        json: value,
        headers: req.headers
    }, function (error, response, body) {
        resp.send(response.statusCode)
    })
})

/**
 * POST /node/:id/relationships
 *      Create Relationship */
app.post(/^\/db\/([^/]+)\/node\/([^/]+)\/relationships$/, function(req, resp) {
    console.log("/^\/db\/([^/]+)\/node\/([^/]+)\/relationships/ -> " + req.url)
    var object = req.body
    for (prop in object.data) {
        if (isObject(object.data[prop])) {
            object.data[prop] = encodeValue(object.data[prop])
        }
    }

    proxy.post({
        uri: neo.url + req.url,
        json: req.body,
        headers: req.headers
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

/**
 * GET /node/:id/relationships/all
 * GET /node/:id/relationships/all/:filter
 * GET /node/:id/relationships/in,
 * GET /node/:id/relationships/out
 */
app.get(/^\/db\/([^/]+)\/node\/([^/]+)\/relationships\/.+$/, function(req, resp) {
    console.log("/^\/db\/([^/]+)\/node\/([^/]+)\/relationships\/.+/ -> " + req.url)
    var object = req.body
    for (prop in object.data) {
        if (isObject(object.data[prop])) {
            object.data[prop] = encodeValue(object.data[prop])
        }
    }

    proxy.get({
        uri: neo.url + req.url,
        headers: req.headers // TODO? and for other GETs?
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            for (prop in body.data) {
                body.data[prop] = decodeValue(body.data[prop])
            }
            resp.json(body, 200)
        } else {
            resp.send(response.statusCode)
        }
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

app.listen(port)
console.log('Proxy to ' + neo.url + ' listening on port ' + port)