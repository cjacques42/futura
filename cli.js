#!/usr/bin/env node

let cdnUrl = 'http://localhost:4040';

const argv = require('yargs').argv
const chalk = require('chalk');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

let directory = '.futura';
let { auth, _, h } = argv;
if (_.length === 1 && _[0] === "init") {
  if (fs.existsSync(directory)) {
    console.log(chalk.yellow('futura is already init'));
    return;
  }
  init();
} else if (!fs.existsSync(directory)) {
  console.log(chalk.blue('It\'s not a futura projects'));
  console.log(chalk.green('futura init'));
} else if (_.length === 1 && _[0] === "sync") {
  let authFile = `${directory}/auth`;
    if (!fs.existsSync(authFile)) {
      console.log(chalk.yellow('futura need auth before sync'));
      console.log(chalk.yellow('futura --auth exemple-id-end'));
      return;
    }
    let res = fs.readFileSync(authFile, { encoding: 'utf8' });
    sync(res);
} else if (auth) {
  fs.writeFileSync( `${directory}/auth`, auth );
} else if (h) {
  help();
} else {
  console.log(chalk.yellow('futura -h'));
}

function help() {
  console.log(chalk.yellow('\t-----------------------------------'));
  console.log(chalk.yellow('\t-----------DOCUMENTATION-----------'));
  console.log(chalk.yellow('\t-----------------------------------'));
  console.log('\n');
  console.log(chalk.yellow('\tfutura init'));
  console.log(chalk.yellow('\tfutura --auth token    https://exemple.com/'));
  console.log(chalk.yellow('\tfutura -h'));
  console.log('\n');
  console.log(chalk.yellow('\tfutura sync'));
  console.log(chalk.yellow('\tfutura gen config'));
  console.log(chalk.yellow('\tfutura deploy'));
  console.log('\n');
}

function getHtml(option, callback) {
  let { groups, token } = option;
  if (!groups || !token) {
    return;
  }
  axios.get(`${cdnUrl}/api/${token}/components/${groups}/html`)
  .then(function (response) {
    let { data } = response;
    let { html } = data;
    callback(undefined, html);
  })
  .catch(function (error) {
    callback(error, undefined);
  });
}

function saveFile(option) {
  let { html, name, path } = option;
  if ( !fs.existsSync( `${directory}/meteor/private` ) )
			fs.mkdirSync( `${directory}/meteor/private` );
  // if ( !fs.existsSync( `${directory}/meteor/private/` ) )
  	  // fs.mkdirSync( `${directory}/meteor/private/` );
	fs.writeFileSync( `${directory}/meteor/private/${name}.html`, html);
  return option;
}

function genRouter(data) {
  let router = [
    "import fs from 'fs';",
  ];
  for (let i = 0; i < data.length; i++) {
    let { name, path } = data[i];
    router.push(`Picker.route('${path}', function(params, req, res, next) {`);
    router.push("\tlet data = fs.readFileSync( `${ process.env.PWD }/private/" + name + ".html` );");
    router.push("\tres.write( data );");
    router.push("\treturn res.end();");
    router.push("});");
    router.push("\n");
  }
  let routerStr = router.join('\n');
  // let endStr = end.join('\n');
  if ( !fs.existsSync( `${directory}/meteor/server` ) )
			fs.mkdirSync( `${directory}/meteor/server` );
	fs.writeFileSync( `${directory}/meteor/server/main.js`, `${routerStr}`);
}

function sync(token) {
  axios.get(`${cdnUrl}/api/${token}/routes`)
  .then(function (response) {
    let { data } = response;
    let routes = data.data;
    let { length } = routes;
    let routerData = [];
    for (let i = 0; i < length; i++) {
      let groups = routes[i].template;
      if (groups) {
        let html = getHtml({ groups, token }, function(err, res) {
          if (!err) {
            let name = groups.split("-").join("");
            let obj = saveFile({ html: res, name, path: routes[i].path });
            routerData.push({name: obj.name, path: obj.path});
            console.log(chalk.green(`Route: ${obj.path}`));
            console.log(chalk.green(`HtmlFile: ${obj.name}.html`));
            if (routerData.length === length) {
              genRouter(routerData);
            }
          }
        });
      }
    }
  })
  .catch(function (error) {
    console.log(chalk.red(error));
  });
}

function init() {
  console.log(chalk.blue('Initialization futura project...'));
  fs.mkdirSync(directory);

  console.log(chalk.blue('Creating meteor project...'));
  // const meteor = spawn('meteor', ['create', '--bare', `${directory}/meteor`]);
  const meteor = spawn('git', ['clone', 'https://github.com/cjacques42/build.git', `${directory}/meteor`]);
  meteor.stderr.on('data', (data) => {
    console.log(chalk.red(data));
  });
  meteor.on('close', (code) => {
    if (code === 0) {
      const npm = spawn('npm', ['install', `${directory}/meteor`]);
      npm.stderr.on('data', (data) => {});
      npm.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('dependencies installed'));
        }
        console.log(chalk.yellow(`Code ${code}`));
      });
      console.log(chalk.green('finished'));
    }
    console.log(chalk.yellow(`Code ${code}`));
  });
}
