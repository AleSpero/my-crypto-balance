'use strict';


process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const https = require('https');

// a. the action name from the make_name Dialogflow intent
const WELCOME_ACTION = 'input.welcome';
const USERNAME_ACTION = 'ask_username'
// b. the parameters that are parsed from the make_name intent 
const USERNAME = 'username';
const NUMBER_ARGUMENT = 'number';

exports.cointrackingBalance = functions.https.onRequest((request, response) => {
  const app = new App({request, response});
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

// c. The function that generates the silly name
  function welcomeIntent (app) {
    
    //Check se username già presente in memoria
    if(false){
      //TODO
    }
    else{
      app.ask('It seems you have not yet set the' + 
        ' username for your portfolio. What is your username on Cointracking?',
        ['Tell me your username.', 'What is your alias on Cointracking?', 'We can stop here. See you soon.']);
    }
  }

  function checkUser(app){

    let username = app.getArgument(USERNAME);
    checkBalance(app,username);

  }

  function checkBalance(app, username){

    https.get('https://cointracking.info/portfolio/'+ username, (resp) => {
  
  let data = '';

  // A chunk of data has been recieved.
  resp.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received. Print out the result.
  resp.on('end', () => {
    app.tell("Success!");
    console.log(JSON.parse(data).explanation);
  });

}).on("error", (err) => {
  console.log("Error: " + err.message);
  app.tell("I can't seem to find a portfolio with that username.")
});

  }
  // d. build an action map, which maps intent names to functions
  let actionMap = new Map();
  actionMap.set(WELCOME_ACTION, welcomeIntent);
  actionMap.set(USERNAME_ACTION, checkUser)

app.handleRequest(actionMap);
});
