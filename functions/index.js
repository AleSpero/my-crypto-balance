'use strict';


process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const https = require('https');
const admin = require("firebase-admin");
const cheerio = require('cheerio');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;


// a. the action name from the make_name Dialogflow intent
const WELCOME_ACTION = 'input.welcome';
const USERNAME_ACTION = 'ask_username'
// b. the parameters that are parsed from the make_name intent 
const USERNAME = 'username';
const NUMBER_ARGUMENT = 'number';
const COIN_BALANCE = 0;

const ACTUAL_COIN_BALANCE = 3;

//Parameters that indicate che column index of the trend (1d,7d,30d)
const ONE_HOUR_TREND = 7;
const ONE_DAY_TREND = 8;
const SEVEN_DAYS_TREND = 9;
const ONE_MONTH_TREND = 10;

var $;


exports.cointrackingBalance = functions.https.onRequest((request, response) => {
  const app = new App({request, response});
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));
  if (!admin.apps.length) {
  admin.initializeApp(functions.config().firebase);
}
  console.log('Database intialized!');


// c. The function that generates the silly name
  function welcomeIntent (app) {

    //Inizializzo db
    var db = admin.database();
    var userId = app.getUser().userId;
    var userData;

    //Faccio query Alias Cointracking basandomi su userId
    var ref = db.ref("users");
ref.orderByChild("userId").equalTo(userId).on("child_added", function(snapshot) {
  console.log(snapshot.key);
  userData = snapshot.val();
  console.log(userData.username);
  console.log(userData.userId);
});

    //Check se username già presente in memoria
    if(userData != null){
      checkBalance(app,userData.username, true);
    }
    else{
      app.ask('It seems you have not yet set the' + 
        ' username for your portfolio. What is your username on Cointracking?',
        ['Tell me your username.', 'What is your alias on Cointracking?', 'We can stop here. See you soon.']);
    }
  }

  function calculateTrend(currentBalance, rowData ,trendType){

    //Calculates the entire portfolio trend given the table rows, current balance and thread type (1h, 1d, 7d, 30d)

    var previousBalance = 0;
    var trend;
    var coinBalance;
    var trendResult;

    for(var i = 0; i<rowData.length; i++){

      switch(trendType){
        case ONE_HOUR_TREND:
        trend = parseFloat(rowData[i].t0);
        break;

        case ONE_DAY_TREND:
        trend = parseFloat(rowData[i].t1);
        break;

        case SEVEN_DAYS_TREND:
        trend = parseFloat(rowData[i].t7);
        break;

        case ONE_MONTH_TREND:
        trend = parseFloat(rowData[i].t30);
        break;

      }

      coinBalance = parseFloat(rowData[i].f);
      previousBalance += coinBalance/100 * (100 - trend); 


    }

    console.log(previousBalance);

    trendResult = (((parseFloat(currentBalance)/previousBalance))*100) -100;

    return trendResult;

  }

  function checkUser(app){

    let username = app.getArgument(USERNAME);

    //Inizializzo db
    //admin.initializeApp(functions.config().firebase);
    var db = admin.database();
    var userId = app.getUser().userId;
    var ref = db.ref("users");



    //Inserisco record su DB

    ref.push({
      userId: userId,
      username: username
    })
    
    //Rivedi logica DB (id deve essere univoco)

    checkBalance(app,username, false);

  }

  function checkBalance(app, username, isUsernameStored){

    var options = {
      host: 'cointracking.info',
      path: '/portfolio/'+ username + '/'
    };

    var tableOptions = {
      host: 'cointracking.info',
      path: '/ajax/portfolio_current_balance.php?portfolio='+username+'&lang=en&fiat=0&zerobalance=0'
    }

    console.log("https://cointracking.info/portfolio/"+username+'/');

    https.get(options, (resp) => {
  
  let data = '';

  // A chunk of data has been recieved.
  resp.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received. Print out the result.
  resp.on('end', () => {
    console.log("Loaded successfully");

    $ = cheerio.load(data);

    //Prendo dati
    var resultBalance = $('span.utitel_gross').first().text();
    var resultBalanceBTC = $('span.utitel_gross_grau').first().text();

    //Making ajax call to get JSON containing data table
    https.get(tableOptions, (resp) => {

      let dataTable = '';

      resp.on('data', (chunk) => {
        dataTable+=chunk;
      });

      resp.on('error', (err) => {
        //Build very basic response
      });


      resp.on('end', () => {
        console.log(dataTable);

        var jsonData = JSON.parse(dataTable); //PARSE
        jsonData = jsonData.data;
        var htmlRowData;

          var rows = $('#all_currencies_info tbody tr');
    //rows.add('tr');

    console.log('rows length is '+ jsonData.length);

    var resultTrend = calculateTrend(parseFloat(resultBalance), jsonData, ONE_DAY_TREND);
    var trendWord = resultTrend > 0 ? "an increase" : "a decrease";

    if(resultBalance.length > 0){

      //Creating List
      var balanceList = app.buildList('My Portfolio');
      var coinName; // = table('span.t_coin').find('span.s grau2').first().text();
      var coinSymbol; // = table('span.t_coin').find('a').first().text;

      for (var i = 0; i < jsonData.length; i++) {

        htmlRowData = cheerio.load(jsonData[i].c);
        coinName = htmlRowData('span.s grau2').first().text();
        coinSymbol = htmlRowData('span.t_coin').find('a').first().text();


        balanceList = balanceList.addItems(app.buildOptionItem("diocaro"+i,
        ["ou"+i, "dio"+i, "dedio"+i])
      .setTitle(coinName + " - "+ coinSymbol)
          .setImage('https://cointracking.info/img/coins/' + coinSymbol.toLowerCase() + '.svg')
          );

      };

           app.askWithList(app.buildRichResponse()
    // Create a basic card and add it to the rich response
    .addSimpleResponse("Hello, "+username+"!")

    .addSimpleResponse( "Your balance is "+resultBalance+".\n"+
      "There has been "+trendWord+" of "+resultTrend+" percent!")

    //it has increased/decreased of x since yesterday?
    , balanceList

  /*  .addBasicCard(app.buildBasicCard('42 is an even composite number. It' +
      'is composed of three distinct prime numbers multiplied together. It' +
      'has a total of eight divisors. 42 is an abundant number, because the' +
      'sum of its proper divisors 54 is greater than itself. To count from' +
      '1 to 42 would take you about twenty-one…')
      .setTitle('My Balance')
      .addButton('Check my portfolio', "https://cointracking.info/portfolio/"+username+'/')
      .setImage('https://cointracking.info/assets/img/logo.png', 'Image alternate text')
      .setImageDisplay('DEFAULT')
      .addSuggestions(['What are my last trades?',
        'How my portfolio is distribuited?',
        'Another suggestion chip here'])*/

    

  );
    //Fai list con varie monete anzichè basic card??
           //Prendi i dati delle monete in percentuale e crea pie chart + altre cose da fare brain storming
    }
    else{
      app.tell("There was an error while retrieving your balance. Please try later.")
    }


      });

    });

   });

}).on("error", (err) => {
  console.log("Error: " + err.message);
//Riguarda
if(isUsernameStored){
  app.ask("I can't seem to find a portfolio with that username. Do you want to change it?",
    ['Do you want to change your username?', 'Do you want to change your username?', 'We can stop here. See you soon.']);
}
else{
  app.tell("I can't seem to find a portfolio with that username.");
}
});
  }
  // d. build an action map, which maps intent names to functions
  let actionMap = new Map();
  actionMap.set(WELCOME_ACTION, welcomeIntent);
  actionMap.set(USERNAME_ACTION, checkUser)

app.handleRequest(actionMap);
});
