'use strict';


process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const https = require('https');
const admin = require("firebase-admin");
const cheerio = require('cheerio');


// a. the action name from the make_name Dialogflow intent
const WELCOME_ACTION = 'input.welcome';
const USERNAME_ACTION = 'ask_username'
// b. the parameters that are parsed from the make_name intent 
const USERNAME = 'username';
const NUMBER_ARGUMENT = 'number';
const COIN_BALANCE = 0;


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
    const $ = cheerio.load(data);

    //Prendo dati
    var resultBalance = $('span.utitel_gross').first().text();
    var resultBalanceBTC = $('span.utitel_gross_grau').first().text();
    var resultTrend = $("span[title='24h trend']").first().text();

    //resultTrend è null, come mai?

    var trendWord = resultTrend.charAt(0) == '+' ? "an increase" : "a decrease";

    if(resultBalance.length > 0){

           app.ask(app.buildRichResponse()
    // Create a basic card and add it to the rich response
    .addSimpleResponse("Hello, "+username+"!")

    .addSimpleResponse( "Your balance is "+resultBalance+".\n"+
      "There has been "+trendWord+" of "+resultTrend.substr(1,4)+" percent!")

    .addBasicCard(app.buildBasicCard('42 is an even composite number. It' +
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
        'Another suggestion chip here'])
  );
    //Fai list con varie monete anzichè basic card??
           //Prendi i dati delle monete in percentuale e crea pie chart + altre cose da fare brain storming


    }
    else{
      app.tell("There was an error while retrieving your balance. Please try later.")
    }

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
