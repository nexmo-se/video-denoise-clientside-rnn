const express = require("express")
const app = express()
var bodyParser = require('body-parser')
var OpenTok = require('opentok');

var apikey="";
var secret="";
var sessionId = "1-abcdjskskksss-gh;
var opentok = OpenTok(apikey,secret)

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.static("public"))

app.get("/token", (request, response) => {
	var token = opentok.generateToken(sessionId);
        response.json({"apikey":apikey,"sessionid":sessionId,"token":token});
});

app.listen(process.env.PORT || 3000,
        () => console.log("Server is running..."));
