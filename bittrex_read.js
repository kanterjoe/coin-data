/**
 * Created by jkanter on 7/9/17.
 */
var bittrex     = require('./node_modules/node.bittrex.api/node.bittrex.api.js');
var fs          = require('fs');
var mysql       = require('mysql');
var dateFormat  = require('dateformat');

console.log("DBHost: ",process.env.DBHost);
var db = mysql.createPool({
    connectionLimit : 100,
    host: process.env.DBHost,
    user: process.env.DBUser,
    password: process.env.DBPass,
    database: process.env.DBDB
});



bittrex.options({
    'baseUrl' : 'https://bittrex.com/api/v1.1',
    'apikey' : process.env.apikeyRO,
    'apisecret' : process.env.apiSecretRO,
    'stream' : false, // will be removed from future versions
    'verbose' : true,
    'cleartext' : false
});


function getmarkethistory (market) {
    bittrex.getmarkethistory({ market : market }, function( data ) {

        data.result.forEach(function (datum ) {
           console.log(datum.Id, datum.TimeStamp, datum.Quantity, datum.Price, datum.FillType, datum.OrderType)
        });





    });


}

function getCurrencies (callback) {
    var currencies = [];
    bittrex.getcurrencies( function (data) {
        currencies = data.result.map(function (currencyJSON) {
            return currencyJSON.Currency;
        });
        if (callback) callback(currencies);
        else console.log(currencies);
    });
}

/**
 * queryPoloniex:  REST get request returning JSON object(s) of the currency's history
 * @param currencty: currency name, like BTC
 * @param callback: callback to pass the results JSON object(s) back
 */
var queryPoloniex = function(currency)
{
    var currency = currency;
    //https://poloniex.com/public?command=returnChartData&currencyPair=BTC_LTC&start=1230946260&end=9999999999&period=14400
    console.log("rest::getJSON");
    var https = require("https");
    var req = https.request({
            host: 'poloniex.com',
            port: 443,
            path: '/public?command=returnChartData&currencyPair=BTC_'+ currency +'&start=1230946260&end=9999999999&period=14400',
            method: 'GET',
            headers: {'Content-Type': 'application/json'}
        },
        function(res) {
            var output = '';
            console.log(currency + ':' + res.statusCode);
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                output += chunk;
            });

            res.on('end', function() {
                // var obj = JSON.parse(output);
                // onResult(res.statusCode, obj);

                fs.writeFile("histories/Poloniex/"+currency, output, function(err) {
                    if(err) {
                        return console.log(err);
                    }

                    console.log(currency + " was saved!");
                });

            });
        });

    req.on('error', function(err) {
        console.error(err)
    });

    req.end();
};

var saveMarketSummary = function (currency, callback) {
    //https://bittrex.com/api/v1.1/public/getmarketsummary?market=btc-ltc
    bittrex.getmarketsummary({market:"btc-"+currency}, function (data) {

        if (data.result) {
            var output = ""
            // output = '"MarketName","High","Low","Volume","Last","BaseVolume","TimeStamp","Bid","Ask","OpenBuyOrders","OpenSellOrders","PrevDay","Created","DisplayMarketName"\r\n';
            //
            // fs.writeFile("summaries/" + currency+'.csv', output, function (err) {
            //     if (err) {
            //         return console.log(err);
            //     }
            // });

            var fields = [
                "MarketName",
                "High",
                "Low",
                "Volume",
                "Last",
                "BaseVolume",
                "TimeStamp",
                "Bid",
                "Ask",
                "OpenBuyOrders",
                "OpenSellOrders",
                "PrevDay",
                "Created",
                "DisplayMarketName"],

                SQL  = "INSERT INTO marketSummaries ( " + fields.join(",") + " ) VALUES ? ",
                VALS = [[]];

            fields.forEach(function(field){
                VALS[0].push(data.result[0][field]);
            });

            VALS[0]["DisplayMarketName"] = "";

            db.getConnection(function(err, con) {
                if (err) throw err;
                con.query(SQL, [VALS], function (err, result, fields) {
                    if (err) throw err;
                    con.release()
                });
            });




            // fs.appendFile("summaries/" + currency + '.csv', output, function (err) {
            //     if (err) {
            //         return console.log(err);
            //     }
            //
            //     console.log(currency + " summary was saved!");
            // });
        }
    }

    )
};
var saveOrderBook     = function (currency, callback) {
    bittrex.getorderbook({ market : 'BTC-' + currency, depth : 50, type : 'both' }, function( data ) {
        //console.log( data );

        var bookid      = currency + dateFormat(new Date(), "yyyymmddhMM"),
            SQL         = "INSERT INTO `orderBooks` (currency, direction, Quantity, Rate, bookid) VALUES ? ",
            VALS        = [];

        data.result["buy"].forEach(function(order){
            VALS.push([currency, "buy", order["Quantity"],order["Rate"], bookid]);
        });
        data.result["sell"].forEach(function(order){
            VALS.push([currency, "sell", order["Quantity"],order["Rate"], bookid]);
        });


        db.getConnection(function(err, con) {
            if (err) throw err;
            con.query(SQL, [VALS], function (err, result, fields) {
                if (err) throw err;
                con.release()
            });
        });
    });
};
module.exports = {
    queryPoloniex: queryPoloniex,
    getmarkethistory:getmarkethistory,
    saveMarketSummary:saveMarketSummary,
    saveOrderBook:saveOrderBook,
    getAllCurrencies: getCurrencies

};
